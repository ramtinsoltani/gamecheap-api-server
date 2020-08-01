import { Service, OnInjection, OnConfig, ServerConfig, ServerError } from '@steroids/core';
import UserModel from '@steroids/model/user';
import LibraryModel from '@steroids/model/library';
import { UserRegistrationInfo, AccessScopes } from '@steroids/model/user';
import { EmailService, PasswordResetTemplateData, VerificationTemplateData } from '@steroids/service/email';
import { TasksService } from '@steroids/service/tasks';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

@Service({
  name: 'auth'
})
export class AuthService implements OnInjection, OnConfig {

  private tokenConfig: ServerConfig['token'];
  private hostUrl: string;
  private email: EmailService;
  private tasks: TasksService;

  onInjection(services: any) {

    this.email = services.email;
    this.tasks = services.tasks;

  }

  onConfig(config: ServerConfig) {

    this.tokenConfig = config.token;
    this.hostUrl = config.hostUrl;

    this.init();

  }

  /**
  * Registers cleanup tasks.
  */
  init() {

    this.tasks.events.on('ready', () => {

      this.tasks.register('user-refresh-tokens-cleanup', 60, true, async () => {

        const users = await UserModel.find().exec();

        for ( const user of users ) {

          let changed = false;

          for ( let i = 0; i < user.refreshTokens.length; i++ ) {

            // Expired refresh token
            if ( user.refreshTokens[i].expiration < Date.now() / 1000 ) {

              user.refreshTokens.splice(i, 1);
              i--;
              changed = true;

            }

          }

          if ( changed ) await user.save();

        }

      });

      this.tasks.events.on('user-refresh-tokens-cleanup:error', (error: Error) => {

        log.warn('User refresh token cleanup failed!', error);

      });

    });

  }

  /**
  * Creates a new user document in the database if it doesn't already exist and returns its UID.
  * @param info New user info.
  */
  public async createUser(info: UserRegistrationInfo): Promise<string> {

    // Check if email is already assigned to another user
    if ( await UserModel.findOne({ email: info.email }).exec() )
      throw new ServerError('This email is already assigned to another account!', 'auth-register-error');

    // Create the user document
    let user = new UserModel();

    user.firstName = info.firstName;
    user.lastName = info.lastName;
    user.dob = info.dob;
    user.email = info.email;
    user.credits = 100;
    user.verified = false;
    user.passwordHash = await bcrypt.hash(info.password, 10);
    user.accessScopes = info.accessScopes || [];
    user.wishlist = [];

    // Save the document
    user = await user.save();

    // Create user library
    const library = new LibraryModel();

    library._id = user._id;
    library.games = [];
    library.unrevealedCodes = [];

    // Save the document
    await library.save();

    log.debug('User created with uid', user._id);

    return user._id;

  }

  /**
  * Retrieves user ID by email and password.
  * @param email An email.
  * @param password A plain-text password.
  */
  public async getUserByCredentials(email: string, password: string): Promise<string> {

    // Find user with the email
    const user = await UserModel.findOne({ email }).exec();

    if ( ! user ) throw new ServerError('Email is not registered!', 'login-error');

    // Check user's password
    const correctPassword = await bcrypt.compare(password, user.passwordHash);

    if ( ! correctPassword ) throw new ServerError('Invalid password!', 'login-error');

    return user._id;

  }

  /**
  * Generates a new refresh token for the specified user.
  * @param uid The user ID.
  */
  public async generateRefreshToken(uid: string): Promise<string> {

    // Generate the refresh token
    const exp = Math.floor(Date.now() / 1000) + this.tokenConfig.refreshLifespan;
    const token: string = await new Promise((resolve, reject) => {

      jwt.sign({
        exp,
        uid
      }, this.tokenConfig.refreshSecret, (error: Error, token: string) => {

        if ( error ) return reject(new ServerError(error.message, 'auth-refresh-token-generation-error'));

        resolve(token);

      });

    });

    // Whitelist the refresh token in user's document
    if ( ! Types.ObjectId.isValid(uid) ) throw new ServerError('Invalid ID format!', 'refresh-token-generation-error');

    const user = await UserModel.findById(uid).exec();

    if ( ! user ) throw new ServerError('Unknown user!', 'refresh-token-generation-error');

    user.refreshTokens.push({
      expiration: exp,
      hash: await bcrypt.hash(token, 10)
    });

    await user.save();

    return token;

  }

