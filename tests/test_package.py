import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package", ROOT / "scripts/package.py")
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        shutil.copytree(ROOT, self.root, ignore=shutil.ignore_patterns(".git", "dist", "__pycache__"))

    def test_both_archives_contain_only_the_approved_inventory(self):
        output = Path(self.temp.name) / "output"
        package.build(self.root, output)
        connections = {
            "claude": {"type": "http", "url": "https://app.openorange.ai/mcp"},
            "openai": {"type": "streamable-http", "url": "https://app.openorange.ai/mcp/openorange-usage"},
        }
        for host, (_, manifest_name, mcp_name, *_) in package.HOSTS.items():
            files = package.package_files(self.root, host)
            manifest = json.loads(files[manifest_name])
            with zipfile.ZipFile(output / f"openorange-{host}-{manifest['version']}.zip") as bundle:
                self.assertEqual(bundle.namelist(), [f"{manifest['name']}/{name}" for name in files])
                for name, data in files.items():
                    self.assertEqual(bundle.read(f"{manifest['name']}/{name}"), data)
                connection = json.loads(bundle.read(f"{manifest['name']}/{mcp_name}"))
                self.assertEqual(connection["mcpServers"]["openorange"], connections[host])

    def test_private_file_blocks_build(self):
        (self.root / "plugins/openorange/private.env").write_text("EXAMPLE_SECRET=synthetic\n")
        with self.assertRaises(ValueError):
            package.build(self.root, Path(self.temp.name) / "output")

    def test_card_icons_must_be_files_of_the_package(self):
        manifest = self.root / "packages/openai/openorange-connect/plugin.json"
        original = manifest.read_text()
        for field in ("logo", "composerIcon"):
            with self.subTest(field=field):
                data = json.loads(original)
                data["extensions"]["com.openai"]["interface"][field] = "./assets/missing.png"
                manifest.write_text(json.dumps(data, indent=2) + "\n")
                with self.assertRaisesRegex(ValueError, f"{field} must name a file in the package"):
                    package.check(self.root)
        manifest.write_text(original)

    def test_extra_repository_file_blocks_build(self):
        (self.root / "unrelated.md").write_text("Unapproved content")
        with self.assertRaises(ValueError):
            package.check(self.root)

    def test_symlink_blocks_build(self):
        path = self.root / "plugins/openorange/README.md"
        path.unlink()
        path.symlink_to(self.root / "README.md")
        with self.assertRaises(ValueError):
            package.check(self.root)

    def test_guides_cannot_drift_between_hosts(self):
        path = self.root / "packages/openai/openorange-connect/skills/openorange/SKILL.md"
        path.write_text(path.read_text() + "\nChanged copy\n")
        with self.assertRaises(ValueError):
            package.check(self.root)

    def test_agent_guide_block_cannot_be_edited_by_hand(self):
        for relative in package.GUIDE_DOCS:
            with self.subTest(doc=relative):
                path = self.root / relative
                original = path.read_bytes()
                every = f"every {json.loads((self.root / package.GUIDE).read_text())['checkEveryMinutes']} minutes"
                path.write_text(path.read_text().replace(every, "when the person asks"))
                with self.assertRaisesRegex(ValueError, "Agent guide is stale"):
                    package.check(self.root)
                path.write_bytes(original)

    def test_a_new_agent_guide_reaches_every_package_through_sync(self):
        path = self.root / package.GUIDE
        guide = json.loads(path.read_text())
        guide["layer"] = "staging 0000000 (synthetic)"
        every = f"every {guide['checkEveryMinutes']} minutes"
        guide["stayInTouch"][2]["how"] = guide["stayInTouch"][2]["how"].replace(every, "every 10 minutes")
        guide["markdown"] = guide["markdown"].replace(every, "every 10 minutes")
        path.write_text(json.dumps(guide))
        with self.assertRaisesRegex(ValueError, "Agent guide is stale"):
            package.check(self.root)
        package.sync(self.root)
        package.check(self.root)
        for host, (folder, *_) in package.HOSTS.items():
            for name in ("skills/openorange/SKILL.md", "skills/openorange/references/mcp.md"):
                with self.subTest(host=host, name=name):
                    text = (self.root / folder / name).read_text()
                    self.assertIn("every 10 minutes", text)
                    self.assertNotIn(every, text)

    def test_agent_guide_needs_its_layer_its_markers_and_one_text(self):
        path = self.root / package.GUIDE
        original = path.read_bytes()
        changes = {
            "Layer commit": lambda guide: guide.pop("layer"),
            "differs from its ways": lambda guide: guide.update(markdown=guide["markdown"].replace("never add another", "add one")),
        }
        for message, change in changes.items():
            with self.subTest(message=message):
                guide = json.loads(original)
                change(guide)
                path.write_text(json.dumps(guide))
                with self.assertRaisesRegex(ValueError, message):
                    package.check(self.root)
                path.write_bytes(original)
        skill = self.root / "usage/SKILL.md"
        skill.write_text(skill.read_text().replace(package.GUIDE_END, ""))
        with self.assertRaisesRegex(ValueError, "markers are missing"):
            package.sync(self.root)

    def test_plugin_identity_cannot_change_or_reuse_previous_name(self):
        wrong_names = {"claude": "openorange-connect", "openai": "openorange-usage"}
        for host, (folder, manifest_name, *_) in package.HOSTS.items():
            with self.subTest(host=host):
                path = self.root / folder / manifest_name
                original = path.read_bytes()
                manifest = json.loads(original)
                manifest["name"] = wrong_names[host]
                path.write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, "plugin identity"):
                    package.check(self.root)
                path.write_bytes(original)

    def test_connection_cannot_add_credentials_or_change_destination(self):
        for host, (folder, _, mcp_name, *_) in package.HOSTS.items():
            path = self.root / folder / mcp_name
            original = path.read_bytes()
            for extra in ({"headers": {"Authorization": "synthetic"}}, {"url": "https://example.com/mcp"}):
                with self.subTest(host=host, extra=extra):
                    changed = json.loads(original)
                    changed["mcpServers"]["openorange"].update(extra)
                    path.write_text(json.dumps(changed))
                    with self.assertRaises(ValueError):
                        package.check(self.root)
                    path.write_bytes(original)

    def test_connection_cannot_switch_host_endpoints(self):
        wrong_connections = {
            "claude": "https://app.openorange.ai/mcp/openorange-usage",
            "openai": "https://app.openorange.ai/mcp",
        }
        for host, (folder, _, mcp_name, _, endpoint) in package.HOSTS.items():
            path = self.root / folder / mcp_name
            original = path.read_bytes()
            for wrong in (wrong_connections[host], endpoint + "?workspace=other"):
                with self.subTest(host=host, url=wrong):
                    changed = json.loads(original)
                    changed["mcpServers"]["openorange"]["url"] = wrong
                    path.write_text(json.dumps(changed))
                    with self.assertRaisesRegex(ValueError, "public OpenOrange MCP connection"):
                        package.check(self.root)
                    path.write_bytes(original)

    def test_marketplace_cannot_redirect_to_external_source(self):
        path = self.root / ".claude-plugin/marketplace.json"
        config = json.loads(path.read_text())
        config["plugins"][0]["source"] = "../another-plugin"
        path.write_text(json.dumps(config))
        with self.assertRaises(ValueError):
            package.check(self.root)

    def test_archives_are_reproducible(self):
        first = Path(self.temp.name) / "first"
        second = Path(self.temp.name) / "second"
        package.build(self.root, first)
        package.build(self.root, second)
        for path in first.iterdir():
            self.assertEqual(path.read_bytes(), (second / path.name).read_bytes())


if __name__ == "__main__":
    unittest.main()
