"""MCP App (rendered UI): `library_app`, a visual dashboard of the library.

Rendered in MCP clients supporting the Apps extension (claude.ai). Reads the
same storage as the JSON tools (zero drift), entirely inline (no external
asset → default CSP). Requires storage + the optional `prefab-ui` dependency:
without either, the server runs with JSON tools only (see server.build_mcp).
"""

from fastmcp import FastMCPApp
from prefab_ui.actions import OpenLink
from prefab_ui.app import PrefabApp
from prefab_ui.components import (
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Column,
    DataTable,
    DataTableColumn,
    Grid,
    Metric,
)
from prefab_ui.themes import Theme

from .db.models import as_utc, utcnow

# Site "Musical Bold" dark palette (site/src/assets/main.css), shadcn vars inline.
YTM_THEME = Theme(
    accent="#ef233c",  # red pantone
    light_css=(
        "--background:#0d0e15; --foreground:#edf2f4;"
        "--card:#181a26; --card-foreground:#edf2f4;"
        "--popover:#181a26; --popover-foreground:#edf2f4;"
        "--muted:#14151f; --muted-foreground:#8d99ae;"
        "--secondary:#262838; --secondary-foreground:#edf2f4;"
        "--accent:#262838; --accent-foreground:#edf2f4;"
        "--border:#262838; --input:#262838;"
        "--primary:#ef233c; --primary-foreground:#ffffff;"
        "--ring:#ef233c;"
        "--destructive:#d80032; --destructive-foreground:#ffffff;"
        "--success:#3ecf8e; --warning:#f0b41e; --info:#8d99ae;"
    ),
)

EVENT_LABELS = {
    "like": "♥ likes added",
    "unlike": "likes removed",
    "playlist_create": "playlist created",
    "playlist_edit": "playlist edited",
    "playlist_delete": "playlist deleted",
    "tracks_add": "tracks added",
    "tracks_remove": "tracks removed",
}


def _age(dt) -> str:
    delta = utcnow() - as_utc(dt)
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"{minutes} min ago"
    if minutes < 60 * 48:
        return f"{minutes // 60} h ago"
    return f"{minutes // (60 * 24)} d ago"


def _describe(e) -> str:
    base = EVENT_LABELS.get(e.type, e.type)
    title = (e.payload or {}).get("title")
    n = len(e.video_ids or [])
    parts = [base]
    if title:
        parts.append(f"“{title}”")
    if n:
        parts.append(f"({n})")
    return " ".join(parts)


def _wrap(view, title: str) -> PrefabApp:
    return PrefabApp(view=view, title=title, theme=YTM_THEME, css_class="max-w-3xl mx-auto")


def register(mcp, deps) -> None:
    app = FastMCPApp("ytmusic-ui")

    @app.ui()
    def library_app() -> PrefabApp:
        """Open a **rendered dashboard** of the YouTube Music library: liked /
        unfiled / playlists metrics, recent changes and the unfiled tracks table.

        Same data as the cached JSON tools — prefer it when the user wants to
        *see* the state of their library. Requires a successful `sync` first.
        """
        user_id = deps.user_id()
        with deps.repo.session() as s:
            last = deps.repo.last_ok_sync(s, user_id)
            if last is None:
                with Column(gap=3) as view:
                    with Alert(variant="destructive"):
                        AlertTitle("No sync yet")
                        AlertDescription(
                            "Run the `sync` tool once to import the library snapshot."
                        )
                return _wrap(view, "YouTube Music — library")
            summary = deps.repo.summary(s, user_id)
            events = deps.repo.events(s, user_id, limit=15)
            unfiled_ids = deps.repo.unfiled_video_ids(s, user_id)
            meta = deps.repo.tracks_meta(s, unfiled_ids[:100])

        event_rows = [
            {
                "when": as_utc(e.at).strftime("%d/%m %H:%M"),
                "via": "Claude" if e.source == "tool" else "sync",
                "change": _describe(e),
            }
            for e in events
        ]
        unfiled_rows = [
            {
                "play": Button(
                    "",
                    icon="play",
                    variant="ghost",
                    size="icon-sm",
                    on_click=OpenLink(f"https://music.youtube.com/watch?v={v}"),
                ),
                "title": (meta.get(v) or {}).get("title") or v,
                "artists": ", ".join((meta.get(v) or {}).get("artists") or []),
                "album": (meta.get(v) or {}).get("album") or "—",
            }
            for v in unfiled_ids[:100]
        ]

        with Column(gap=4) as view:
            with Grid(cols=4, gap=3):
                Metric(label="Liked songs", value=str(summary["liked"]))
                Metric(label="Playlists", value=str(summary["playlists"]))
                Metric(label="Unfiled", value=str(summary["unfiled"]))
                Metric(label="Last sync", value=_age(last.finished_at))

            with Card():
                with CardHeader():
                    CardTitle("Recent changes")
                    CardDescription("History of likes and playlist edits (sync + Claude)")
                with CardContent():
                    if event_rows:
                        DataTable(
                            columns=[
                                DataTableColumn(key="when", header="When"),
                                DataTableColumn(key="via", header="Via"),
                                DataTableColumn(key="change", header="Change"),
                            ],
                            rows=event_rows,
                        )
                    else:
                        with Alert():
                            AlertTitle("No changes recorded yet")
                            AlertDescription(
                                "Changes appear here after the next sync or tool write."
                            )

            with Card():
                with CardHeader():
                    CardTitle("Unfiled liked songs")
                    CardDescription(
                        f"{summary['unfiled']} liked songs in no playlist"
                        + (" — first 100 shown" if summary["unfiled"] > 100 else "")
                    )
                with CardContent():
                    if unfiled_rows:
                        DataTable(
                            columns=[
                                DataTableColumn(key="play", header="", width="44px"),
                                DataTableColumn(key="title", header="Title", sortable=True),
                                DataTableColumn(key="artists", header="Artists"),
                                DataTableColumn(key="album", header="Album"),
                            ],
                            rows=unfiled_rows,
                            search=True,
                            paginated=True,
                        )

        return _wrap(view, "YouTube Music — library")

    mcp.add_provider(app)
