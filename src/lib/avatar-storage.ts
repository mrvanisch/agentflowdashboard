import path from "path";

const CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export function avatarUploadDir() {
  return process.env.AVATAR_UPLOAD_DIR
    ? path.resolve(process.env.AVATAR_UPLOAD_DIR)
    : path.join(process.cwd(), "public", "avatars");
}

export function avatarPublicUrl(fileName: string) {
  return `/api/auth/avatar/${encodeURIComponent(fileName)}`;
}

export function avatarContentType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

export function isSafeAvatarFileName(fileName: string) {
  return /^[a-zA-Z0-9_.-]+$/.test(fileName);
}
