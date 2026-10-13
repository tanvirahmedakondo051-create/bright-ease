// Full cumulative SQL dump: schema (all migrations) + every row of auth users and every public table.
// Restore on a fresh Postgres/Supabase: psql "$DB_URL" -f hexa_backup.sql
const migrations = import.meta.glob("/supabase/migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const tag = (s: string) => { let t = "hx"; while (s.includes(`$${t}$`)) t += "x"; return `$${t}$`; };
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

function inserts(table: string, rows: unknown[]): string {
  let out = "";
  for (let i = 0; i < rows.length; i += 200) {
    const json = JSON.stringify(rows.slice(i, i + 200)); const d = tag(json);
    out += `insert into ${table} select * from json_populate_recordset(null::${table}, ${d}${json}${d}::json) on conflict do nothing;\n`;
  }
  return out;
}

export async function buildSqlBackup(db: any): Promise<{ sql: string; tables: number; rows: number }> {
  const parts: string[] = [`-- Hexa AI full backup ${new Date().toISOString()}\n-- Contains ALL data since day one. Restore: psql "$DATABASE_URL" -f this_file.sql\n`];
  parts.push("-- ===== SCHEMA =====");
  for (const k of Object.keys(migrations).sort()) parts.push(`-- ${k.split("/").pop()}\n${migrations[k]}\n`);
  parts.push("-- ===== DATA =====\nset session_replication_role = replica;\n");
  let rows = 0;
  const { data: auth, error: ae } = await db.rpc("backup_auth_rows");
  if (ae) throw new Error("auth: " + ae.message);
  parts.push(inserts("auth.users", auth?.users ?? []), inserts("auth.identities", auth?.identities ?? []));
  rows += (auth?.users?.length ?? 0) + (auth?.identities?.length ?? 0);
  const { data: tables, error: te } = await db.rpc("backup_table_list");
  if (te) throw new Error("tables: " + te.message);
  for (const t of (tables ?? []) as string[]) {
    const all: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select("*").range(from, from + 999);
      if (error) throw new Error(`${t}: ${error.message}`);
      all.push(...(data ?? [])); if (!data || data.length < 1000) break;
    }
    rows += all.length;
    parts.push(`-- ${t} (${all.length})\n` + inserts(`public.${q(t)}`, all));
  }
  parts.push("set session_replication_role = origin;\n-- END\n");
  return { sql: parts.join("\n"), tables: (tables ?? []).length, rows };
}

export async function sendBackupToTelegram(db: any): Promise<{ ok: true; rows: number } | { error: string }> {
  const { data: s } = await db.from("app_secrets").select("name,value").in("name", ["backup_bot_token", "backup_chat_id"]);
  const get = (n: string) => s?.find((r: any) => r.name === n)?.value ?? "";
  const token = get("backup_bot_token"), chat = get("backup_chat_id");
  if (!token || !chat) return { error: "Backup bot token ও chat ID সেট করা নেই" };
  const { sql, rows, tables } = await buildSqlBackup(db);
  const { gzipSync, strToU8 } = await import("fflate");
  const gz = gzipSync(strToU8(sql), { level: 9 });
  if (gz.byteLength > 49_000_000) return { error: "ব্যাকআপ ৫০MB-এর বেশি — অ্যাডমিন থেকে ডাউনলোড করুন" };
  const date = new Date().toISOString().slice(0, 10);
  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", `🗄 Hexa AI full backup ${date}\n${tables} tables, ${rows} rows (শুরু থেকে আজ পর্যন্ত সব ডাটা)\nRestore: gunzip, then psql -f`);
  form.append("document", new Blob([gz], { type: "application/gzip" }), `hexa_backup_${date}.sql.gz`);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) return { error: `Telegram: ${j.description ?? r.status}` };
  return { ok: true, rows };
}
