import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cache } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const playlistId = searchParams.get('playlistId');

  try {
    switch (type) {
      case 'playlists': {
        const result = cache.getPlaylists(session.userId);
        return NextResponse.json(result);
      }
      case 'liked': {
        const result = cache.getLikedSongs(session.userId);
        return NextResponse.json(result);
      }
      case 'tracks': {
        if (!playlistId) {
          return NextResponse.json({ error: 'playlistId required' }, { status: 400 });
        }
        const result = cache.getPlaylistTracks(playlistId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cache GET error:', error);
    return NextResponse.json({ error: 'Cache error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, data, playlistId } = body;

    switch (type) {
      case 'playlists':
        cache.setPlaylists(session.userId, data);
        break;
      case 'liked':
        cache.setLikedSongs(session.userId, data);
        break;
      case 'tracks':
        if (!playlistId) {
          return NextResponse.json({ error: 'playlistId required' }, { status: 400 });
        }
        cache.setPlaylistTracks(playlistId, session.userId, data);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cache POST error:', error);
    return NextResponse.json({ error: 'Cache error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const playlistId = searchParams.get('playlistId');

  try {
    if (playlistId) {
      cache.invalidatePlaylist(playlistId);
    } else {
      cache.invalidateUser(session.userId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cache DELETE error:', error);
    return NextResponse.json({ error: 'Cache error' }, { status: 500 });
  }
}
