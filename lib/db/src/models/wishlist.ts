import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IWishlist {
  _id: number;
  userId: number;
  productId: number;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const wishlistSchema = new mongoose.Schema<IWishlist>(
  {
    _id: { type: Number },
    userId: { type: Number, required: true },
    productId: { type: Number, required: true },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

wishlistSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("wishlists") as unknown as number;
  }
});

export const Wishlist = mongoose.model<IWishlist>("Wishlist", wishlistSchema);