  /**
  * Generates a new access token based on a refresh token.
  * @param refreshToken A valid refresh token.
  */
  public async generateAccessToken(refreshToken: string): Promise<string> {

    // Decode the refresh token
    const decoded: RefreshTokenData = await new Promise((resolve, reject) => {

      jwt.verify(refreshToken, this.tokenConfig.refreshSecret, (error, decoded) => {

        if ( error ) {

          if ( error instanceof jwt.TokenExpiredError )
            return reject(new ServerError('Refresh token is expired!', 'access-token-generation-error'));
          else if ( error instanceof jwt.JsonWebTokenError )
            return reject(new ServerError('Invalid refresh token!', 'access-token-generation-error'));
          else
            return reject(new ServerError('Unknown error!', 'access-token-generation-error'));

        }

        resolve(<RefreshTokenData>decoded);

      });

    });

    // Check user's list of accepted refresh tokens
    if ( ! Types.ObjectId.isValid(decoded.uid) ) throw new ServerError('Invalid ID format!', 'access-token-generation-error');

    const user = await UserModel.findById(decoded.uid).exec();

    if ( ! user ) throw new ServerError('Unknown user!', 'access-token-generation-error');

    let acceptedRefreshToken = false;

    for ( const token of user.refreshTokens ) {

      if ( await bcrypt.compare(refreshToken, token.hash) ) {

        acceptedRefreshToken = true;
        continue;

      }

    }

    if ( ! acceptedRefreshToken ) throw new ServerError('Unacceptable refresh token!', 'access-token-generation-error');

    // Generate access token
    return await new Promise((resolve, reject) => {

      jwt.sign({
        uid: decoded.uid,
        access: user.accessScopes,
        exp: Math.floor(Date.now() / 1000) + this.tokenConfig.accessLifespan,
        verified: user.verified
      }, this.tokenConfig.accessSecret, (error: Error, token: string) => {

        if ( error ) return reject(new ServerError(error.message, 'access-token-generation-error'));

        resolve(token);

      });

    });

  }

  /**
  * Decodes an access token.
  * @param accessToken An access token.
  */
  public async decodeAccessToken(accessToken: string): Promise<AccessTokenData> {

    return await new Promise((resolve, reject) => {

      jwt.verify(accessToken, this.tokenConfig.accessSecret, (error, decoded) => {

        if ( error ) {

          if ( error instanceof jwt.TokenExpiredError )
            return reject(new ServerError('Access token is expired!', 'access-token-auth-error'));
          else if ( error instanceof jwt.JsonWebTokenError )
            return reject(new ServerError('Invalid access token!', 'access-token-auth-error'));
          else
            return reject(new ServerError('Unknown error!', 'access-token-auth-error'));

        }

        resolve(<AccessTokenData>decoded);

      });

    });

  }

  /**
  * Sends a verification email to the user.
  * @param uid The user's ID.
  */
  public async sendVerificationEmail(uid: string) {

    // Read user document
    if ( ! Types.ObjectId.isValid(uid) ) throw new ServerError('Invalid ID format!', 'email-verification-send-error');

    const user = await UserModel.findById(uid).exec();

    if ( ! user ) throw new ServerError('Unknown user!', 'email-verification-send-error');
    if ( user.verified ) throw new ServerError('User is already verified!', 'email-verification-send-error');

    // Generate verification token
    const token: string = await new Promise((resolve, reject) => {

      jwt.sign({
        uid,
        email: user.email
      }, this.tokenConfig.verificationSecret, (error: Error, token: string) => {

        if ( error ) return reject(new ServerError(error.message, 'email-verification-send-error'));

        resolve(token);

      });

    });

    // Send verification email
    await this.email.send(
      'GameCheap Account Verification',
      user.email,
      this.email.renderTemplate<VerificationTemplateData>('account-verification', {
        firstName: user.firstName,
        lastName: user.lastName,
        hostUrl: this.hostUrl,
        link: `http://localhost:5000/auth/verify/complete?vt=${token}`
      })
    );

  }

