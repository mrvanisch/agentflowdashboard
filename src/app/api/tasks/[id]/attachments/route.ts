import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logActivity, notifyUsers, taskInclude } from "@/lib/tasks";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { assignees: true }
    });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Brak pliku.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, storedName), bytes);

    await prisma.attachment.create({
      data: {
        taskId: id,
        uploadedById: user.id,
        fileName: file.name,
        fileSize: bytes.length,
        mimeType: file.type || "application/octet-stream",
        url: `/uploads/${storedName}`
      }
    });
    await logActivity(id, user.id, "ATTACHED", `Dodano plik ${file.name}.`);
    await notifyUsers({
      userIds: task.assignees.map((item) => item.userId),
      actorId: user.id,
      taskId: id,
      title: `Nowy zalacznik w ${task.key}`,
      body: file.name
    });

    const fresh = await prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return ok({ task: fresh });
  } catch (error) {
    return handleError(error);
  }
}
