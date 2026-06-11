"""Credential providers: where the ytmusicapi browser-auth JSON comes from.

stdio (local-first, default): a file on the user's machine, never leaves it.
Hosted deployments implement the same protocol against their own storage.
"""

import os
from pathlib import Path
from typing import Protocol


class CredentialsError(RuntimeError):
    """Base class for credential failures (explicit, never silently degraded)."""


class AuthMissingError(CredentialsError):
    def __init__(self):
        super().__init__(
            f"No YouTube Music auth at {auth_path()}. "
            "Run `ytmusic-manager setup` in a terminal (paste the request headers "
            "of a POST youtubei/v1 request from music.youtube.com devtools)."
        )


class NotConnectedError(CredentialsError):
    """Authenticated MCP user has no YouTube Music credentials yet."""


class CredentialsInvalidError(CredentialsError):
    """Stored credentials were rejected by YouTube (expired/revoked session)."""


class CredentialsProvider(Protocol):
    def auth_json(self, sub: str | None) -> str:
        """Return the ytmusicapi browser-auth JSON for this user.

        `sub` is the authenticated MCP subject (None on stdio, where the
        process belongs to a single local user).
        """
        ...


def auth_path() -> Path:
    override = os.environ.get("YTMUSIC_AUTH_FILE")
    if override:
        return Path(override)
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return config_home / "ytmusic" / "browser.json"


class LocalFileProvider:
    """stdio default: browser.json created by `ytmusic-manager setup`."""

    def auth_json(self, sub: str | None) -> str:
        path = auth_path()
        if not path.exists():
            raise AuthMissingError()
        return path.read_text()
