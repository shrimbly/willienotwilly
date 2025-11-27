import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMIT_WINDOW_MINUTES = 5;
const MAX_VOTES_PER_WINDOW = 14;

function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

async function checkRateLimit(
  supabase: SupabaseClient,
  ip: string,
  model: string
): Promise<boolean> {
  // Check how many votes this IP has made for this model in the last N minutes
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count, error } = await supabase
    .from("rock_votes")
    .select("*", { count: "exact", head: true })
    .eq("model", model)
    .eq("voter_ip", ip)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    // Allow the vote if we can't check rate limit (fail open)
    return true;
  }

  return (count ?? 0) < MAX_VOTES_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    if (!supabase) {
      console.error("Supabase environment variables are not configured");
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { model, first_not_rock } = body;

    // Validate input
    if (!model || typeof first_not_rock !== "number") {
      return NextResponse.json(
        { error: "Invalid input: model and first_not_rock are required" },
        { status: 400 }
      );
    }

    if (first_not_rock < 0 || first_not_rock > 100) {
      return NextResponse.json(
        { error: "Invalid input: first_not_rock must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Get identifier for rate limiting (IP address or fallback)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    // Check rate limit using database
    const withinLimit = await checkRateLimit(supabase, ip, model);
    if (!withinLimit) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. You can only vote ${MAX_VOTES_PER_WINDOW} times per ${RATE_LIMIT_WINDOW_MINUTES} minutes.`,
          rateLimited: true,
        },
        { status: 429 }
      );
    }

    // Insert vote into Supabase (including IP for rate limiting)
    const { error } = await supabase.from("rock_votes").insert([
      {
        model,
        first_not_rock,
        voter_ip: ip,
      },
    ]);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to submit vote" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Vote submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
