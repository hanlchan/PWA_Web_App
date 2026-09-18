import { z } from "zod";

export const PHOTO_BUCKET = "progress-photos";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const ownedStoragePath = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f-]{36}\.(?:jpe?g|png|webp)$/i;

export const progressPhotoRecordSchema = z.object({
  storagePath: z.string().max(300).regex(ownedStoragePath, "照片路径无效"),
  photoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "拍摄日期无效"),
  note: z.string().trim().max(500, "备注不能超过 500 字").optional().default(""),
  visibility: z.enum(["private", "public"]).default("private"),
}).strict();

export function validatePhotoFile(file: Pick<File, "size" | "type">) {
  if (!PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) {
    return "只支持 JPEG、PNG 或 WebP 图片";
  }
  if (file.size <= 0) return "图片内容为空";
  if (file.size > MAX_PHOTO_BYTES) return "原图不能超过 10 MB";
  return null;
}
