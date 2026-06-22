import mongoose from "mongoose";
import { nextId } from "./counter.js";

export interface IOrderItem {
  productId: number;
  quantity: number;
  price: number;
  productName?: string;
  productImage?: string;
  productUnit?: string;
  sellerId?: number;
}

export interface IOrder {
  _id: number;
  userId: number;
  sellerId?: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  addressId?: number;
  addressSnapshot?: string;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  notes?: string;
  razorpayOrderId?: string;
  eta?: string;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const jsonTransform = (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const orderItemSchema = new mongoose.Schema<IOrderItem>(
  {
    productId: { type: Number },
    quantity: { type: Number },
    price: { type: Number },
    productName: { type: String },
    productImage: { type: String },
    productUnit: { type: String },
    sellerId: { type: Number },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema<IOrder>(
  {
    _id: { type: Number },
    userId: { type: Number, required: true },
    sellerId: { type: Number },
    status: { type: String, default: "pending" },
    paymentStatus: { type: String, default: "pending" },
    paymentMethod: { type: String },
    addressId: { type: Number },
    addressSnapshot: { type: String },
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String },
    razorpayOrderId: { type: String },
    eta: { type: String },
    items: { type: [orderItemSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { transform: jsonTransform },
    toObject: { transform: jsonTransform },
  },
);

orderSchema.pre("save", async function () {
  if (this.isNew && !this._id) {
    this._id = await nextId("orders") as unknown as number;
  }
});

export const Order = mongoose.model<IOrder>("Order", orderSchema);
