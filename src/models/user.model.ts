import { Schema, Document, model } from 'mongoose';

const UserSchema = new Schema({
  firstName: String,
  lastName: String,
  dob: String,
  credits: Number,
  email: String,
  verified: Boolean,
  passwordReset: {
    code: Number,
    expiration: Number
  },
  passwordHash: String,
  refreshTokens: [{
    hash: String,
    expiration: Number
  }],
  accessScopes: [String],
  wishlist: [String],
  createdAt: Number,
  updatedAt: Number
});

// Pre save hook sets updatedAt and createdAt fields
UserSchema.pre<UserDocument>('save', function() {

  const timestamp = Math.floor(Date.now() / 1000);

  this.createdAt = this.createdAt || timestamp;
  this.updatedAt = timestamp;

});

interface UserBaseInfo {

  /** The first name of the user. */
  firstName: string;
  /** The last name of the user. */
  lastName: string;
  /** The date of birth of the user (format: mm/dd/yyyy). */
  dob: string;
  /** User's email. */
  email: string;
  /** Determines which access scopes are assigned to this user. */
  accessScopes: Array<string>;

}

export interface UserRegistrationInfo extends UserBaseInfo {

  /** User's password in plain text. */
  password: string;

}

export interface UserDocument extends UserBaseInfo, Document {

  /** The total credits this user owns. */
  credits: number;
  /** Whether user's email is verified or not. */
  verified: boolean;
  /** Password reset request data. */
  passwordReset?: {
    /** The last password reset code sent to user's email. */
    code: number;
    /** The expiration time of the last password reset code sent to user's email. */
    expiration: number;
  };
  /** User's password hash. */
  passwordHash: string;
  /** An array of valid refresh token hashes that were generated for renewing
  access tokens. */
  refreshTokens: Array<{
    /** The refresh token hash. */
    hash: string;
    /**
    * The expiration time of this refresh token.<br>
    * <i>This information is used for server maintenance algorithm to be able to decide when
    * this refresh token data can be deleted, therefore, avoiding database pollution.</i>
    */
    expiration: number;
  }>;
  /** User's wishlist of game IDs. */
  wishlist: Array<string>;
  /** Document creation time. */
  createdAt: number;
  /** Last document update time. */
  updatedAt: number;

}

export interface UserProfile extends UserBaseInfo {

  /** A unique identifier for the user. */
  id: string;
  /** The total credits this user owns. */
  credits: number;
  /** Document creation time. */
  createdAt: number;

}

export type UserList = Array<UserListing>;

export interface UserListing {

  /** A unique identifier for the user. */
  id: string;
  /** Whether user's email is verified or not. */
  verified: boolean;
  /** The first name of the user. */
  firstName: string;
  /** The last name of the user. */
  lastName: string;
  /** User's email. */
  email: string;
  /** Determines which access scopes are assigned to this user. */
  accessScopes: Array<string>;

}

export enum AccessScopes {

  /** Enables management of inventory. */
  InventoryManagement = 'inventory-management',
  /** Enables management of user accounts beside its own. */
  UserManagement = 'user-management'

}

export default model<UserDocument>('users', UserSchema);
