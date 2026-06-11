"""Tool registration: every tool resolves its YTMusic client through Deps,
so the same tools serve stdio (local file) and hosted (per-user) deployments."""

from dataclasses import dataclass

from ..credentials import CredentialsProvider
from ..usercontext import current_sub
from ..ytclient import build_yt


@dataclass
class Deps:
    provider: CredentialsProvider

    def get_yt(self):
        return build_yt(self.provider.auth_json(current_sub()))


def register_all(mcp, deps: Deps) -> None:
    from . import library, mutate

    library.register(mcp, deps)
    mutate.register(mcp, deps)
