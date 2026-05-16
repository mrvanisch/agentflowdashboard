import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    
    if (!file || typeof file === "string" || !('arrayBuffer' in file)) {
      throw new Error("Brak pliku lub niepoprawny format.");
    }

    const uploadedFile = file as File;
    
    // Security: Limit file size to 2MB
    if (uploadedFile.size > 2 * 1024 * 1024) {
      throw new Error("Plik jest zbyt duzy. Maksymalny rozmiar to 2MB.");
    }

    if (!uploadedFile.type.startsWith("image/")) {
      throw new Error("Plik musi byc obrazem.");
    }

    const bytes = Buffer.from(await uploadedFile.arrayBuffer());
    // Basic magic number check for common image types (optional but good)
    if (bytes.length < 4) throw new Error("Plik jest uszkodzony.");
    
    const ext = uploadedFile.name.split('.').pop()?.toLowerCase() || "png";
    if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      throw new Error("Niedozwolone rozszerzenie pliku.");
    }

    const storedName = `avatar-${user.id}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "avatars");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, storedName), bytes);

    const avatarUrl = `/avatars/${storedName}`;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
      select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true, mustChangePassword: true }
    });

    await logAudit({ userId: user.id, action: "AVATAR_UPDATE", entity: "User", entityId: user.id });

    return ok({ user: updatedUser });
  } catch (error) {
    return handleError(error);
  }
}
