import { NextRequest, NextResponse } from "next/server";
import { cache, AudioAnalysis } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("v");

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  // Check cache first
  const cached = cache.getAudioAnalysis(videoId);
  if (cached) {
    return NextResponse.json({ cached: true, ...cached });
  }

  // No cache - fetch metadata from yt-dlp
  try {
    const { stdout } = await execAsync(
      `yt-dlp --no-warnings --print "%(title)s|||%(artist)s|||%(channel)s" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 30000 }
    );

    const [rawTitle, artist, channel] = stdout.trim().split("|||");

    // Parse title to extract artist if not available
    let parsedTitle = rawTitle;
    let parsedArtist = artist && artist !== "NA" ? artist : channel;

    // Try to split "Artist - Title" format
    if (rawTitle.includes(" - ")) {
      const parts = rawTitle.split(" - ");
      if (parts.length === 2) {
        parsedArtist = parts[0].trim();
        parsedTitle = parts[1].trim();
      }
    }

    return NextResponse.json({
      cached: false,
      videoId,
      title: parsedTitle,
      artist: parsedArtist,
    });
  } catch (error) {
    console.error("Failed to fetch video metadata:", error);
    return NextResponse.json({
      cached: false,
      videoId,
      title: null,
      artist: null,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const analysis: AudioAnalysis = {
      videoId: body.videoId,
      title: body.title || null,
      artist: body.artist || null,
      bpm: body.bpm ?? null,
      key: body.key || null,
      scale: body.scale || null,
      energy: body.energy ?? null,
      danceability: body.danceability ?? null,
      lastfmTags: body.lastfmTags || null,
    };

    if (!analysis.videoId || !/^[a-zA-Z0-9_-]{11}$/.test(analysis.videoId)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    cache.setAudioAnalysis(analysis);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save analysis:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
