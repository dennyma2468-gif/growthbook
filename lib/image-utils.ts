// lib/image-utils.ts — Resize photos for upload (handles iPhone HEIC)

export async function resizeAndEncode(
  file: File,
  maxSize = 1024,
  quality = 0.85
): Promise<string> {
  // createImageBitmap works with HEIC on iOS Safari (Image() often fails)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return encodeBitmap(bitmap, maxSize, quality);
      } finally {
        bitmap.close();
      }
    } catch {
      // fall through to FileReader path
    }
  }

  return encodeViaDataUrl(file, maxSize, quality);
}

function encodeBitmap(
  bitmap: ImageBitmap,
  maxSize: number,
  quality: number
): string {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Could not encode image");
  return base64;
}

function encodeViaDataUrl(
  file: File,
  maxSize: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(
        new Error(
          "Could not read this photo. Try a JPG/PNG, or pick from Photos app again."
        )
      );
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(
          new Error(
            "Could not open this photo format. Save as JPG in Photos, then retry."
          )
        );
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas not supported"));
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64 = dataUrl.split(",")[1];
          if (!base64) return reject(new Error("Could not encode image"));
          resolve(base64);
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Could not process image"));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
