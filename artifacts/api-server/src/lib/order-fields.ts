import type { ordersTable } from "@workspace/db";

// Order columns exposed by the API. razorpay_order_id stays in the table
// (dropping it needs a migration, see audit L11) but is no longer part of
// the API: InstaVEG is cash-on-delivery only (H4).
export function orderFields(order: typeof ordersTable.$inferSelect) {
  const { razorpayOrderId: _unused, ...fields } = order;
  return fields;
}
