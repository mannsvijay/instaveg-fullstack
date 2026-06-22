import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IAddress {
  _id: number;
  userId: number;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const addressSchema = new mongoose.Schema<IAddress>(
  {
    _id: { type: Number },
    userId: { type: Number, required: true },
    label: { type: String, default: "Home" },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

addressSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("addresses") as unknown as number;
  }
});

export const Address = mongoose.model<IAddress>("Address", addressSchema);
