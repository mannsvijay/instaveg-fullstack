// Single source of truth for what the buyer pays (H10). Both the cart
// response and checkout use this, so the order total equals the cart total.
export const DELIVERY_FEE = 40;
export const PLATFORM_FEE = 5;

const round2 = (value: number) => Math.round(value * 100) / 100;

export function priceCart(lines: { price: number; quantity: number }[]) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.price * line.quantity, 0));
  const deliveryFee = lines.length > 0 ? DELIVERY_FEE : 0;
  const platformFee = lines.length > 0 ? PLATFORM_FEE : 0;
  return { subtotal, deliveryFee, platformFee, total: round2(subtotal + deliveryFee + platformFee) };
}
