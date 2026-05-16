export function resolveAvatarUrl(avatarUrl?: string | null) {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("/avatars/")) {
    return avatarUrl.replace("/avatars/", "/api/auth/avatar/");
  }
  return avatarUrl;
}

export function resolveFileUrl(fileUrl?: string | null) {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("/uploads/")) {
    return fileUrl.replace("/uploads/", "/api/files/uploads/");
  }
  return fileUrl;
}
