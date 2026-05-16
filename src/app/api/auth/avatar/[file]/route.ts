import path from "path";
import { readFile } from "fs/promises";
import { avatarContentType, avatarUploadDir, isSafeAvatarFileName } from "@/lib/avatar-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!isSafeAvatarFileName(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const uploadDir = avatarUploadDir();
    const filePath = path.join(uploadDir, file);
    const bytes = await readFile(filePath);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": avatarContentType(file)
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
