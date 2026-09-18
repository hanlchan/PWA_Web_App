type PublicPhoto = {
  id: string;
  photo_date: string;
  note: string | null;
  signed_url: string | null;
};

export function PublicPhotoGrid({ photos }: { photos: PublicPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <section className="mt-6 rounded-3xl bg-white p-5">
      <h2 className="font-bold">公开变化记录</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-2xl border border-slate-100">
            {photo.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.signed_url} alt={photo.note || `${photo.photo_date} 的公开变化照片`} className="aspect-[4/5] w-full object-cover" />
            ) : <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 text-xs text-slate-400">照片暂不可用</div>}
            <div className="p-3"><time className="text-xs font-semibold">{photo.photo_date}</time>{photo.note && <p className="mt-1 text-xs leading-5 text-slate-600">{photo.note}</p>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
