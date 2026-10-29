#!/usr/bin/env python3
"""Check that the MCP guide's tool tables name exactly the tools the hosted MCP lists publicly today.

It reads the hosted MCP's public, unauthenticated discovery (the endpoint the OpenAI package connects to), with no
credentials, and fails on a listed tool the guide's tables leave out or a table tool the server doesn't list. Tools
offered only once a connected Sunport offers them (test_delivery, sunport_health) aren't in that list, so the guide
names them in its text, not its tables.
"""

import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
GUIDE = "usage/references/mcp.md"
ENDPOINT = json.loads((ROOT / "packages/openai/openorange-connect/mcp.json").read_text())["mcpServers"]["openorange"]["url"]


class Unreachable(Exception):
    """The public discovery couldn't be read: no verdict on the guide."""


def rpc(method, params, request_id):
    body = json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}).encode()
    request = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "content-type": "application/json", "accept": "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18", "user-agent": "openorange-integrations-ci"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode()
    except (urllib.error.URLError, TimeoutError) as error:
        raise Unreachable(str(getattr(error, "code", None) or getattr(error, "reason", error))) from error
    # A streamable HTTP server may answer as server-sent events: the answer is the event whose data has this id.
    events = ["\n".join(line[5:].lstrip() for line in block.splitlines() if line.startswith("data:"))
              for block in re.split(r"\r?\n\r?\n", text)] if "data:" in text else [text]
    for event in filter(None, events):
        answer = json.loads(event)
        if answer.get("id") == request_id:
            if "result" not in answer:
                raise Unreachable(f"{method} answered {answer.get('error')}")
            return answer["result"]
    raise Unreachable(f"no answer to {method}")


def documented():
    """The first column of each table headed "| Tool |" in the guide."""
    names, in_table = set(), False
    for line in (ROOT / GUIDE).read_text(encoding="utf-8").splitlines():
        if line.startswith("| Tool |"):
            in_table = True
        elif not line.startswith("|"):
            in_table = False
        elif in_table and (match := re.match(r"\| `([a-z0-9_]+)` \|", line)):
            names.add(match.group(1))
    return names


def main():
    try:
        rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                           "clientInfo": {"name": "openorange-integrations-ci", "version": "1"}}, 1)
        live, cursor = set(), None
        while True:
            page = rpc("tools/list", {"cursor": cursor} if cursor else {}, 2)
            live |= {tool["name"] for tool in page["tools"]}
            if not (cursor := page.get("nextCursor")):
                break
    except Unreachable as error:
        print(f"{ENDPOINT}'s public discovery couldn't be read ({error}): this says nothing about the guide; "
              "rerun once it answers. It needs no credentials.")
        return 2
    missing, gone = sorted(live - documented()), sorted(documented() - live)
    if missing:
        print(f"{GUIDE} leaves out tools {ENDPOINT} lists: {', '.join(missing)}")
    if gone:
        print(f"{GUIDE} names tools {ENDPOINT} doesn't list: {', '.join(gone)}")
    if missing or gone:
        return 1
    print(f"live tools: passed ({len(live)} tools)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
