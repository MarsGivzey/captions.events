import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch quota" }, { status: response.status });
  }

  const data = await response.json();
  return NextResponse.json({
    used: data.character_count,
    limit: data.character_limit,
    remaining: data.character_limit - data.character_count,
  });
}
