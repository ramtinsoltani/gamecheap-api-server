import { Router, RouteMethod, OnInjection, type, and, len, header, body, query, custom, opt } from '@steroids/core';
import { Request, Response } from 'express';
import { AccessScopes } from '@steroids/model/user';

import { basicAuthHeaderValidator } from '@steroids/validator/basic-auth';
import { bearerTokenHeaderValidator } from '@steroids/validator/bearer-token';
import { dateValidator } from '@steroids/validator/date';
import { emailValidator } from '@steroids/validator/email';
import { passwordValidator } from '@steroids/validator/password';

import { bearerTokenParser } from '@steroids/middleware/bearer-token-parser';
import { accessTokenAuth } from '@steroids/middleware/access-token-auth';

import { AuthService, AccessTokenData } from '@steroids/service/auth';

@Router({
  name: 'auth',
  routes: [
    { path: '/auth/login', method: RouteMethod.GET, handler: 'login', validate: [
      custom(basicAuthHeaderValidator)
    ]},
    { path: '/auth/signup', method: RouteMethod.POST, handler: 'signup', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        email: emailValidator,
        password: passwordValidator,
        firstName: and(type.string, len.range(1, 32)),
        lastName: and(type.string, len.range(1, 32)),
        dob: dateValidator,
        admin: opt(type.boolean)
      })
    ]},
    { path: '/auth/verify/complete', method: RouteMethod.GET, handler: 'verifyComplete', validate: [
      query(['vt'])
    ]},
    { path: '/auth/reset/send', method: RouteMethod.POST, handler: 'resetSend', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        email: emailValidator
      })
    ]},
    { path: '/auth/reset/complete', method: RouteMethod.POST, handler: 'resetComplete', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        email: emailValidator,
        newPassword: passwordValidator,
        code: type.number
      })
    ]},
    // Protected from this point downward
    { path: '/auth', handler: 'bearerTokenParser', validate: [
      custom(bearerTokenHeaderValidator)
    ]},
    { path: '/auth/renew', method: RouteMethod.GET, handler: 'renew' },
    // Authenticated from this point downward
    { path: '/auth', handler: 'accessTokenAuth' },
    { path: '/auth/verify/send', method: RouteMethod.GET, handler: 'verifySend' },
    { path: '/auth/logout', method: RouteMethod.GET, handler: 'logout' }
  ]
})
export class AuthRouter implements OnInjection {

  private auth: AuthService;

  // Middleware
  public get bearerTokenParser() { return bearerTokenParser; }
  public get accessTokenAuth() { return accessTokenAuth(this.auth); }

  onInjection(services: any) {

    this.auth = services.auth;

  }

  // Endpoints
  public login(req: Request, res: Response) {

    // Extract user credentials from the Authorization header
    const encoded = req.header('authorization').substr(6);
    const credentials = Buffer.from(encoded, 'base64').toString()
    .match(/^(?<email>.+?):(?<password>.+)$/).groups;

    const tokens = { refresh: null, access: null };

    // Retrieve user ID
    this.auth.getUserByCredentials(credentials.email, credentials.password)
    .then(uid => {

      // Generate refresh token
      return this.auth.generateRefreshToken(uid);

    })
    .then(refreshToken => {

      tokens.refresh = refreshToken;

      // Generate access token
      return this.auth.generateAccessToken(refreshToken);

    })
    .then(accessToken => {

      tokens.access = accessToken;

      // Respond with the tokens
      res.json(tokens);

    })
    .catch(error => res.status(400).json(error));

  }

  public signup(req: SignupRequest, res: Response) {

    const { email, password, firstName, lastName, dob } = req.body;
    const tokens = { refresh: null, access: null };
    let userId: string;

    // Create user document
    this.auth.createUser({
      email,
      password,
      firstName,
      lastName,
      dob,
      accessScopes: req.body.admin ? Object.values(AccessScopes) : undefined
    })
    .then(uid => {

      userId = uid;

      // Generate refresh token
      return this.auth.generateRefreshToken(uid);

    })
    .then(refreshToken => {

      tokens.refresh = refreshToken;

      // Generate access token
      return this.auth.generateAccessToken(refreshToken);

    })
    .then(accessToken => {

      tokens.access = accessToken;

      // Respond with the tokens
      res.json(tokens);

      // Send verification email
      this.auth.sendVerificationEmail(userId)
      .then(() => log.debug(`Verification email sent for user ${userId}`))
      .catch(error => log.error(error));

    })
    .catch(error => res.status(400).json(error));

  }

  public renew(req: ProtectedRequest, res: Response) {

    // Generate new access token
    this.auth.generateAccessToken(req.token)
    .then(accessToken => res.json({ access: accessToken }))
    .catch(error => res.status(400).json(error));

  }

  public verifySend(req: AuthenticatedRequest, res: Response) {

    // Send verification email
    this.auth.sendVerificationEmail(req.tokenData.uid)
    .then(() => res.json({ message: 'An email was sent with steps to complete account verification.' }))
    .catch(error => res.status(500).json(error));

  }

  public verifyComplete(req: Request, res: Response) {

    // Complete account verification
    this.auth.completeVerification(<string>req.query.vt)
    .then(() => res.json({ message: 'Your account has been successfully verified.' }))
    .catch(error => res.status(400).json(error));

  }

  public resetSend(req: PasswordResetSendRequest, res: Response) {

    // Send password reset email
    this.auth.sendPasswordResetCode(req.body.email)
    .then(() => res.json({ message: 'An email containing your password reset code has been sent to your email.' }))
    .catch(error => res.status(400).json(error));

  }

  public resetComplete(req: PasswordResetCompleteRequest, res: Response) {

    // Complete password reset
    this.auth.completePasswordReset(req.body.email, req.body.code, req.body.newPassword)
    .then(() => res.json({ message: 'Your password has been reset successfully.' }))
    .catch(error => res.status(400).json(error));

  }

  public logout(req: AuthenticatedRequest, res: Response) {

    this.auth.logout(req.tokenData.uid)
    .then(() => res.json({ message: 'User has been logged out of all devices.' }))
    .catch(error => res.status(400).json(error));

  }

}

export interface SignupRequest extends Request {

  body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dob: string;
    admin?: boolean;
  };

}

export interface PasswordResetSendRequest extends Request {

  body: {
    email: string;
  };

}

export interface PasswordResetCompleteRequest extends Request {

  body: {
    email: string;
    newPassword: string;
    code: number;
  };

}

export interface ProtectedRequest extends Request {

  token: string;

}

export interface AuthenticatedRequest extends ProtectedRequest {

  tokenData: AccessTokenData;

}
