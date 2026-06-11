"""Identity of the calling MCP user, resolved from the request context."""


def current_sub() -> str | None:
    """`sub` claim of the access token, or None outside an authenticated
    HTTP context (stdio, in-memory tests)."""
    try:
        from fastmcp.server.dependencies import get_access_token

        access = get_access_token()
    except Exception:
        return None
    if not access:
        return None
    return (access.claims or {}).get("sub")
