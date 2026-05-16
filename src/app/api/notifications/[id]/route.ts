import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await prisma.notification.update({
      where: { id, userId: user.id },
      data: { read: true }
    });
    return ok({ done: true });
  } catch (error) {
    return handleError(error);
  }
}
