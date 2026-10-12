// Plan Sessions API — Lovable-style intake (INTAKE → PLAN → APPROVE → BUILD)
// Dynamic questions: AI analyzes prompt, finds gaps, asks about those gaps.

// mapAnswersToSpec — copied from generate.ts (avoid cross-file import issues)
function mapAnswersToSpec(answers: Record<string, string[]>): any {
  const spec: any = { routes: [], entities: [], admin: { actions: [] }, i18n: false, design: {} };
  const pages = answers.pages ?? [];
  const admin = answers.admin ?? [];
  const design = answers.design?.[0] ?? "dark";
  const lang = answers.lang?.[0] ?? "en";

  // Pages → routes + entities
  if (pages.includes("team")) {
    spec.routes.push({ path: "/team", name: "Team" });
    spec.entities.push({ name: "team_members", fields: ["id", "name", "role", "skills", "photo", "social"] });
  }
  if (pages.includes("courses")) {
    spec.routes.push({ path: "/courses", name: "Courses" }, { path: "/courses/:id", name: "Course Detail" });
    spec.entities.push({ name: "courses", fields: ["id", "title", "desc", "duration", "level"] });
  }
  if (pages.includes("blog")) {
    spec.routes.push({ path: "/blog", name: "Blog" }, { path: "/blog/:id", name: "Article" });
    spec.entities.push({ name: "posts", fields: ["id", "title", "content", "author", "published_at"] });
  }
  if (pages.includes("contact")) {
    spec.routes.push({ path: "/contact", name: "Contact" });
    spec.entities.push({ name: "contact_messages", fields: ["id", "name", "email", "message", "read", "created_at"] });
  }
  // Ecommerce
  if (pages.includes("products")) {
    spec.routes.push({ path: "/products", name: "Products" }, { path: "/products/:id", name: "Product Detail" });
    spec.entities.push({ name: "products", fields: ["id", "name", "price", "image", "desc", "stock"] });
  }
  if (pages.includes("cart")) {
    spec.routes.push({ path: "/cart", name: "Cart" }, { path: "/checkout", name: "Checkout" });
    spec.entities.push({ name: "orders", fields: ["id", "user_id", "items", "total", "status"] });
  }

  // Admin scope → admin actions
  if (admin.includes("all_content") || admin.includes("content")) {
    spec.admin.actions.push("crud_all");
    spec.routes.push({ path: "/admin", name: "Admin Dashboard" });
  }
  if (admin.includes("inbox") || admin.includes("requests")) {
    spec.admin.actions.push("manage_inbox");
    spec.entities.push({ name: "join_requests", fields: ["id", "name", "email", "message", "status"] });
  }
  if (admin.includes("users") || admin.includes("student_login")) {
    spec.admin.actions.push("manage_users");
    spec.routes.push({ path: "/admin/users", name: "User Management" });
  }
  if (admin.includes("student_login")) {
    spec.routes.push({ path: "/student", name: "Student Dashboard" });
    spec.auth = { roles: ["admin", "student"] };
  }

  // Language → i18n
  if (lang === "both") {
    spec.i18n = true;
    spec.i18nLanguages = ["en", "bn"];
  } else {
    spec.i18n = false;
    spec.language = lang;
  }

  // Design
  spec.design = { theme: design };

  console.log(`[plan] Mapped answers to spec: ${spec.routes.length} routes, ${spec.entities.length} entities`);
  return spec;
}

interface PlanQuestion {
  q: string;
  options: string[];
  multi?: boolean;
}

interface StartBody {
  prompt: string;
  projectId?: string;
  userId: string;
}

interface AnswerBody {
  sessionId: string;
  answers: Record<string, string[]>;
}

