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
        for host, (_, manifest_name, _, _) in package.HOSTS.items():
            files = package.package_files(self.root, host)
            manifest = json.loads(files[manifest_name])
            with zipfile.ZipFile(output / f"openorange-{host}-{manifest['version']}.zip") as bundle:
                self.assertEqual(bundle.namelist(), [f"{manifest['name']}/{name}" for name in files])
                for name, data in files.items():
                    self.assertEqual(bundle.read(f"{manifest['name']}/{name}"), data)

    def test_private_file_blocks_build(self):
        (self.root / "plugins/openorange/private.env").write_text("EXAMPLE_SECRET=synthetic\n")
        with self.assertRaises(ValueError):
            package.build(self.root, Path(self.temp.name) / "output")

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
        path = self.root / "packages/openai/openorange-mcp/skills/openorange/SKILL.md"
        path.write_text(path.read_text() + "\nChanged copy\n")
        with self.assertRaises(ValueError):
            package.check(self.root)

    def test_connection_cannot_add_credentials_or_change_destination(self):
        path = self.root / "plugins/openorange/.mcp.json"
        config = json.loads(path.read_text())
        for extra in ({"headers": {"Authorization": "synthetic"}}, {"url": "https://example.com/mcp"}):
            changed = json.loads(json.dumps(config))
            changed["mcpServers"]["openorange"].update(extra)
            path.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                package.check(self.root)

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
