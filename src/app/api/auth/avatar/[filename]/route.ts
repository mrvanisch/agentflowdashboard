import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), "public", "avatars", filename);
    const buffer = await readFile(filePath);
    
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif"
    }[ext || ""] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    return new NextResponse("Not Found", { status: 404 });
  }
}
