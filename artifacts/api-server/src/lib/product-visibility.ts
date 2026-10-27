import { db, productsTable, sellersTable } from "@workspace/db";
import { eq, inArray, or, type SQL } from "drizzle-orm";

// Products are public only while their seller is approved (H5).
export function approvedSellerProducts(): SQL {
  return inArray(
    productsTable.sellerId,
    db.select({ id: sellersTable.id }).from(sellersTable).where(eq(sellersTable.status, "approved")),
  );
}

export async function getSellerForUser(userId: number) {
  const [seller] = await db.select({ id: sellersTable.id, status: sellersTable.status })
    .from(sellersTable).where(eq(sellersTable.userId, userId));
  return seller ?? null;
}

// Admin sees every product; a seller also sees their own; everyone else
// only products of approved sellers. undefined means "no restriction".
export async function productVisibility(viewer: { id: number; role: string } | null): Promise<SQL | undefined> {
  if (viewer?.role === "admin") return undefined;
  if (viewer?.role === "seller") {
    const seller = await getSellerForUser(viewer.id);
    if (seller) return or(approvedSellerProducts(), eq(productsTable.sellerId, seller.id));
  }
  return approvedSellerProducts();
}
