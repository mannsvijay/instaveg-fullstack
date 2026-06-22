import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IUser {
  _id: number;
  name: string;
  email: string;
  password: string;
  role: "buyer" | "seller" | "admin";
  phone?: string;
  avatar?: string;
  isActive: boolean;
  coins: number;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const userSchema = new mongoose.Schema<IUser>(
  {
    _id: { type: Number },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["buyer", "seller", "admin"], default: "buyer" },
    phone: { type: String },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    coins: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

userSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("users") as unknown as number;
  }
});

export const User = mongoose.model<IUser>("User", userSchema);
