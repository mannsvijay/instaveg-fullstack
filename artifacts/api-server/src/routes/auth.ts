import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, sellersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password, phone, role } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, password: hashed, phone, role }).returning();

  if (role === "seller") {
    await db.insert(sellersTable).values({ userId: user.id, storeName: `${name}'s Store` });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const { password: _pw, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account suspended" });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const { password: _pw, ...safeUser } = user;
  res.status(200).json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: { id: number } }).user;
  const [found] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  if (!found) {
    res.status(401).json({ error: "Not found" });
    return;
  }
  const { password: _pw, ...safeUser } = found;
  res.json(safeUser);
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Logged out" });
});

export default router;
