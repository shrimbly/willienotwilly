import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Insert subscriber
    const { error, data } = await supabase
      .from("subscribers")
      .insert([{ email: email.toLowerCase().trim() }])
      .select();

    if (error) {
      console.error("Supabase error details:", JSON.stringify(error, null, 2));
      console.error("Supabase error code:", error.code);
      console.error("Supabase error message:", error.message);
      console.error("Supabase error details:", error.details);
      
      // Handle duplicate email error gracefully
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Email already subscribed" },
          { status: 409 }
        );
      }
      
      // Provide detailed error message in development
      const errorMessage = process.env.NODE_ENV === "development" 
        ? `${error.message} (Code: ${error.code})` || "Failed to subscribe"
        : "Failed to subscribe";
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

