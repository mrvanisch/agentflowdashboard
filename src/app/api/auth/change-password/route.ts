import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok, fail } from "@/lib/api";
import { z } from "zod";

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Haslo musi miec co najmniej 6 znakow.")
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = changePasswordSchema.parse(await request.json());

    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false
      }
    });

    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
