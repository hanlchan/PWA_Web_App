"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, progressPhotoRecordSchema } from "@/lib/validation/photo";
import type { ActionResult } from "./result";

export async function createProgressPhotoAction(input: unknown): Promise<ActionResult> {
  const parsed = progressPhotoRecordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "照片记录无效" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "登录已失效" };
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) return { ok: false, message: "照片路径与当前用户不匹配" };

  const filename = parsed.data.storagePath.slice(user.id.length + 1);
  const { data: uploaded, error: storageError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list(user.id, { limit: 2, search: filename });
  if (storageError || !uploaded?.some((object) => object.name === filename)) {
    return { ok: false, message: "找不到已上传的照片文件" };
  }

  const { error } = await supabase.from("progress_photos").insert({
    user_id: user.id,
    storage_path: parsed.data.storagePath,
    photo_date: parsed.data.photoDate,
    note: parsed.data.note || null,
    visibility: parsed.data.visibility,
  });
  if (error) return { ok: false, message: "照片记录保存失败" };

  revalidatePath("/photos");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}

export async function deleteProgressPhotoAction(photoId: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return { ok: false, message: "照片编号无效" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "登录已失效" };

  const { data: photo, error: readError } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !photo) return { ok: false, message: "照片不存在或无权删除" };

  const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (storageError) return { ok: false, message: "照片文件删除失败，请稍后重试" };
  const { error: rowError } = await supabase.from("progress_photos").delete().eq("id", photoId).eq("user_id", user.id);
  if (rowError) return { ok: false, message: "照片记录删除失败，请稍后重试" };

  revalidatePath("/photos");
  revalidatePath("/me");
  return { ok: true, data: undefined };
}

export async function updateProgressPhotoVisibilityAction(
  photoId: string,
  visibility: "private" | "public",
): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(photoId) || !["private", "public"].includes(visibility)) {
    return { ok: false, message: "照片设置无效" };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "登录已失效" };
  const { data, error } = await supabase
    .from("progress_photos")
    .update({ visibility })
    .eq("id", photoId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "照片公开范围更新失败" };
  revalidatePath("/photos");
  revalidatePath("/u/[username]", "page");
  return { ok: true, data: undefined };
}
