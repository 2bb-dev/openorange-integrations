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
    "claude": ("plugins/openorange", ".claude-plugin/plugin.json", ".mcp.json", "http"),
    "openai": ("packages/openai/openorange-usage", "plugin.json", "mcp.json", "streamable-http"),
}
SHARED = {
    "README.md": "usage/README.md",
    "LICENSE": "LICENSE",
    "assets/openorange.svg": "assets/openorange.svg",
    "skills/openorange/SKILL.md": "usage/SKILL.md",
    "skills/openorange/references/mcp.md": "usage/references/mcp.md",
    "skills/openorange/references/cli.md": "usage/references/cli.md",
}
SOURCE_FILES = {
    "README.md", "LICENSE", ".gitignore", ".claude-plugin/marketplace.json",
    "assets/openorange.svg", "usage/README.md", "usage/SKILL.md", "usage/references/mcp.md",
    "usage/references/cli.md", "scripts/package.py", "tests/test_package.py",
    ".github/workflows/ci.yml",
}


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
    folder, manifest_name, mcp_name, _ = HOSTS[host]
    names = sorted({*SHARED, manifest_name, mcp_name})
    package = root / folder
    actual = {str(p.relative_to(package)) for p in package.rglob("*") if p.is_file() or p.is_symlink()}
    if actual != set(names):
        raise ValueError(f"Unexpected or missing package files: {host}")
    return {name: read_file(root, f"{folder}/{name}") for name in names}


def sync(root):
    for folder, *_ in HOSTS.values():
        for destination, source in SHARED.items():
            data = read_file(root, source)
            path = root / folder / destination
            if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != root):
                raise ValueError("Cannot synchronize through a symlink")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)


def check(root):
    expected = set(SOURCE_FILES)
    versions = set()
    for host, (folder, manifest_name, mcp_name, transport) in HOSTS.items():
        files = package_files(root, host)
        expected.update(f"{folder}/{name}" for name in files)
        for destination, source in SHARED.items():
            if files[destination] != read_file(root, source):
                raise ValueError(f"Usage guides differ: {host}/{destination}; run sync")
        manifest = json.loads(files[manifest_name])
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
            "type": transport, "url": "https://app.openorange.ai/mcp"
        }:
            raise ValueError("Only the public OpenOrange MCP connection is permitted")
        if host == "openai":
            extension = manifest["extensions"]["com.openai"]
            if extension.get("apps") is not None:
                raise ValueError("Public package cannot include an app binding")
            interface = extension["interface"]
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
    for host, (_, manifest_name, _, _) in HOSTS.items():
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
