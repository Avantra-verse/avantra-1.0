// Phones: the share sheet with the image attached (Instagram, WhatsApp, Facebook…).
// Elsewhere, or if sharing isn't allowed: download the PNG.
export async function shareOrDownload(blob: Blob, filename: string, text: string) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      return await navigator.share({ files: [file], text });
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // they closed the share sheet
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
