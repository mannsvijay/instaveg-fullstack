import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, Seller } from "@workspace/db";
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

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed, phone, role });
  await user.save();

  if (role === "seller") {
    const seller = new Seller({ userId: user._id, storeName: `${name}'s Store` });
    await seller.save();
  }

  const token = signToken({ id: user._id, email: user.email, role: user.role });
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.status(201).json({ token, user: safeUser });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
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

  const token = signToken({ id: user._id, email: user.email, role: user.role });
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.status(200).json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as typeof req & { user: { id: number } }).user;
  const user = await User.findById(authUser.id);
  if (!user) {
    res.status(401).json({ error: "Not found" });
    return;
  }
  const { password: _pw, ...safeUser } = user.toJSON() as Record<string, unknown>;
  res.json(safeUser);
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Logged out" });
});

export default router;
