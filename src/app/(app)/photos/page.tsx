import { PhotoManager } from "@/components/photos/photo-manager";
import { getPrivateProgressPhotos } from "@/lib/queries/photos";
import { getPrivateProfile } from "@/lib/queries/profile";

function todayInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export default async function PhotosPage() {
  const [photos, profile] = await Promise.all([getPrivateProgressPhotos(), getPrivateProfile()]);
  if (!profile) return null;
  const defaultVisibility = profile.settings.photo_default_visibility === "public" ? "public" : "private";

  return (
    <main>
      <h1 className="text-2xl font-bold">我的变化</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">照片按拍摄日期倒序排列。所有文件都存放在私有空间，并通过短时地址查看。</p>
      <PhotoManager photos={photos} defaultVisibility={defaultVisibility} today={todayInTimezone(profile.settings.timezone)} />
    </main>
  );
}
