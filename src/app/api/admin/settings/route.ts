import { NextResponse } from "next/server";
import { checkSuperAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function GET() {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("system_settings")
      .select("key, value");

    if (error) throw error;

    // Convert list to key-value object
    const settings: Record<string, any> = {};
    data?.forEach((row: any) => {
      settings[row.key] = row.value;
    });

    return NextResponse.json(settings);
  } catch (err: unknown) {
    console.error("[GET /api/admin/settings] error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isSuper = await checkSuperAdmin();
    if (!isSuper) {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { landing_hero_video_url, landing_action_video_url } = body;

    const db = supabaseAdmin();

    const upserts = [];
    if (typeof landing_hero_video_url === "string") {
      upserts.push({ key: "landing_hero_video_url", value: landing_hero_video_url });
    }
    if (typeof landing_action_video_url === "string") {
      upserts.push({ key: "landing_action_video_url", value: landing_action_video_url });
    }

    if (upserts.length > 0) {
      const { error } = await db
        .from("system_settings")
        .upsert(upserts, { onConflict: "key" });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[POST /api/admin/settings] error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
