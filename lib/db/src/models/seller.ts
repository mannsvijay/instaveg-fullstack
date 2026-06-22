import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface ISeller {
  _id: number;
  userId: number;
  storeName: string;
  description?: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  isVerified: boolean;
  city?: string;
  address?: string;
  phone?: string;
  rating: number;
  totalOrders: number;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const sellerSchema = new mongoose.Schema<ISeller>(
  {
    _id: { type: Number },
    userId: { type: Number, required: true, unique: true },
    storeName: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    isVerified: { type: Boolean, default: false },
    city: { type: String },
    address: { type: String },
    phone: { type: String },
    rating: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

sellerSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("sellers") as unknown as number;
  }
});

export const Seller = mongoose.model<ISeller>("Seller", sellerSchema);
