import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IReview {
  _id: number;
  productId: number;
  userId: number;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const reviewSchema = new mongoose.Schema<IReview>(
  {
    _id: { type: Number },
    productId: { type: Number, required: true },
    userId: { type: Number, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

reviewSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("reviews") as unknown as number;
  }
});

export const Review = mongoose.model<IReview>("Review", reviewSchema);
