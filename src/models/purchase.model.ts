import { Schema, Document, model } from 'mongoose';
const ObjectId = Schema.Types.ObjectId;

const PurchaseSchema = new Schema({
  buyer: ObjectId,
  codeId: ObjectId,
  gameId: ObjectId,
  originalPrice: Number,
  finalPrice: Number,
  refunded: Boolean,
  reason: String,
  createdAt: Number,
  updatedAt: Number
});

// Pre save hook sets updatedAt and createdAt fields
PurchaseSchema.pre<PurchaseDocument>('save', function() {

  const timestamp = Math.floor(Date.now() / 1000);

  this.createdAt = this.createdAt || timestamp;
  this.updatedAt = timestamp;

});

export interface PurchaseDocument extends Document {

  /** The unique identifier of the user who made this purchase. */
  buyer: any;
  /** The unique identifier of the game code in library. */
  codeId: any;
  /** The game ID. */
  gameId: string;
  /** The original price of the game at the time of purchase. */
  originalPrice: number;
  /** The final price of the game after discounts at the time of purchase. */
  finalPrice: number;
  /** Whether this item was later refunded or not. */
  refunded?: boolean;
  /** The reason for refund. */
  reason?: string;
  /** Document creation time. */
  createdAt: number;
  /** Last document update time. */
  updatedAt: number;

}

export default model<PurchaseDocument>('purchases', PurchaseSchema);
