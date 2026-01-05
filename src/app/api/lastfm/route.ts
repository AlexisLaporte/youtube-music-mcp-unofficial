import { NextRequest, NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const artist = searchParams.get("artist");
  const track = searchParams.get("track");

  if (!artist || !track) {
    return NextResponse.json({ error: "Missing artist or track" }, { status: 400 });
  }

  // Extract primary artist (before comma, feat, &, etc.)
  const primaryArtist = artist
    .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    .trim();

  if (!LASTFM_API_KEY) {
    return NextResponse.json({ error: "Last.fm API key not configured" }, { status: 500 });
  }

  try {
    // Try track tags first
    const trackUrl = new URL("https://ws.audioscrobbler.com/2.0/");
    trackUrl.searchParams.set("method", "track.getInfo");
    trackUrl.searchParams.set("api_key", LASTFM_API_KEY);
    trackUrl.searchParams.set("artist", primaryArtist);
    trackUrl.searchParams.set("track", track);
    trackUrl.searchParams.set("autocorrect", "1");
    trackUrl.searchParams.set("format", "json");

    const trackResponse = await fetch(trackUrl.toString());
    const trackData = await trackResponse.json();
    const trackInfo = trackData.track;
    let tags = trackInfo?.toptags?.tag?.map((t: { name: string }) => t.name) || [];

    // Fallback to artist tags if track has no tags
    if (tags.length === 0) {
      const artistUrl = new URL("https://ws.audioscrobbler.com/2.0/");
      artistUrl.searchParams.set("method", "artist.getTopTags");
      artistUrl.searchParams.set("api_key", LASTFM_API_KEY);
      artistUrl.searchParams.set("artist", primaryArtist);
      artistUrl.searchParams.set("autocorrect", "1");
      artistUrl.searchParams.set("format", "json");

      const artistResponse = await fetch(artistUrl.toString());
      const artistData = await artistResponse.json();
      tags = artistData?.toptags?.tag?.slice(0, 5).map((t: { name: string }) => t.name) || [];
    }

    return NextResponse.json({
      name: trackInfo?.name,
      artist: trackInfo?.artist?.name,
      album: trackInfo?.album?.title,
      tags,
      listeners: trackInfo?.listeners,
      playcount: trackInfo?.playcount,
      url: trackInfo?.url,
    });
  } catch (error) {
    console.error("Last.fm API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch from Last.fm" },
      { status: 500 }
    );
  }
}
