import { readFile } from "fs/promises";
import path from "path";
import { avatarContentType, avatarUploadDir, isSafeAvatarFileName } from "@/lib/avatar-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!isSafeAvatarFileName(filename)) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const filePath = path.join(avatarUploadDir(), filename);
    const bytes = await readFile(filePath);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": avatarContentType(filename),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
