import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Admin = the signed-in user whose email equals ADMIN_EMAIL. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email === process.env.ADMIN_EMAIL;
}

/**
 * Guard for admin API routes: returns a 401 response for non-admins, null otherwise.
 *   const denied = await requireAdmin(); if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return isAdminEmail(user?.email) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
