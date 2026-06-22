import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface ICartItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface ICart {
  _id: number;
  userId: number;
  items: ICartItem[];
  updatedAt: Date;
  createdAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const cartItemSchema = new mongoose.Schema<ICartItem>(
  {
    productId: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema<ICart>(
  {
    _id: { type: Number },
    userId: { type: Number, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

cartSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("carts") as unknown as number;
  }
});

export const Cart = mongoose.model<ICart>("Cart", cartSchema);
