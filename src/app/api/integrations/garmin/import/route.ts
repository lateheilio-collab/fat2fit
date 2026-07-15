import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse multi-part form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Tiedosto puuttuu" }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const extension = filename.split(".").pop();

    // Helper to parse standard and Finnish dot-separated date strings (e.g. 03.07.2026)
    const parseDateString = (str: string): Date | null => {
      const clean = str.trim();
      const parsed = new Date(clean);
      if (!isNaN(parsed.getTime())) return parsed;

      // Handle DD.MM.YYYY
      const parts = clean.split(/[ .:]/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        let hours = 0;
        let minutes = 0;

        if (parts.length >= 5) {
          hours = parseInt(parts[3], 10) || 0;
          minutes = parseInt(parts[4], 10) || 0;
        }

        const d = new Date(year, month, day, hours, minutes);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    // 3. Process based on extension
    if (extension === "csv") {
      const content = await file.text();
      const rows = content.split(/\r?\n/);
      const parsedData: any[] = [];
      let duplicatesCount = 0;

      // Simple CSV column index detection based on header names
      const headers = rows[0]?.split(/[;,]/).map(h => h.trim().toLowerCase()) || [];
      const dateIdx = headers.findIndex(h => h.includes("pvm") || h.includes("date") || h.includes("aika"));
      const weightIdx = headers.findIndex(h => h.includes("paino") || h.includes("weight") || h.includes("kg"));

      // If headers aren't detected, default to 0 and 1
      const activeDateIdx = dateIdx !== -1 ? dateIdx : 0;
      const activeWeightIdx = weightIdx !== -1 ? weightIdx : 1;

      // Extract rows
      for (const row of rows.slice(1)) {
        if (!row.trim()) continue;
        const cols = row.split(/[;,]/);
        
        if (cols.length > Math.max(activeDateIdx, activeWeightIdx)) {
          const dateStr = cols[activeDateIdx].trim();
          // Replace commas with dots for Finnish localization decimal support
          const weightStr = cols[activeWeightIdx].trim().replace(",", ".");
          const weightVal = parseFloat(weightStr);

          if (dateStr && !isNaN(weightVal)) {
            const parsedDate = parseDateString(dateStr);
            if (!parsedDate) continue; // Skip invalid format rows silently instead of crashing

            const formattedDate = parsedDate.toISOString();
            
            const { data: existing } = await supabase
              .from("body_measurements")
              .select("id")
              .eq("user_id", user.id)
              .eq("metric", "weight")
              .eq("measured_at", formattedDate)
              .maybeSingle();

            if (existing) {
              duplicatesCount++;
            } else {
              parsedData.push({
                measuredAt: formattedDate,
                metric: "weight",
                value: weightVal,
              });
            }
          }
        }
      }

      return NextResponse.json({
        type: "csv",
        totalRows: rows.length - 1,
        newRecords: parsedData,
        duplicatesCount,
      });
    }

    // GPX/FIT/TCX/ZIP workout mock parser
    if (["fit", "tcx", "gpx", "zip"].includes(extension || "")) {
      return NextResponse.json({
        type: "activity_file",
        fileName: file.name,
        newRecords: [
          {
            provider: "file_import",
            externalId: `file_${Date.now()}`,
            activityType: "Juoksu",
            startedAt: new Date().toISOString(),
            durationSeconds: 3000,
            distanceMeters: 6000,
            caloriesKcal: 480,
          },
        ],
        duplicatesCount: 0,
      });
    }

    return NextResponse.json({ error: "Ei-tuettu tiedostomuoto." }, { status: 400 });
  } catch (error: any) {
    console.error("Error importing file:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe tiedoston parsinassa." },
      { status: 500 }
    );
  }
}
