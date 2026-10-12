import { toast } from "sonner";

export type Attachment = { name: string; kind: "text" | "image"; content: string };

const TEXT_MAX = 300_000;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

export async function readAttachments(files: FileList | File[], existing: Attachment[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  let images = existing.filter((a) => a.kind === "image").length;
  for (const f of Array.from(files)) {
    if (f.type.startsWith("image/")) {
      if (images >= 3) { toast.error("সর্বোচ্চ ৩টি ছবি দেওয়া যাবে"); continue; }
      if (f.size > 4_000_000) { toast.error(`${f.name} — ছবি ৪ MB-এর বেশি`); continue; }
      try { out.push({ name: f.name, kind: "image", content: await resizeImage(f) }); images++; } catch { toast.error(`${f.name} পড়া যায়নি`); }
    } else if (/\.(py|txt|json|md)$/i.test(f.name)) {
      if (f.size > TEXT_MAX) { toast.error(`${f.name} — ফাইল ৩০০ KB-এর বেশি`); continue; }
      out.push({ name: f.name, kind: "text", content: await f.text() });
    } else toast.error(`${f.name} — শুধু .py, .txt, .json, .md বা ছবি দেওয়া যাবে`);
  }
  return out;
}
