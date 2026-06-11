"""CLI entry point.

`ytmusic-manager`        → run the MCP server (stdio), for mcpServers configs.
`ytmusic-manager setup`  → interactive auth wizard (browser headers), run in a terminal.
`ytmusic-manager whoami` → print the authenticated account.
"""

import argparse
import json
import os
import sys

from .credentials import auth_path


def cmd_setup(args):
    from ytmusicapi import YTMusic
    from ytmusicapi import setup as ytm_setup

    if args.headers_file:
        from pathlib import Path

        raw = Path(args.headers_file).read_text()
    else:
        print(
            "Open music.youtube.com (logged in) > devtools > Network > pick a POST\n"
            "youtubei/v1 request (status 200) > copy its request headers.\n"
            "Paste them below, then Ctrl-D:",
            file=sys.stderr,
        )
        raw = sys.stdin.read()
    if not raw.strip():
        raise SystemExit("ERROR: empty headers")

    path = auth_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    ytm_setup(filepath=str(path), headers_raw=raw)
    path.chmod(0o600)
    info = YTMusic(str(path)).get_account_info()
    print(json.dumps({"auth_file": str(path), "account": info}, ensure_ascii=False, indent=1))


def cmd_whoami(args):
    from .credentials import LocalFileProvider
    from .ytclient import build_yt

    yt = build_yt(LocalFileProvider().auth_json(None))
    print(json.dumps(yt.get_account_info(), ensure_ascii=False, indent=1))


def _repo_from_env():
    """Storage is optional: enabled by DATABASE_URL (postgres) or a sqlite URL."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    from .db.repo import Repo

    repo = Repo(url)
    repo.create_all()
    return repo


def cmd_db_init(args):
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("ERROR: DATABASE_URL is required for db-init")
    from .db.repo import Repo

    Repo(url).create_all()
    print("schema created/up-to-date")


def cmd_serve(args):
    from .server import build_mcp

    transport = os.environ.get("MCP_TRANSPORT", "stdio")
    if transport in ("http", "streamable_http"):
        from .auth import build_auth

        build_mcp(auth=build_auth(), repo=_repo_from_env()).run(
            transport="http",
            host=os.environ.get("HOST", "127.0.0.1"),
            port=int(os.environ.get("PORT", "8095")),
        )
    else:
        build_mcp(repo=_repo_from_env()).run()


def main():
    p = argparse.ArgumentParser(prog="ytmusic-manager", description=__doc__)
    sub = p.add_subparsers(dest="cmd")

    s = sub.add_parser("setup", help="install auth from browser request headers")
    s.add_argument("--headers-file", help="file with raw request headers (default: stdin)")
    s.set_defaults(func=cmd_setup)

    s = sub.add_parser("whoami", help="check the authenticated account")
    s.set_defaults(func=cmd_whoami)

    s = sub.add_parser("serve", help="run the MCP server on stdio (default)")
    s.set_defaults(func=cmd_serve)

    s = sub.add_parser("db-init", help="create the storage schema (DATABASE_URL)")
    s.set_defaults(func=cmd_db_init)

    args = p.parse_args()
    if args.cmd is None:
        cmd_serve(args)
    else:
        args.func(args)


if __name__ == "__main__":
    main()
