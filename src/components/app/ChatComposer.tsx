import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, ChevronDown, Mic, MicOff, ArrowUp, Loader2, Paperclip, Palette, Sparkles, Hammer, ClipboardList, Check, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export type Chip = { label: string; icon?: ReactNode; onClick: () => void };

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  mode: "plan" | "build";
  onMode: (m: "plan" | "build") => void;
  chips: Chip[];
  busy: boolean;
  canSend: boolean;
  onUpload: () => void;
  onAssets: () => void;
  onPasteFiles: (f: FileList) => void;
  top?: ReactNode;
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  onStop?: () => void;
};

export function ChatComposer(p: Props) {
  const [menu, setMenu] = useState(false);
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const recRef = useRef<any>(null);
  useEffect(() => { setMicOk(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);

  const autosize = () => { const t = p.taRef.current; if (!t) return; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; };
  useEffect(autosize, [p.value]);

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "bn-BD"; r.interimResults = false; r.continuous = false;
    const base = p.value;
    r.onresult = (e: any) => { const t = [...e.results].map((x: any) => x[0].transcript).join(" "); p.onChange((base ? base + " " : "") + t); };
    r.onerror = () => toast.error("ভয়েস শোনা যায়নি");
    r.onend = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };

  return (
    <div className="w-full min-w-0">
      {!!p.chips.length && (
        <div className="mb-2 flex w-full min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {p.chips.map((c, i) => (
            <button key={i} onClick={c.onClick} disabled={p.busy} className="flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/70 px-4 text-sm hover:border-cyan disabled:opacity-50">
              {c.icon}{c.label}
            </button>
          ))}
        </div>
      )}
      {p.top}
      <div className="w-full min-w-0 rounded-[28px] border border-input bg-card p-2.5 shadow-lg focus-within:border-cyan/70">
        <textarea
          ref={p.taRef}
          rows={2}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); p.onPasteFiles(e.clipboardData.files); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); p.onSend(); } }}
          placeholder={p.mode === "plan" ? "আইডিয়া নিয়ে আলোচনা করুন..." : "Hexa AI-কে বলুন কী বানাতে চান..."}
          className="max-h-[200px] min-h-14 w-full resize-none bg-transparent px-3 pt-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1">
          <Popover open={menu} onOpenChange={setMenu}>
            <PopoverTrigger asChild>
              <button className="grid size-11 shrink-0 place-items-center rounded-full border border-border hover:bg-accent" aria-label="আরও"><Plus className="size-5" /></button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-56 p-1">
              {[
                { l: "ছবি / ফাইল আপলোড", i: <Paperclip className="size-4" />, f: p.onUpload },
                { l: "অ্যাসেট লাইব্রেরি", i: <Palette className="size-4" />, f: p.onAssets },
              ].map((x) => (
                <button key={x.l} onClick={() => { setMenu(false); x.f(); }} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-accent">{x.i}{x.l}</button>
              ))}
            </PopoverContent>
          </Popover>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border px-4 text-sm font-medium hover:bg-accent ${p.mode === "plan" ? "text-cyan" : ""}`}>
                  {p.mode === "plan" ? "প্ল্যান" : "বিল্ড"}<ChevronDown className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => p.onMode("build")} className="min-h-12 items-start gap-2">
                  <Hammer className="mt-0.5 size-4" /><div className="flex-1"><p className="font-medium">বিল্ড</p><p className="text-xs text-muted-foreground">সরাসরি ওয়েবসাইট বানাবে/বদলাবে</p></div>{p.mode === "build" && <Check className="size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => p.onMode("plan")} className="min-h-12 items-start gap-2">
                  <ClipboardList className="mt-0.5 size-4" /><div className="flex-1"><p className="font-medium">প্ল্যান</p><p className="text-xs text-muted-foreground">আগে আলোচনা, সাইট বদলাবে না</p></div>{p.mode === "plan" && <Check className="size-4" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {micOk && (listening || !p.canSend) && (
              <button onClick={toggleMic} className={`grid size-11 shrink-0 place-items-center rounded-full border border-border hover:bg-accent ${listening ? "animate-pulse text-cyan" : ""}`} aria-label="ভয়েস">
                {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
            )}
            {p.busy && p.onStop ? (
              <button onClick={p.onStop} className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background" aria-label="থামান"><Square className="size-4 fill-current" /></button>
            ) : (p.canSend || p.busy || !micOk) && <button onClick={p.onSend} disabled={p.busy || !p.canSend} className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-30" aria-label="পাঠান">
              {p.busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
            </button>}
          </div>
        </div>
      </div>
    </div>
  );
}
