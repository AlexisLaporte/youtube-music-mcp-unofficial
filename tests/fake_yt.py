"""In-memory YTMusic double for sync-engine tests (sqlite, no network)."""


def track(vid: str, title: str | None = None) -> dict:
    return {"videoId": vid, "title": title or f"T-{vid}", "artists": [{"name": "A"}]}


class FakeYT:
    def __init__(self):
        self.liked: list[dict] = []  # newest first, like the real LM playlist
        self.playlists: dict[str, dict] = {}
        self.search_results: dict[str, list[dict]] = {}  # query -> hits

    # --- helpers for tests -------------------------------------------------
    def add_like(self, vid: str):
        self.liked.insert(0, track(vid))

    def remove_like(self, vid: str):
        self.liked = [t for t in self.liked if t["videoId"] != vid]

    def set_playlist(self, pid: str, title: str, vids: list[str]):
        self.playlists[pid] = {"title": title, "owned": True, "tracks": [track(v) for v in vids]}

    # --- ytmusicapi surface used by the engine ------------------------------
    def get_playlist(self, playlist_id: str, limit=None):
        if playlist_id == "LM":
            return {"title": "Liked", "owned": True, "trackCount": len(self.liked),
                    "tracks": self.liked}
        p = self.playlists[playlist_id]
        return {"title": p["title"], "owned": p["owned"], "trackCount": len(p["tracks"]),
                "tracks": p["tracks"]}

    def get_library_playlists(self, limit=None):
        return [{"playlistId": pid, "title": p["title"]} for pid, p in self.playlists.items()]

    def search(self, query, filter=None, limit=20):
        return self.search_results.get(query, [])
