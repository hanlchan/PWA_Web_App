import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "好友运动打卡",
    short_name: "运动打卡",
    description: "和好友一起制定运动计划、记录打卡进度。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0fdf4",
    theme_color: "#10b981",
    lang: "zh-CN",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
      {
        src: "/icons/maskable-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
