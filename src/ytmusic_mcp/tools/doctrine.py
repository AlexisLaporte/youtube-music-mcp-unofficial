"""Agent doctrine — the orchestration map, read first (like GR/Ogic get_claude_md).

Tells the agent the mental model and the workflows so it doesn't have to
reverse-engineer the tools (and, crucially, so it doesn't micro-manage sync)."""

DOCTRINE = """\
# YouTube Music — doctrine

You manage the user's YouTube Music library on their behalf. Read this first.

## Mental model
- The library is mirrored in a **snapshot** kept fresh **automatically**: a baseline
  on first contact, then a lazy refresh past a TTL (sync-then-serve). **You normally
  do NOT call `sync` yourself** — cached reads and `recent_likes` refresh as needed.
- `sync(force=true)` is only for an explicit "show me the state right *now*".

## Reads: cached vs live
- `unfiled_liked_songs(cached=true)`, `liked_songs(cached=true)`, `list_playlists(cached=true)`
  answer from the auto-fresh snapshot → **fast, prefer these**.
- Without `cached`, the same tools hit YouTube directly: fresher but slow (a full
  unfiled audit scans every playlist). Use live only when the user wants real-time.

## Workflows
**File my library**
1. `unfiled_liked_songs(cached=true)` → liked songs in no playlist (+ counts).
2. Cluster them by genre/artist/mood; map to existing owned playlists or propose new ones.
3. Propose the plan, **get explicit approval**, then `add_tracks` (ONE call per playlist,
   many videoIds — batch).

**Sort my latest likes**
1. `recent_likes()` → only what's been liked since last time, with `since`/`until` bounds
   so you know exactly which batch to file (not the whole library).
2. Propose where each goes, get approval, `add_tracks`.

**What changed**
- `library_changes(types=..., since=...)` → history feed (likes, playlist edits).

## Guardrails (non-negotiable)
- **Never write without approval.** Destructive tools (`delete_playlist`, `remove_tracks`,
  `unlike`) require explicit user confirmation, listing exactly what will be removed.
- Batch writes: one `add_tracks` per playlist with all videoIds, not N calls.
- Only mutate **owned** playlists.
"""


def register(mcp, deps) -> None:
    @mcp.tool
    def get_claude_md() -> str:
        """Read this FIRST: the orchestration doctrine (mental model, workflows,
        guardrails) for managing the YouTube Music library."""
        return DOCTRINE
