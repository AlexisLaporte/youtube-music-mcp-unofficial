import { NextResponse } from "next/server";
import { cache } from "@/lib/db";

// Access internal db through cache module which ensures schema exists
// We need to add a stats method to the cache module

export async function GET() {
  try {
    // Use the cache module's method to get stats
    const stats = cache.getAnalysisStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get analysis stats:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
