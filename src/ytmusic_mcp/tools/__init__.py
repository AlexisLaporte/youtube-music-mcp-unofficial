"""Tool registration: every tool resolves its YTMusic client through Deps,
so the same tools serve stdio (local file) and hosted (per-user) deployments.

Deps.repo (optional) enables history: sync/recent_likes/library_changes tools,
cached reads and write-through event recording on mutations."""

from dataclasses import dataclass
from typing import TYPE_CHECKING

from ..credentials import CredentialsProvider
from ..usercontext import current_sub
from ..ytclient import build_yt

if TYPE_CHECKING:
    from ..db.repo import Repo


@dataclass
class Deps:
    provider: CredentialsProvider
    repo: "Repo | None" = None

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


def register_all(mcp, deps: Deps) -> None:
    from . import library, mutate

    library.register(mcp, deps)
    mutate.register(mcp, deps)
    if deps.repo is not None:
        from . import history

        history.register(mcp, deps)
