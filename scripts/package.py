#!/usr/bin/env python3
"""Build self-contained host packages from the shared usage guides."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
HOSTS = {
    "claude": ("plugins/openorange", ".claude-plugin/plugin.json", ".mcp.json", "http",
               "https://app.openorange.ai/mcp"),
    "openai": ("packages/openai/openorange-connect", "plugin.json", "mcp.json", "streamable-http",
               "https://app.openorange.ai/mcp/openorange-usage"),
}
SHARED = {
    "README.md": "usage/README.md",
    "LICENSE": "LICENSE",
    "assets/openorange.svg": "assets/openorange.svg",
    "skills/openorange/SKILL.md": "usage/SKILL.md",
    "skills/openorange/references/mcp.md": "usage/references/mcp.md",
    "skills/openorange/references/cli.md": "usage/references/cli.md",
}
# A host's own files from the repository's: the ChatGPT/Codex card logo, the ring on charcoal.
HOST_FILES = {"openai": {"assets/openorange-logo-512.png": "assets/openorange-logo-512.png"}}
SOURCE_FILES = {
    "README.md", "LICENSE", ".gitignore", ".claude-plugin/marketplace.json",
    "assets/openorange.svg", "assets/openorange-icon-1024.png", "assets/openorange-logo-512.png", "usage/README.md", "usage/SKILL.md", "usage/references/mcp.md",
    "usage/references/cli.md", "usage/agent-guide.json", "scripts/package.py", "tests/test_package.py",
    ".github/workflows/ci.yml",
}
# How an agent stays in touch with its Sunport comes from one source in the Layer
# (packages/billing/src/contracts/agent-guide.ts). Its guideJson() export is vendored
# here, with a `layer` field naming the commit it came from; sync writes its Markdown
# into the marked block of each guide doc, and check fails when a block is stale.
GUIDE = "usage/agent-guide.json"
GUIDE_DOCS = ("usage/SKILL.md", "usage/references/mcp.md")
GUIDE_START = "<!-- agent-guide:start: generated from usage/agent-guide.json by scripts/package.py sync -->"
GUIDE_END = "<!-- agent-guide:end -->"


def read_file(root, relative):
    path = root / relative
    for part in (path, *path.parents):
        if part == root:
            break
        if part.is_symlink():
            raise ValueError(f"Symlink is not permitted: {relative}")
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Missing or uncontained file: {relative}")
    return path.read_bytes()


def package_files(root, host):
    folder, manifest_name, mcp_name, *_ = HOSTS[host]
    names = sorted({*SHARED, *HOST_FILES.get(host, {}), manifest_name, mcp_name})
    package = root / folder
    actual = {str(p.relative_to(package)) for p in package.rglob("*") if p.is_file() or p.is_symlink()}
    if actual != set(names):
        raise ValueError(f"Unexpected or missing package files: {host}")
    return {name: read_file(root, f"{folder}/{name}") for name in names}


def guide_markdown(root):
    guide = json.loads(read_file(root, GUIDE))
    if not isinstance(guide.get("layer"), str) or not guide["layer"].strip():
        raise ValueError("Agent guide must name the Layer commit it came from")
    markdown = guide.get("markdown")
    lines = markdown.splitlines() if isinstance(markdown, str) else []
    ways = [f"{index}. {way['when']}: {way['how']}" for index, way in enumerate(guide.get("stayInTouch") or [], 1)]
    rules = [f"- {rule}" for rule in guide.get("rules") or []]
    if not ways or not rules or any(line not in lines for line in ways + rules):
        raise ValueError("Agent guide Markdown differs from its ways and rules")
    return markdown


def with_guide(root, relative, markdown):
    text = read_file(root, relative).decode("utf-8")
    if text.count(GUIDE_START) != 1 or text.count(GUIDE_END) != 1 or text.index(GUIDE_END) < text.index(GUIDE_START):
        raise ValueError(f"Agent guide markers are missing: {relative}")
    start, end = text.index(GUIDE_START), text.index(GUIDE_END) + len(GUIDE_END)
    return text, text[:start] + f"{GUIDE_START}\n{markdown}{GUIDE_END}" + text[end:]


def sync(root):
    markdown = guide_markdown(root)
    for relative in GUIDE_DOCS:
        path = root / relative
        path.write_text(with_guide(root, relative, markdown)[1], encoding="utf-8")
    for host, (folder, *_) in HOSTS.items():
        for destination, source in {**SHARED, **HOST_FILES.get(host, {})}.items():
            data = read_file(root, source)
            path = root / folder / destination
            if path.is_symlink() or any(p.is_symlink() for p in path.parents if p.is_relative_to(root) and p != root):
                raise ValueError("Cannot synchronize through a symlink")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)


def check(root):
    markdown = guide_markdown(root)
    for relative in GUIDE_DOCS:
        current, generated = with_guide(root, relative, markdown)
        if current != generated:
            raise ValueError(f"Agent guide is stale: {relative}; run sync")
    expected = set(SOURCE_FILES)
    versions = set()
    for host, (folder, manifest_name, mcp_name, transport, endpoint) in HOSTS.items():
        files = package_files(root, host)
        expected.update(f"{folder}/{name}" for name in files)
        for destination, source in {**SHARED, **HOST_FILES.get(host, {})}.items():
            if files[destination] != read_file(root, source):
                raise ValueError(f"Usage guides differ: {host}/{destination}; run sync")
        manifest = json.loads(files[manifest_name])
        if manifest.get("name") != Path(folder).name:
            raise ValueError(f"Unexpected plugin identity: {host}")
        if not re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]):
            raise ValueError("Version must be semantic")
        versions.add(manifest["version"])
        if manifest["author"]["name"] != "OpenOrange" or manifest["author"]["email"] != "alex@openorange.ai":
            raise ValueError("Unexpected publisher")
        if any(key in manifest for key in ("hooks", "commands", "agents", "apps", "mcpServers")):
            raise ValueError("Unexpected executable component or app binding")
        config = json.loads(files[mcp_name])
        server = config.get("mcpServers", {}).get("openorange")
        if set(config.get("mcpServers", {})) != {"openorange"} or server != {
            "type": transport, "url": endpoint
        }:
            raise ValueError("Only the public OpenOrange MCP connection is permitted")
        if host == "openai":
            extension = manifest["extensions"]["com.openai"]
            if extension.get("apps") is not None:
                raise ValueError("Public package cannot include an app binding")
            interface = extension["interface"]
            for field in ("composerIcon", "logo"):
                if str(interface.get(field, "")).removeprefix("./") not in files:
                    raise ValueError(f"{field} must name a file in the package")
            if len(interface["shortDescription"]) > 30:
                raise ValueError("Subtitle is too long")
            prompts = interface["defaultPrompt"]
            if len(prompts) > 3 or any(not p.strip() or len(p) > 128 or "\n" in p for p in prompts):
                raise ValueError("Invalid starter prompts")
    if len(versions) != 1:
        raise ValueError("Host versions differ")
    marketplace = json.loads(read_file(root, ".claude-plugin/marketplace.json"))
    entries = marketplace["plugins"]
    if len(entries) != 1 or entries[0]["name"] != "openorange" or entries[0]["source"] != "./plugins/openorange":
        raise ValueError("Marketplace must use the contained OpenOrange package")
    if entries[0]["version"] not in versions or marketplace["metadata"]["version"] not in versions:
        raise ValueError("Marketplace version differs")
    actual = set()
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if relative.parts[0] in (".git", "dist") or "__pycache__" in relative.parts:
            continue
        if path.is_symlink():
            raise ValueError(f"Repository symlink is not permitted: {relative}")
        if path.is_file():
            actual.add(str(relative))
    if actual != expected:
        raise ValueError(f"Repository inventory differs: {sorted(actual ^ expected)}")
    for relative in expected:
        read_file(root, relative)


def build(root, output):
    check(root)
    output.mkdir(parents=True, exist_ok=True)
    sums = []
    for host, (_, manifest_name, *_) in HOSTS.items():
        files = package_files(root, host)
        manifest = json.loads(files[manifest_name])
        filename = f"openorange-{host}-{manifest['version']}.zip"
        archive = output / filename
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
            for name, content in files.items():
                info = zipfile.ZipInfo(f"{manifest['name']}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                bundle.writestr(info, content)
        sums.append(f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {filename}")
    (output / "SHA256SUMS").write_text("\n".join(sums) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("sync", "check", "build"))
    args = parser.parse_args()
    if args.command == "sync":
        sync(ROOT)
    elif args.command == "check":
        check(ROOT)
    else:
        build(ROOT, ROOT / "dist")
    print(f"{args.command}: passed")
