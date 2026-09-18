import { MAX_PHOTO_BYTES, validatePhotoFile } from "@/lib/validation/photo";

const MAX_DIMENSION = 2048;

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareProgressPhoto(file: File) {
  const validationError = validatePhotoFile(file);
  if (validationError) throw new Error(validationError);

  let decoded: ImageBitmap | HTMLImageElement;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error("无法读取这张图片，请换一张 JPEG、PNG 或 WebP 图片");
  }

  const sourceWidth = decoded.width;
  const sourceHeight = decoded.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("当前浏览器无法处理图片");
  context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
  if ("close" in decoded && typeof decoded.close === "function") decoded.close();

  // Canvas re-encoding deliberately drops EXIF, including embedded GPS data.
  let quality = 0.84;
  let blob = await canvasBlob(canvas, "image/webp", quality);
  while (blob && blob.size > MAX_PHOTO_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasBlob(canvas, "image/webp", quality);
  }
  if (!blob || blob.size > MAX_PHOTO_BYTES) throw new Error("压缩后图片仍超过 10 MB，请选择更小的图片");

  const type = blob.type === "image/webp" ? "image/webp" : "image/png";
  const extension = type === "image/webp" ? "webp" : "png";
  return new File([blob], `progress-photo.${extension}`, { type, lastModified: Date.now() });
}
