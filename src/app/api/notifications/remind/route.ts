import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reminderId, userId, message } = body;

    const supabase = supabaseAdmin();

    // Record reminder delivery in DB
    const { error } = await supabase
      .from("reminder_deliveries")
      .insert({
        reminder_id: reminderId || null,
        user_id: userId || null,
        scheduled_time: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        status: "delivered",
      });

    if (error) throw error;

    console.log(`Reminder delivered to user ${userId || "unknown"}: "${message || "No content"}"`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in reminder route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
