import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");
  await mongoose.connect(uri);
}

export { User } from "./models/user.js";
export { Seller } from "./models/seller.js";
export { Category } from "./models/category.js";
export { Product } from "./models/product.js";
export { Cart } from "./models/cart.js";
export { Order } from "./models/order.js";
export { Address } from "./models/address.js";
export { Review } from "./models/review.js";
export { Wishlist } from "./models/wishlist.js";
export { nextId } from "./models/counter.js";

export type { IUser } from "./models/user.js";
export type { ISeller } from "./models/seller.js";
export type { ICategory } from "./models/category.js";
export type { IProduct } from "./models/product.js";
export type { ICart, ICartItem } from "./models/cart.js";
export type { IOrder, IOrderItem } from "./models/order.js";
export type { IAddress } from "./models/address.js";
export type { IReview } from "./models/review.js";
export type { IWishlist } from "./models/wishlist.js";
