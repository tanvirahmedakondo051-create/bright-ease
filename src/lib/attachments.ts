import { toast } from "sonner";

export type Attachment = { name: string; kind: "text" | "image" | "pdf" | "video"; content: string };

export const MAX_ITEMS = 10;
const FILE_MAX = 20_000_000;
const TEXT_MAX = 300_000;
const TEXT_RE = /\.(py|txt|json|md|csv|html?|css|js|ts|tsx|jsx|ya?ml|toml|ini|cfg|env|example|log|xml|sql|sh)$/i;

function drawToJpeg(src: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(drawToJpeg(img, img.width, img.height)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

function videoFrames(file: File, count = 3): Promise<{ frames: string[]; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto"; v.playsInline = true;
    const frames: string[] = [];
    let i = 0;
    const done = () => { URL.revokeObjectURL(url); resolve({ frames, duration: v.duration || 0 }); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad video")); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.1, v.duration || 0); };
    v.onseeked = () => {
      try { frames.push(drawToJpeg(v, v.videoWidth, v.videoHeight)); } catch { /* skip */ }
      i++;
      if (i >= count || !v.duration) return done();
      v.currentTime = (v.duration * i) / count;
    };
    v.src = url;
  });
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
}

async function readZip(file: File): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  let out = "", skipped = 0;
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith("/") || path.includes("__MACOSX")) continue;
    if (!TEXT_RE.test(path) || bytes.length > TEXT_MAX) { skipped++; continue; }
    const chunk = `\n--- ${path}\n${strFromU8(bytes)}`;
    if (out.length + chunk.length > TEXT_MAX) { skipped++; continue; }
    out += chunk;
  }
  return out + (skipped ? `\n(${skipped}টি ফাইল পড়া যায়নি বা বেশি বড়)` : "");
}

export async function readAttachments(files: FileList | File[], existing: Attachment[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  let count = existing.length;
  for (const f of Array.from(files)) {
    if (count >= MAX_ITEMS) { toast.error(`সর্বোচ্চ ${MAX_ITEMS}টি জিনিস দেওয়া যাবে`); break; }
    if (f.size > FILE_MAX) { toast.error(`${f.name} — ২০ MB-এর বেশি`); continue; }
    try {
      if (f.type.startsWith("image/")) out.push({ name: f.name, kind: "image", content: await resizeImage(f) });
      else if (f.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(f.name)) {
        const { frames, duration } = await videoFrames(f);
        if (!frames.length) throw new Error("no frames");
        out.push({ name: `${f.name} (${Math.round(duration)}s)`, kind: "video", content: JSON.stringify(frames) });
      } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        if (f.size > 8_000_000) { toast.error(`${f.name} — PDF ৮ MB-এর বেশি`); continue; }
        out.push({ name: f.name, kind: "pdf", content: await readDataUrl(f) });
      } else if (/\.zip$/i.test(f.name)) out.push({ name: f.name, kind: "text", content: await readZip(f) });
      else if (TEXT_RE.test(f.name) || f.type.startsWith("text/")) {
        if (f.size > TEXT_MAX) { toast.error(`${f.name} — টেক্সট ফাইল ৩০০ KB-এর বেশি`); continue; }
        out.push({ name: f.name, kind: "text", content: await f.text() });
      } else { out.push({ name: f.name, kind: "text", content: `(এই ফাইলটি পড়া যায় না — শুধু নাম: ${f.name}, ${Math.round(f.size / 1024)} KB)` }); }
      count++;
    } catch { toast.error(`${f.name} পড়া যায়নি`); }
  }
  return out;
}
