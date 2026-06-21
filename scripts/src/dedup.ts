import { db, productsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Old product names from the first seed that have superior replacements in new seed
const staleNames = [
  "Fresh Spinach",
  "Amaranth Leaves (Lal Saag)",
  "Curry Leaves",
  "Drumstick (Moringa)",
  "Methi Leaves",
  "Palak Saag",
  "Fresh Coriander",
  "Baby Kale",        // kept if no dup — but we have duplicate, remove lower id one
  "Raw Mango",
  "Capsicum Mix",
  "Banana (Kela)",
  "Green Garlic (Hara Lehsun)",
];

const deleted = await db.delete(productsTable)
  .where(inArray(productsTable.name, staleNames))
  .returning({ id: productsTable.id, name: productsTable.name });

console.log(`Removed ${deleted.length} stale/redundant products:`);
for (const d of deleted) console.log(`  [${d.id}] ${d.name}`);
process.exit(0);