  /**
  * Completes user verification using a verification token.
  * @param verificationToken A verification token.
  */
  public async completeVerification(verificationToken: string) {

    // Decode the verification token
    const decoded: VerificationTokenData = await new Promise((resolve, reject) => {

      jwt.verify(verificationToken, this.tokenConfig.verificationSecret, (error, decoded) => {

        if ( error ) {

          if ( error instanceof jwt.TokenExpiredError )
            return reject(new ServerError('Verification token is expired!', 'verification-error'));
          else if ( error instanceof jwt.JsonWebTokenError )
            return reject(new ServerError('Invalid verification token!', 'verification-error'));
          else
            return reject(new ServerError('Unknown error!', 'verification-error'));

        }

        resolve(<VerificationTokenData>decoded);

      });

    });

    // Verify the user
    if ( ! Types.ObjectId.isValid(decoded.uid) ) throw new ServerError('Invalid ID format!', 'verification-error');

    const user = await UserModel.findOne({ _id: decoded.uid, email: decoded.email }).exec();

    if ( ! user ) throw new ServerError('Unknown user!', 'verification-error');
    if ( user.verified ) throw new ServerError('User is already verified!', 'verification-error');

    user.verified = true;

    await user.save();

  }

  /**
  * Sends an email containing a password reset code to use for resetting the password.
  * @param email A registered email.
  */
  public async sendPasswordResetCode(email: string) {

    // Check if email is registered
    const user = await UserModel.findOne({ email }).exec();

    if ( ! user ) throw new ServerError('The provided email is not a registered user!', 'password-reset-send-error');

    // Generate a password reset code and save it in the user document
    let code = '';

    for ( let i = 0; i < 6; i++ ) {

      code += Math.floor(Math.random() * 10);

    }

    user.passwordReset = {
      code: +code,
      expiration: Math.floor(Date.now() / 1000) + 300 // 5 mins
    };

    await user.save();

    // Send password reset email
    await this.email.send(
      'Game Cheap Password Reset',
      user.email,
      this.email.renderTemplate<PasswordResetTemplateData>('password-reset', {
        hostUrl: this.hostUrl,
        firstName: user.firstName,
        lastName: user.lastName,
        code
      })
    );

  }

  /**
  * Completes password reset using a code.
  * @param email A registered email.
  * @param code A password reset code.
  * @param newPassword A new password.
  */
  public async completePasswordReset(email: string, code: number, newPassword: string) {

    // Find the user document
    const user = await UserModel.findOne({ email }).exec();

    if ( ! user ) throw new ServerError('The provided email is not a registered user!', 'password-reset-error');

    // Check the password reset code
    if ( user?.passwordReset.code !== code )
      throw new ServerError('Invalid password reset code!', 'password-reset-error');

    // Check the code expiration
    if ( user?.passwordReset.expiration < Math.floor(Date.now() / 1000) )
      throw new ServerError('The password reset code has expired!', 'password-reset-error');

    user.passwordReset = undefined;

    // Store new password hash
    user.passwordHash = await bcrypt.hash(newPassword, 10);

    // Invalidate all refresh tokens
    user.refreshTokens = [];

    await user.save();

  }

  /**
  * Logs out the user from all devices by invalidating all issued refresh tokens.
  * @param uid The user ID.
  */
  public async logout(uid: string) {

    const user = await UserModel.findById(uid).exec();

    if ( ! user ) throw new ServerError('User not found!', 'logout-error');

    user.refreshTokens = [];

    await user.save();

  }

}

export interface RefreshTokenData {

  /** The expiration time in seconds since the Epoch. */
  exp: number;
  /** The user ID. */
  uid: string;

}

export interface AccessTokenData {

  /** The expiration time in seconds since the Epoch. */
  exp: number;
  /** The user ID. */
  uid: string;
  /** A list of access scopes granted for this user. */
  access: Array<AccessScopes>;
  /** Whether this user's email is verified or not. */
  verified: boolean;

}

export interface VerificationTokenData {

  /** The user ID. */
  uid: string;
  /** User's email address. */
  email: string;

}
