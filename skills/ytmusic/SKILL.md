---
name: ytmusic
description: Organize a YouTube Music library with the ytmusic MCP tools — audit unfiled liked songs, file them into playlists in batches, deduplicate, clean up. Invoke for anything YouTube Music: playlists, liked songs, "sort my music".
---

# YouTube Music — library filing methodology

The `ytmusic` MCP server (bundled with this plugin) exposes the tools; this skill is the
method. Auth is local (`ytmusic-manager setup` in a terminal — never paste headers into
the conversation).

## Main workflow: audit "liked → playlists"

1. `unfiled_liked_songs()` — liked songs absent from every playlist (slow on big
   libraries: run once, reuse the result for the whole session).
2. Cluster the unfiled tracks (genre / artist / mood) and propose a filing plan in batches.
3. **Validate the plan with the user before any write.**
4. Execute: `create_playlist` for missing playlists, then **one `add_tracks` call with
   many video ids per playlist** — never one call per track.
5. Leftovers that belong in NO playlist (DJ sets, jingles, one-off ambience): propose
   `mark_unfileable(video_ids, reason)` — they stay liked but stop resurfacing in the
   audit. `list_unfileable` / `unmark_unfileable` to review or undo.

## Filing criteria

- **Cross title AND content.** Playlist titles state intent; actual contents show usage.
  Build an artist→playlists index once (`list_playlists` + `playlist_tracks`) and treat
  "artist already in playlist X" as a strong signal.
- **Check duration before filing.** Tracks longer than ~20 min, or titled like
  set/session/mix/live, are DJ sets or live sessions — they go to a dedicated playlist
  (e.g. "DJ Sets"), never into genre playlists. A live version of a single song files
  normally.
- **Owned playlists only.** Followed (shared) playlists appear in the library but are not
  the user's — never write to them, never flag them as duplicates of the user's playlists.
- **Watch for duplicate likes**: the same song can be liked under two different video ids.
  File one; surface the other and let the user decide (`unlike` needs confirmation).

## Guardrails

- Destructive tools (`delete_playlist`, `remove_tracks`, `unlike`) require explicit user
  confirmation, with the list of what will be removed.
- Batch writes; propose before executing; report results playlist by playlist.
