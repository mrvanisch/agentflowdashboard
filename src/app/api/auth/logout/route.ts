import { clearSession, getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({ userId: user.id, action: "LOGOUT", entity: "User", entityId: user.id });
  }
  
  await clearSession();
  return ok({ done: true });
}
