import { Schema, Document, model } from 'mongoose';
const ObjectId = Schema.Types.ObjectId;

const LibrarySchema = new Schema({
  games: [{
    gameId: ObjectId,
    code: String
  }],
  unrevealedCodes: [{
    gameId: ObjectId,
    code: String
  }],
  createdAt: Number,
  updatedAt: Number
});

// Pre save hook sets updatedAt and createdAt fields
LibrarySchema.pre<LibraryDocument>('save', function() {

  const timestamp = Math.floor(Date.now() / 1000);

  this.createdAt = this.createdAt || timestamp;
  this.updatedAt = timestamp;

});

export interface LibraryDocument extends Document {

  /** A list of owned games. */
  games: Array<{
    /** A unique ID for this object. */
    _id: any,
    /** The game ID. */
    gameId: string;
    /** The game code. */
    code: string;
  }>;
  /** A list of purchased and unrevealed codes. */
  unrevealedCodes: Array<{
    /** A unique ID for this object. */
    _id: any,
    /** The game ID. */
    gameId: string;
    /** The game code. */
    code: string;
  }>;
  /** Document creation time. */
  createdAt: number;
  /** Last document update time. */
  updatedAt: number;

}

export default model<LibraryDocument>('libraries', LibrarySchema);
