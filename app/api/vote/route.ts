import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// In-memory rate limiting store (resets on server restart)
// For production, consider using Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_VOTES_PER_WINDOW = 14; // Max 14 votes per 5 minutes

function getRateLimitKey(identifier: string, model: string): string {
  return `${identifier}:${model}`;
}

function checkRateLimit(identifier: string, model: string): boolean {
  const key = getRateLimitKey(identifier, model);
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= MAX_VOTES_PER_WINDOW) {
    return false;
  }

  record.count++;
  rateLimitStore.set(key, record);
  return true;
}

export async function POST(request: NextRequest) {
  try {
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
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    // Check rate limit
    if (!checkRateLimit(ip, model)) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. You can only vote 14 times per 5 minutes.",
          rateLimited: true
        },
        { status: 429 }
      );
    }

    // Insert vote into Supabase
    const { error } = await supabase.from("rock_votes").insert([
      {
        model,
        first_not_rock,
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
