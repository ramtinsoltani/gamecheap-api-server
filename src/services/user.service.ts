import { Service, ServerError } from '@steroids/core';

import UserModel from '@steroids/model/user';
import LibraryModel from '@steroids/model/library';
import PurchaseModel from '@steroids/model/purchase';

import { UserProfile, UserList } from '@steroids/model/user';
import { UserUpdateRequest } from '@steroids/router/user';

@Service({
  name: 'user'
})
export class UserService {

  /**
  * Retrieves user profile by ID.
  * @param uid The user ID.
  */
  public async getUserProfile(uid: string): Promise<UserProfile> {

    const user = await UserModel.findById(uid, '-passwordHash -refreshTokens -__v').exec();

    if ( ! user ) throw new ServerError(`User not found!`, 'user-profile-error');

    return Object.assign(user.toJSON(), { _id: undefined, id: user._id });

  }

  /**
  * Updates user profile data by ID.
  * @param uid The user ID.
  * @param data The profile update data.
  */
  public async updateUserProfile(uid: string, data: UserUpdateRequest['body']) {

    const user = await UserModel.findByIdAndUpdate(uid, data).exec();

    if ( ! user ) throw new ServerError('User not found!', 'user-profile-update-error');

  }

  /**
  * Adjusts the user credits by the given amount.
  * @param uid The user ID.
  * @param amount The adjustment amount (could be negative).
  */
  public async adjustCredits(uid: string, amount: number) {

    const user = await UserModel.findById(uid).exec();

    if ( ! user ) throw new ServerError('User not found!', 'user-credits-adjusment-error');

    user.credits += amount;

    await user.save();

  }

  /**
  * Returns a list of all users with a summary of their details.
  */
  public async getUsersList(): Promise<UserList> {

    // List all users with projection (complies with UserListing interface)
    return <UserList>(await UserModel.find({}, {
      _id: 1,
      firstName: 1,
      lastName: 1,
      email: 1,
      accessScopes: 1,
      verified: 1
    }).exec())
    // Rename _id to id
    .map(user => ({ ...user.toJSON(), _id: undefined, id: user._id }));

  }

  /**
  * Deletes user data including the user document and all other documents inside
  * various collections produced by the specified user.
  * @param uid The user ID.
  */
  public async deleteUserData(uid: string) {

    await PurchaseModel.deleteMany({ buyer: uid }).exec();
    await LibraryModel.findByIdAndDelete(uid);
    await UserModel.findByIdAndDelete(uid);

  }

}
