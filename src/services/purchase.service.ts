import { Service, ServerError } from '@steroids/core';

import PurchaseModel from '@steroids/model/purchase';
import LibraryModel from '@steroids/model/library';
import GameModel from '@steroids/model/game';
import UserModel from '@steroids/model/user';

import { PurchaseDocument } from '@steroids/model/purchase';
import { LibraryDocument } from '@steroids/model/library';
import { AccessScopes } from '@steroids/model/user';

@Service({
  name: 'purchase'
})
export class PurchaseService {

  /**
  * Returns a list of purchases made by the specified user.
  * @param uid The user ID.
  */
  public async getHistory(uid: string): Promise<Array<PurchaseDocument>> {

    return (await PurchaseModel.find({ buyer: uid }, '-__v').exec())
    // Sanitize the output
    .map(purchase => ({ ...purchase.toJSON(), _id: undefined, id: purchase._id }));

  }

  /**
  * Returns a specific purchase info.
  * @param id The purchase ID.
  * @param scopes Current user access scopes.
  * @param uid The user ID.
  */
  public async getById(id: string, scopes: Array<AccessScopes>, uid?: string): Promise<PurchaseDocument> {

    let purchase: PurchaseDocument;

    // With admin rights
    if ( scopes.includes(AccessScopes.UserManagement) )
      purchase = await PurchaseModel.findById(id, '-__v').exec();
    // Without admin rights
    else if ( uid )
      purchase = await PurchaseModel.findOne({ buyer: uid, _id: id }, '-__v').exec();
    // Invalid request
    else
      throw new ServerError('Cannot read purchase info due to insufficient access rights or information!', 'purchase-info-error');

    if ( ! purchase ) throw new ServerError('Could not find purchase!', 'purchase-info-error');

    return {
      ...purchase.toJSON(),
      _id: undefined,
      id: purchase._id
    };

  }

  /**
  * Refunds the credits used in a purchase if the game code is not yet revealed.
  * @param id The purchase ID.
  * @param uid The user ID.
  * @param reason The refund reason.
  */
  public async refund(id: string, uid: string, reason?: string) {

    // Find purchase document
    const purchase = await PurchaseModel.findOne({ buyer: uid, _id: id }).exec();

    if ( ! purchase ) throw new ServerError('Purchase not found!', 'refund-error');

    // Check if purchase is already refunded
    if ( purchase.refunded ) throw new ServerError('Purchase is already refunded!', 'refund-error');

    // Find library document
    const library = await LibraryModel.findById(uid).exec();

    if ( ! library ) throw new ServerError('Invalid user ID!', 'refund-error');

    // Check if code is revealed
    let unrevealedCode: LibraryDocument['unrevealedCodes'][0];
    let unrevealedCodeIndex: number;

    for ( let i = 0; i < library.unrevealedCodes.length; i++ ) {

      if ( library.unrevealedCodes[i]._id.equals(purchase.codeId) ) {

        unrevealedCode = library.unrevealedCodes[i];
        unrevealedCodeIndex = i;
        break;

      }

    }

    if ( ! unrevealedCode )
      throw new ServerError('Cannot refund the purchase because the code is already revealed!', 'refund-error');

    // Remove the code from library
    library.unrevealedCodes.splice(unrevealedCodeIndex, 1);

    // Update library
    await library.save();

    // Find game document
    const game = await GameModel.findById(purchase.gameId).exec();

    // Add the code back to game document for future selling
    game.codes.push(unrevealedCode.code);

    // Update the game document
    await game.save();

    // Add credits to user document
    const user = await UserModel.findById(uid).exec();

    if ( ! user )
      throw new ServerError('Cannot add credits to user account because user was not found!', 'refund-error');

    user.credits += purchase.finalPrice;

    await user.save();

    // Update the purchase document
    purchase.refunded = true;
    purchase.reason = reason;

    await purchase.save();

  }

}
