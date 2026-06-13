"""Tool registration: every tool resolves its YTMusic client through Deps,
so the same tools serve stdio (local file) and hosted (per-user) deployments.

Deps.repo (optional) enables history: sync/recent_likes/library_changes tools,
cached reads and write-through event recording on mutations."""

import os
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from ..credentials import CredentialsProvider
from ..usercontext import current_sub
from ..ytclient import build_yt

if TYPE_CHECKING:
    from ..db.repo import Repo
    from ..enrichment.lastfm import LastFmClient


@dataclass
class Deps:
    provider: CredentialsProvider
    repo: "Repo | None" = None
    _lastfm: "LastFmClient | None" = field(default=None, init=False, repr=False)

    def get_lastfm(self) -> "LastFmClient":
        """Lazy, memoized Last.fm client (shared across calls). Reads
        LASTFM_API_KEY from the environment; raises if unset."""
        if self._lastfm is None:
            from ..enrichment.lastfm import LastFmClient

            self._lastfm = LastFmClient()
        return self._lastfm

    def get_yt(self):
        sub = current_sub()
        # Hosted providers can return a health-tracking client (flips invalid_since
        # on auth failures); the local provider just hands back the JSON.
        yt_for = getattr(self.provider, "yt_for", None)
        if yt_for is not None:
            return yt_for(sub)
        return build_yt(self.provider.auth_json(sub))

    def user_id(self) -> str:
        return current_sub() or "local"

    def ensure_fresh(self, max_age):
        """Lazy refresh of the snapshot before a cached read (baseline on first
        contact, re-sync if older than max_age). No-op if storage is disabled."""
        if self.repo is None:
            return None
        from ..sync.engine import ensure_fresh

        return ensure_fresh(self.repo, self.get_yt(), self.user_id(), max_age)


def register_all(mcp, deps: Deps) -> None:
    from . import doctrine, library, mutate

    doctrine.register(mcp, deps)
    library.register(mcp, deps)
    mutate.register(mcp, deps)
    if deps.repo is not None:
        from . import history

        history.register(mcp, deps)
        if os.environ.get("LASTFM_API_KEY"):
            from . import recommend

            recommend.register(mcp, deps)
