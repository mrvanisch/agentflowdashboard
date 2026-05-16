import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { deleteRegistrationToken, generateRegistrationToken, getRegistrationToken } from "@/lib/registration-token";

export async function GET() {
  try {
    await requireAdmin();
    const token = await getRegistrationToken();
    return ok({ token });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST() {
  try {
    const admin = await requireAdmin();
    const token = await generateRegistrationToken();
    await logAudit({ userId: admin.id, action: "TOKEN_REGENERATED", entity: "RegistrationToken", details: { message: "Admin wygenerowal nowy token rejestracji" } });
    return ok({ token });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  try {
    const admin = await requireAdmin();
    await deleteRegistrationToken();
    await logAudit({ userId: admin.id, action: "TOKEN_DELETED", entity: "RegistrationToken", details: { message: "Admin usunal token i wylaczyl rejestracje" } });
    return ok({ token: null });
  } catch (error) {
    return handleError(error);
  }
}
