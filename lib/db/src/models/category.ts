import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface ICategory {
  _id: number;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const categorySchema = new mongoose.Schema<ICategory>(
  {
    _id: { type: Number },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

categorySchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("categories") as unknown as number;
  }
});

export const Category = mongoose.model<ICategory>("Category", categorySchema);
