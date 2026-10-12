// Edit Mode System — Lovable-style scoped fixes
// 1. Intent classifier | 2. Brain schema | 3. Patch-only prompt

// ============ 1. INTENT CLASSIFIER ============
export type BuildIntent = "fix" | "edit" | "extend" | "greenfield";

export function classifyIntent(prompt: string): BuildIntent {
  const p = prompt.toLowerCase();
  const fixWords = /fix|broken|hang|stuck|not working|error|bug|crash|blank|401|403|500|thik koro|somossha|somossa/i;
  const editWords = /change text|change color|rename|update text|edit/i;
  const extendWords = /add page|add feature|new section|extend/i;
  const rebuildWords = /rebuild|scratch|notun kore|fresh/i;

  if (rebuildWords.test(p)) return "greenfield";
  if (fixWords.test(p)) return "fix";
  if (editWords.test(p)) return "edit";
  if (extendWords.test(p)) return "extend";
  return "greenfield";
}

export function shouldUseEditMode(prompt: string, hasExistingFiles: boolean): boolean {
  if (!hasExistingFiles) return false;
  const intent = classifyIntent(prompt);
  return intent === "fix" || intent === "edit" || intent === "extend";
}

// ============ 2. BRAIN SCHEMA ============
export interface ProjectBrain {
  designTokens: {
    bg: string;
    primary: string;
    accent: string;
    fontDisplay: string;
    fontMono: string;
  };
  routes: Record<string, string>;
  locked: string[];
  entities: string[];
  lastGoodVersion: string;
}

export function buildBrain(files: Record<string, string>, spec: any): ProjectBrain {
  return {
    designTokens: {
      bg: spec?.design?.bg ?? "#0A0A0A",
      primary: spec?.design?.primary ?? "#00FF88",
      accent: spec?.design?.accent ?? "#06FFA5",
      fontDisplay: spec?.design?.fontDisplay ?? "Space Grotesk",
      fontMono: spec?.design?.fontMono ?? "JetBrains Mono",
    },
    routes: {},
    locked: [
      "src/index.css",
      "tailwind.config.js",
      "src/components/Layout.tsx",
    ],
    entities: spec?.entities?.map((e: any) => e.name) ?? [],
    lastGoodVersion: "v1",
  };
}

// ============ 3. PATCH-ONLY SYSTEM PROMPT ============
export const EDIT_MODE_SYS = [
  "You are in EDIT/FIX mode. The site already exists.",
  "",
  "ABSOLUTE RULES:",
  "1. Output ONLY patches for the files listed in the impact map.",
  "2. NEVER regenerate Home, global CSS, tailwind config, or design tokens",
  "   unless the user explicitly asked to change design.",
  "3. Preserve existing class names, color variables, and layout structure.",
  "4. If admin was requested: only touch admin/* and related API/RLS.",
  "5. Prefer minimal diff. Do not rewrite a whole file if 10 lines are enough.",
  "6. If you need a new file, create it; do not recreate existing working files.",
  "7. After changes, list: files_changed[], files_untouched[],",
  "   design_tokens_unchanged: true/false",
].join("\n");

// ============ IMPACT ANALYSIS ============
export interface ImpactMap {
  allow: string[];
  forbidden: string[];
}

export function buildImpactMap(prompt: string, brain: ProjectBrain): ImpactMap {
  const p = prompt.toLowerCase();
  const allow: string[] = [];
  const forbidden: string[] = [...brain.locked];

  if (/admin/i.test(p)) {
    allow.push("src/pages/admin/**", "src/routes/api/admin/**");
  }
  if (/enroll/i.test(p)) {
    allow.push("src/**/Enroll*");
  }
  if (/login|auth/i.test(p)) {
    allow.push("src/**/Login*", "src/**/Auth*");
  }
  if (/contact|message/i.test(p)) {
    allow.push("src/**/Contact*", "src/**/Message*");
  }
  if (/course/i.test(p)) {
    allow.push("src/**/Course*");
  }

  return { allow, forbidden };
}