// POST /api/plan/start — create session + generate dynamic questions
export async function planStart(db: any, body: StartBody, llmCall: (sys: string, user: string) => Promise<string>) {
  const { prompt, projectId, userId } = body;
  if (!prompt?.trim() || !userId) {
    return { error: "prompt and userId required" };
  }

  // Create session
  const { data: session, error } = await db.from("plan_sessions").insert({
    project_id: projectId ?? null,
    user_id: userId,
    prompt: prompt.trim(),
    status: "intake",
    current_step: 1,
    answers_json: {},
  }).select().single();

  if (error) return { error: "Failed to create plan session: " + error.message };

  // Generate dynamic questions via AI (gap analysis)
  const sys = `You are planning a website. The user gave a SHORT prompt. Find what's MISSING — what info would help build a MUCH better site?

Analyze the prompt and identify 2-4 gaps. For each gap, write one question in Bangla with 3-4 quick answer options.

Examples:
- "restaurant website" → ask: menu items? location? online order/delivery?
- "portfolio site" → ask: skills? project details? contact info?
- "cyber team site" → ask: team members? services? achievements?

NEVER ask about: backend, database, tech stack, hosting (all built-in).
Output ONLY JSON: {"questions": [{"q": "...", "options": ["...", "...", "..."], "multi": false}]}`;

  let questions: PlanQuestion[] = [];
  try {
    const raw = await llmCall(sys, `Website request: ${prompt.trim()}`);
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    questions = parsed.questions ?? [];
  } catch (e) {
    console.error("[plan] question generation failed", e);
  }

  // Save question set for audit
  await db.from("plan_sessions").update({
    question_set: { questions },
    total_steps: Math.max(1, questions.length),
  }).eq("id", session.id);

  return { sessionId: session.id, questions, totalSteps: questions.length };
}

// POST /api/plan/answer — save answers
export async function planAnswer(db: any, body: AnswerBody) {
  const { sessionId, answers } = body;
  if (!sessionId || !answers) return { error: "sessionId and answers required" };

  const { data: session } = await db.from("plan_sessions").select("answers_json, status").eq("id", sessionId).single();
  if (!session) return { error: "Session not found" };
  if ((session as any).status !== "intake") return { error: "Session not in intake state" };

  const merged = { ...(session as any).answers_json, ...answers };
  await db.from("plan_sessions").update({
    answers_json: merged,
    status: "generating",
  }).eq("id", sessionId);

  return { ok: true, answers: merged };
}

// POST /api/plan/generate — answers → spec + plan markdown
export async function planGenerate(db: any, sessionId: string) {
  const { data: session } = await db.from("plan_sessions").select("*").eq("id", sessionId).single();
  if (!session) return { error: "Session not found" };

  const s = session as any;
  const answers: Record<string, string[]> = s.answers_json ?? {};

  // Map answers → spec (deterministic rules)
  const spec = mapAnswersToSpec(answers);

  // Build human-readable plan markdown
  const pages = answers.pages ?? [];
  const admin = answers.admin ?? [];
  const design = answers.design?.[0] ?? "default";
  const lang = answers.lang?.[0] ?? "en";

  const planMarkdown = `## প্ল্যান সারাংশ
**মূল অনুরোধ:** ${s.prompt}

**পেজ/সেকশন:** ${pages.length ? pages.join(", ") : "—"}
**Admin scope:** ${admin.length ? admin.join(", ") : "basic content CRUD"}
**ডিজাইন:** ${design}
**ভাষা:** ${lang}

**Routes:** ${spec.routes.map((r: any) => r.path).join(", ") || "—"}
**Entities:** ${spec.entities.map((e: any) => e.name).join(", ") || "—"}
`;

  // Simple checksum
  const specStr = JSON.stringify(spec);
  let hash = 0;
  for (let i = 0; i < specStr.length; i++) {
    hash = ((hash << 5) - hash + specStr.charCodeAt(i)) | 0;
  }

  await db.from("plan_sessions").update({
    plan_markdown: planMarkdown,
    spec_json: spec,
    spec_checksum: "spec_" + Math.abs(hash).toString(36),
    spec_version: 1,
    status: "ready",
  }).eq("id", sessionId);

  return { planMarkdown, spec, status: "ready" };
}

// POST /api/plan/approve — approve → copy to project
export async function planApprove(db: any, sessionId: string, projectId: string) {
  const { data: session } = await db.from("plan_sessions").select("*").eq("id", sessionId).single();
  if (!session) return { error: "Session not found" };

  const s = session as any;
  if (s.status !== "ready") return { error: "Plan not ready for approval" };
  if (!s.spec_json) return { error: "No spec generated" };

  // Copy to project
  const { error: projErr } = await db.from("projects").update({
    plan_session_id: sessionId,
    plan_answers: s.answers_json,
    spec_json: s.spec_json,
    spec_checksum: s.spec_checksum,
    spec_version: 1,
  }).eq("id", projectId);

  if (projErr) return { error: "Failed to update project: " + projErr.message };

  await db.from("plan_sessions").update({
    status: "approved",
    project_id: projectId,
    approved_at: new Date().toISOString(),
  }).eq("id", sessionId);

  return { ok: true, status: "approved", buildQueued: true };
}

// POST /api/plan/cancel
export async function planCancel(db: any, sessionId: string) {
  await db.from("plan_sessions").update({ status: "cancelled" }).eq("id", sessionId);
  return { ok: true };
}
