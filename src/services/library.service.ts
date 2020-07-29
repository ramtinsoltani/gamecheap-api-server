import { Service, ServerError } from '@steroids/core';
import LibraryModel from '@steroids/model/library';
import { LibraryDocument } from '@steroids/model/library';
import { Types } from 'mongoose';

@Service({
  name: 'library'
})
export class LibraryService {

  /**
  * Retrieves user library.
  * @param uid The user ID.
  */
  public async getInfo(uid: string): Promise<LibraryDocument> {

    const library = await LibraryModel.findById(uid, '-__v -_id -games._id -unrevealedCodes.code').exec();

    if ( ! library ) throw new ServerError('Invalid user ID!', 'library-info-error');

    return Object.assign(library.toJSON(), {
      unrevealedCodes: library.unrevealedCodes.map(code => ({ ...(<any>code).toJSON(), _id: undefined, id: code._id }))
    });

  }

  /**
  * Reveals a specified purchased game code for the user.
  * @param id The code ID.
  * @param uid The user ID.
  */
  public async revealCode(id: string, uid: string): Promise<{ gameId: string; code: string; }> {

    // Find library
    const library = await LibraryModel.findById(uid).exec();

    if ( ! library ) throw new ServerError('Invalid user ID!', 'code-reveal-error');

    // Find code in library and remove it from the list
    let unrevealedCode: LibraryDocument['unrevealedCodes'][0];

    for ( let i = 0; i < library.unrevealedCodes.length; i++ ) {

      if ( library.unrevealedCodes[i]._id.equals(id) ) {

        unrevealedCode = library.unrevealedCodes.splice(i, 1)[0];
        break;

      }

    }

    if ( ! unrevealedCode ) throw new ServerError('Invalid code ID!', 'code-reveal-error');

    // Write the code in the games list with a new ID
    const game: LibraryDocument['games'][0] = {
      gameId: unrevealedCode.gameId,
      code: unrevealedCode.code,
      _id: new Types.ObjectId()
    };

    library.games.push(game);

    // Save library
    await library.save();

    return Object.assign(game, { _id: undefined });

  }

}
