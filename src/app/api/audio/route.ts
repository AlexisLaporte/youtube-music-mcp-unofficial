import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const execAsync = promisify(exec);

const CACHE_DIR = path.join(process.cwd(), "data", "audio-cache");

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get("v");

  if (!videoId) {
    return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
  }

  // Sanitize videoId
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  const outputPath = path.join(CACHE_DIR, `${videoId}.mp4`);

  try {
    // Create cache dir if needed
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }

    // Check if already cached
    if (!existsSync(outputPath)) {
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // Download with Android client (bypasses 403) - format 18 has audio
      await execAsync(
        `yt-dlp --no-warnings --extractor-args "youtube:player_client=android" -f "18" -o "${outputPath}" "${url}"`,
        { timeout: 120000 }
      );
    }

    // Read and return the audio file
    const audioBuffer = await readFile(outputPath);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": String(audioBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Audio extraction error:", error);
    // Clean up failed download
    if (existsSync(outputPath)) {
      await unlink(outputPath).catch(() => {});
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract audio" },
      { status: 500 }
    );
  }
}
