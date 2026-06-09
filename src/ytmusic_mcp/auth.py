"""Optional OAuth resource-server auth for the remote (HTTP) transport.

stdio (the default, self-hosted case) uses no auth at all. The HTTP transport is
for a personally hosted instance and requires an OIDC authorization server:

  MCP_ISSUER        OIDC issuer (e.g. https://auth.example.com/oidc)
  MCP_AUDIENCE      expected `aud` of access tokens (the API resource indicator)
  MCP_PUBLIC_URL    public base URL of this server (e.g. https://ytmusic.example.com)
  MCP_JWT_ALGORITHM JWT signing algorithm (default ES384, Logto's default)
  MCP_ALLOWED_SUBS  optional comma-separated `sub` allowlist — anyone else gets 401.
                    Strongly recommended: this server controls YOUR music account.
"""

import os

from fastmcp.server.auth import RemoteAuthProvider
from fastmcp.server.auth.providers.jwt import JWTVerifier
from pydantic import AnyHttpUrl


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"HTTP transport requires the {name} environment variable")
    return value


class SubGatedVerifier(JWTVerifier):
    """JWTVerifier that additionally rejects tokens whose `sub` is not allowlisted."""

    def __init__(self, *args, allowed_subs: frozenset[str], **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._allowed_subs = allowed_subs

    async def verify_token(self, token):
        result = await super().verify_token(token)
        if result and self._allowed_subs:
            if (getattr(result, "claims", None) or {}).get("sub") not in self._allowed_subs:
                return None
        return result


def build_auth() -> RemoteAuthProvider:
    issuer = _require("MCP_ISSUER").rstrip("/")
    allowed = frozenset(
        s.strip() for s in os.environ.get("MCP_ALLOWED_SUBS", "").split(",") if s.strip()
    )
    verifier = SubGatedVerifier(
        jwks_uri=f"{issuer}/jwks",
        issuer=issuer,
        audience=_require("MCP_AUDIENCE"),
        algorithm=os.environ.get("MCP_JWT_ALGORITHM", "ES384"),
        allowed_subs=allowed,
    )
    return RemoteAuthProvider(
        token_verifier=verifier,
        authorization_servers=[AnyHttpUrl(issuer)],
        base_url=_require("MCP_PUBLIC_URL").rstrip("/"),
        resource_name="YouTube Music MCP",
    )
