import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IProduct {
  _id: number;
  sellerId: number;
  categoryId: number;
  name: string;
  description?: string;
  price: number;
  mrp?: number;
  unit: string;
  stock: number;
  images: string[];
  tags: string[];
  nutritionInfo?: string;
  isFresh: boolean;
  isOrganic: boolean;
  rating: number;
  reviewCount: number;
  orderCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const productSchema = new mongoose.Schema<IProduct>(
  {
    _id: { type: Number },
    sellerId: { type: Number, required: true },
    categoryId: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    mrp: { type: Number },
    unit: { type: String, required: true },
    stock: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    nutritionInfo: { type: String },
    isFresh: { type: Boolean, default: false },
    isOrganic: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

productSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("products") as unknown as number;
  }
});

export const Product = mongoose.model<IProduct>("Product", productSchema);
