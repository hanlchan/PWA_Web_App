import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/validation/photo";

export type ProgressPhoto = {
  id: string;
  storage_path: string;
  photo_date: string;
  note: string | null;
  visibility: "private" | "public";
  created_at: string;
  signed_url: string | null;
};

type PhotoMetadata = Omit<ProgressPhoto, "signed_url">;

async function attachSignedUrls(photos: PhotoMetadata[]) {
  if (photos.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(photos.map((photo) => photo.storage_path), 600);
  if (error) throw new Error("无法生成照片临时访问地址");
  const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl ?? null]));
  return photos.map((photo) => ({ ...photo, signed_url: urls.get(photo.storage_path) ?? null }));
}

export async function getPrivateProgressPhotos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("progress_photos")
    .select("id,storage_path,photo_date,note,visibility,created_at")
    .eq("user_id", user.id)
    .order("photo_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("无法读取照片记录");
  return attachSignedUrls((data ?? []) as PhotoMetadata[]);
}

export async function getPublicProgressPhotos(username: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_progress_photos", { p_username: username });
  if (error) throw new Error("无法读取公开照片");
  const photos = (data ?? []).map((photo) => ({ ...photo, visibility: "public" as const })) as PhotoMetadata[];
  return attachSignedUrls(photos);
}
