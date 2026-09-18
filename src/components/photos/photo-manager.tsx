"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProgressPhotoAction, deleteProgressPhotoAction, updateProgressPhotoVisibilityAction } from "@/lib/actions/photos";
import { prepareProgressPhoto } from "@/lib/images/progress-photo";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, validatePhotoFile } from "@/lib/validation/photo";

type Photo = {
  id: string;
  photo_date: string;
  note: string | null;
  visibility: "private" | "public";
  signed_url: string | null;
};

export function PhotoManager({
  photos,
  defaultVisibility,
  today,
}: {
  photos: Photo[];
  defaultVisibility: "private" | "public";
  today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const source = formData.get("photo");
    if (!(source instanceof File)) return setMessage("请选择图片");
    const validationError = validatePhotoFile(source);
    if (validationError) return setMessage(validationError);

    startTransition(async () => {
      const supabase = createClient();
      let storagePath: string | null = null;
      try {
        setMessage("正在压缩并清除照片位置等元数据…");
        const prepared = await prepareProgressPhoto(source);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("登录已失效，请重新登录");
        const extension = prepared.type === "image/webp" ? "webp" : "png";
        storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, prepared, { contentType: prepared.type, upsert: false });
        if (uploadError) throw new Error("照片上传失败，请稍后重试");

        const result = await createProgressPhotoAction({
          storagePath,
          photoDate: String(formData.get("photoDate") ?? ""),
          note: String(formData.get("note") ?? ""),
          visibility: formData.get("visibility") === "public" ? "public" : "private",
        });
        if (!result.ok) throw new Error(result.message);
        formRef.current?.reset();
        setMessage("照片已保存");
        router.refresh();
      } catch (error) {
        if (storagePath) await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
        setMessage(error instanceof Error ? error.message : "照片保存失败");
      }
    });
  }

  function remove(photoId: string) {
    if (!window.confirm("确定删除这张照片吗？删除后无法恢复。")) return;
    startTransition(async () => {
      const result = await deleteProgressPhotoAction(photoId);
      setMessage(result.ok ? "照片已删除" : result.message);
      if (result.ok) router.refresh();
    });
  }

  function changeVisibility(photo: Photo) {
    const visibility = photo.visibility === "private" ? "public" : "private";
    const warning = visibility === "public" ? "设为公开后，任何访问你公开主页的人都可以查看这张照片。确定继续吗？" : null;
    if (warning && !window.confirm(warning)) return;
    startTransition(async () => {
      const result = await updateProgressPhotoVisibilityAction(photo.id, visibility);
      setMessage(result.ok ? (visibility === "public" ? "照片已设为公开" : "照片已转为仅自己") : result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <form ref={formRef} onSubmit={submit} className="mt-6 space-y-4 rounded-3xl bg-white p-5">
        <div>
          <h2 className="font-bold">添加变化照片</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">支持 JPEG、PNG、WebP，原图最大 10 MB。上传前会缩放重编码，清除 EXIF 和 GPS 信息。</p>
        </div>
        <label className="block text-sm font-medium">选择照片<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={pending} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-4 file:py-3 file:font-semibold file:text-emerald-700" /></label>
        <label className="block text-sm font-medium">拍摄日期<input name="photoDate" type="date" required defaultValue={today} max={today} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" /></label>
        <label className="block text-sm font-medium">简短备注（可选）<textarea name="note" maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="记录这一阶段的感受" /></label>
        <label className="block text-sm font-medium">谁可以看<select name="visibility" defaultValue={defaultVisibility} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="private">仅自己</option><option value="public">公开主页可见</option></select></label>
        <button disabled={pending} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white disabled:opacity-50">{pending ? "处理中…" : "保存照片"}</button>
        {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
      </form>

      <section className="mt-7">
        <h2 className="font-bold">照片记录</h2>
        {photos.length === 0 ? (
          <div className="mt-3 rounded-3xl bg-white p-8 text-center text-sm text-slate-500">还没有照片记录</div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <article key={photo.id} className="overflow-hidden rounded-2xl bg-white">
                {photo.signed_url ? (
                  // Signed URLs are intentionally loaded directly and never sent through a persistent image optimizer cache.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.signed_url} alt={photo.note || `${photo.photo_date} 的变化照片`} className="aspect-[4/5] w-full object-cover" />
                ) : <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 text-xs text-slate-400">照片暂不可用</div>}
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2"><time className="text-xs font-semibold">{photo.photo_date}</time><span className={`rounded-full px-2 py-1 text-[10px] ${photo.visibility === "private" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{photo.visibility === "private" ? "仅自己" : "公开"}</span></div>
                  {photo.note && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{photo.note}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2"><button type="button" disabled={pending} onClick={() => changeVisibility(photo)} className="min-h-10 text-xs font-semibold text-emerald-700 disabled:opacity-50">{photo.visibility === "private" ? "设为公开" : "转为仅自己"}</button><button type="button" disabled={pending} onClick={() => remove(photo.id)} className="min-h-10 text-xs font-semibold text-rose-600 disabled:opacity-50">删除</button></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
