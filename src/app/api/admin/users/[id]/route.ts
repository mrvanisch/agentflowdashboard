import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { adminUserUpdateSchema } from "@/lib/validation";

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatarColor: true,
  role: true,
  approved: true,
  mustChangePassword: true,
  createdAt: true
};

async function assertAdminRules(targetId: string, adminId: string, changes: { role?: string; approved?: boolean }) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });

  if (target.id === adminId && changes.approved === false) {
    return "Nie mozesz zablokowac wlasnego konta.";
  }

  if (target.role === "ADMIN" && (changes.role === "MEMBER" || changes.approved === false)) {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", approved: true, id: { not: target.id } }
    });
    if (otherAdmins === 0) {
      return "Nie mozna usunac ostatniego aktywnego admina.";
    }
  }

  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = adminUserUpdateSchema.parse(await request.json());
    const ruleError = await assertAdminRules(id, admin.id, body);
    if (ruleError) return fail(ruleError, 409);

    const user = await prisma.user.update({
      where: { id },
      data: body,
      select: userSelect
    });

    await logAudit({ userId: admin.id, action: "USER_UPDATE", entity: "User", entityId: user.id, details: body });
    return ok({ user });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return fail("Nie mozesz usunac wlasnego konta.", 409);

    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.role === "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", approved: true, id: { not: target.id } }
      });
      if (otherAdmins === 0) return fail("Nie mozna usunac ostatniego aktywnego admina.", 409);
    }

    await prisma.user.delete({ where: { id } });
    await logAudit({ userId: admin.id, action: "USER_DELETE", entity: "User", entityId: id, details: { email: target.email, username: target.username } });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
