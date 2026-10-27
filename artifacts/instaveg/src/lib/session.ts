import type { QueryClient } from "@tanstack/react-query";
import { navigate } from "wouter/use-browser-location";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
// Wrong credentials on these endpoints also return 401; that is not an expired session.
const CREDENTIAL_ENDPOINTS = /\/api\/auth\/(login|register)(\?|$)/;

let handling = false;

export function isUnauthorized(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 401;
}

// M7: a 401 from any API call made with a session token means the session is
// no longer valid. Log out once (several queries may fail together), drop
// cached private data, tell the user and send them to the login page.
export function handleSessionExpiry(error: unknown, queryClient: QueryClient): void {
  if (!isUnauthorized(error)) return;
  const url = String((error as { url?: unknown }).url ?? "");
  if (CREDENTIAL_ENDPOINTS.test(url)) return;
  const { token, logout } = useAuthStore.getState();
  if (!token || handling) return;

  handling = true;
  logout();
  setTimeout(() => queryClient.clear(), 0);
  toast({ title: "Session expired, please log in again", variant: "destructive" });
  navigate(`${BASE}/login`);
  setTimeout(() => { handling = false; }, 1500);
}
