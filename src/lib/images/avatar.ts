const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareAvatar(file: File): Promise<File> {
  if (!ALLOWED.has(file.type)) throw new Error("仅支持 JPEG、PNG 或 WebP");
  if (file.size > 5 * 1024 * 1024) throw new Error("头像不能超过 5MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("头像处理失败")), "image/webp", 0.86));
  return new File([blob], "avatar.webp", { type: "image/webp" });
}
