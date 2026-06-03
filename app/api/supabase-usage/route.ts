import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// DB size limits by Supabase plan in bytes
const PLAN_DB_LIMIT: Record<string, number> = {
  free: 500 * 1024 * 1024,
  pro: 8 * 1024 * 1024 * 1024,
  team: 8 * 1024 * 1024 * 1024,
};

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!accessToken || !projectRef) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // Fetch project (to get org ID) and DB size in parallel
  const [projectRes, sqlRes] = await Promise.all([
    fetch(`https://api.supabase.com/v1/projects/${projectRef}`, { headers }),
    fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "SELECT sum(pg_database_size(datname)) AS db_size_bytes FROM pg_database" }),
    }),
  ]);

  if (!projectRes.ok || !sqlRes.ok) {
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }

  const [project, rows] = await Promise.all([projectRes.json(), sqlRes.json()]);
  const used = Number(rows[0]?.db_size_bytes ?? 0);

  // Fetch org plan
  const orgRes = await fetch(`https://api.supabase.com/v1/organizations/${project.organization_id}`, { headers });
  const plan: string = orgRes.ok ? (await orgRes.json()).plan ?? "free" : "free";

  const limit = PLAN_DB_LIMIT[plan] ?? PLAN_DB_LIMIT.free;
  return NextResponse.json({ used, limit, plan });
}
