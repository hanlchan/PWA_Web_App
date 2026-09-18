# 照片存储部署与验证

迁移 `0012_progress_photos.sql` 会创建 `progress_photos` 表和私有 `progress-photos` Storage bucket。无需在 Dashboard 手工把 bucket 改成公开；它必须始终保持 Private。

## 安全模型

- 原图最大 10 MB，只接受 JPEG、PNG、WebP。
- 浏览器在上传前将图片缩放到最长边不超过 2048 px，并通过 Canvas 重编码。重编码后的新文件不携带原始 EXIF，因此不会保留 EXIF GPS。
- 文件路径固定为 `<当前用户 UUID>/<随机 UUID>.<扩展名>`，Storage 写入和删除策略都校验首级目录等于 `auth.uid()`。
- 照片记录默认 `private`。仅本人可读取私密照片元数据和生成 Signed URL。
- 只有显式标为 `public` 的照片才能通过公开主页查询，并由私有 bucket 生成 10 分钟有效的 Signed URL。
- Signed URL 直接由浏览器加载，不进入长期图片优化缓存。

## 部署后验证

1. 执行全部迁移、数据库 lint 和 pgTAP。
2. 用用户 A 上传一张含 EXIF/GPS 的测试图片，确认 Storage 中保存的是重新编码后的 WebP/PNG。
3. 保持照片为“仅自己”，用匿名窗口和用户 B 确认无法读取元数据、无法生成或访问 Signed URL。
4. 将照片设为“公开”，确认公开主页可在 Signed URL 有效期内显示。
5. 将照片重新设为私密或删除，确认旧 Signed URL 最多只在其剩余有效期内存在；对高敏感照片不要设为公开。
6. 确认 bucket 的 `public` 字段仍为 `false`，文件大小限制为 10485760，MIME 白名单仅含 JPEG、PNG、WebP。

数据库和 Storage 策略只有在真实 Supabase 测试项目执行后才能视为已验证。本地静态检查不等同于后端实测。
