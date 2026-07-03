# ytmusic-manager

**Claude Code plugin + MCP server** for **YouTube Music**: talk to Claude (or any MCP
client) to audit your liked songs, organize playlists, search, like/unlike — on your own
account, from your own machine.

The killer workflow: `unfiled_liked_songs` finds every liked song that sits in no playlist,
so your assistant can propose a filing plan and execute it in batches once you approve.

The plugin bundles the MCP server (auto-registered) with guardrails baked into the server
(batching, duration checks for DJ sets, owned-playlists-only, confirmation on destructive ops).

## How it works

- Runs **locally** (stdio MCP server). Nothing is hosted; no account to create.
- Uses [ytmusicapi](https://github.com/sigma67/ytmusicapi) (YouTube Music's internal API —
  unofficial, no quota).
- Auth = your own browser session headers, stored in `~/.config/ytmusic/browser.json`
  (chmod 600). **They never leave your machine** and are never pasted into a conversation.

## Install

### 1. Capture your session

```bash
uvx --from git+https://github.com/AlexisLaporte/youtube-music-mcp-unofficial ytmusic-manager setup
```

The wizard asks you to paste the request headers of a `POST .../youtubei/v1/...` request
from music.youtube.com devtools (Network tab, logged in). It validates the session and
prints the account name.

### 2. Install the plugin (Claude Code)

```
/plugin marketplace add AlexisLaporte/youtube-music-mcp-unofficial
/plugin install ytmusic-manager@ytmusic
```

This registers the MCP server.

### Alternative: MCP server only

For Claude Desktop or any other MCP client:

```bash
claude mcp add ytmusic -- uvx --from git+https://github.com/AlexisLaporte/youtube-music-mcp-unofficial ytmusic-manager
```

or in any `mcpServers` config:

```json
{
  "mcpServers": {
    "ytmusic": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/AlexisLaporte/youtube-music-mcp-unofficial", "ytmusic-manager"]
    }
  }
}
```

## Tools

| Tool | Effect |
|---|---|
| `whoami` | check the authenticated account |
| `list_playlists` | playlists of your library |
| `playlist_tracks` / `liked_songs` | tracks of a playlist / your likes |
| `search` | search songs, albums, artists, playlists |
| `unfiled_liked_songs` | liked songs missing from every playlist (+ stats) |
| `create_playlist` / `edit_playlist` / `delete_playlist` | manage playlists |
| `add_tracks` / `remove_tracks` | fill playlists (batched) |
| `like` / `unlike` | rate tracks |

Destructive tools (`delete_playlist`, `remove_tracks`, `unlike`) are guarded: the server
instructs the model to get your explicit confirmation first.

## Caveats

- Unofficial API: a YouTube change can break it; you use it under your own Google account
  and responsibility.
- Browser-session auth lives ~2 years; if `whoami` fails, re-run `setup`.

## License

MIT
