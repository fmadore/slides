#!/usr/bin/env python3
"""Vendoring safety and freshness-check regression tests (no network)."""
import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


def module(filename):
    spec = importlib.util.spec_from_file_location(filename.replace("-", "_"),
                                                Path(__file__).parent / f"{filename}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


vendor = module("fetch-reveal")
checker = module("check-vendors")


def archive_bytes(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        for name, value in files.items():
            entry = tarfile.TarInfo(name)
            if value is None:
                entry.type = tarfile.SYMTYPE
                entry.linkname = "../../outside.js"
                archive.addfile(entry)
            else:
                entry.size = len(value)
                archive.addfile(entry, io.BytesIO(value))
    return output.getvalue()


class RevealVendoring(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "shared").mkdir()
        self.manifest_path = self.root / "shared/vendor-manifest.json"
        self.manifest = {"reveal.js": {"version": "6.0.1"},
                         "highlight.js": {"version": "11.12.0", "sha256": "preserve-me"}}
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        (self.root / "THIRD_PARTY_NOTICES.md").write_text(
            "# Notices\n\n## reveal.js — MIT\n\nOld notice.\n\n## Other\n\nKeep me.\n",
            encoding="utf-8")
        self.package = {"name": "reveal.js", "version": "6.0.2", "license": "MIT"}
        self.files = {remote: b"/* official file */\n" for remote in vendor.FILES.values()}
        self.files.update({"package/package.json": json.dumps(self.package).encode(),
                           "package/LICENSE": b"MIT License\nPermission is hereby granted\n"})
        self.set_archive(self.files)

    def set_archive(self, files):
        self.archive = archive_bytes(files)
        self.integrity = "sha512-" + base64.b64encode(hashlib.sha512(self.archive).digest()).decode()
        self.metadata = {**self.package, "gitHead": "a" * 40,
                         "dist": {"tarball": f"{vendor.REGISTRY}/-/reveal.js-6.0.2.tgz",
                                  "integrity": self.integrity}}

    def fetch(self, url):
        return self.archive if url.endswith(".tgz") else json.dumps(self.metadata).encode()

    def test_success_preserves_other_vendors_and_reproduces_exact_bytes(self):
        with patch.object(vendor, "download", side_effect=self.fetch):
            outputs = vendor.build_update(self.root, "6.0.2")
        self.assertEqual(json.loads(self.manifest_path.read_text()), self.manifest)
        vendor.install(outputs)
        actual = json.loads(self.manifest_path.read_text())
        self.assertEqual(actual["highlight.js"], self.manifest["highlight.js"])
        self.assertEqual(actual["reveal.js"]["dist"]["integrity"], self.integrity)
        for local, remote in vendor.FILES.items():
            self.assertEqual((self.root / "shared" / local).read_bytes(), self.files[remote])
        self.assertIn("## Other\n\nKeep me.", (self.root / "THIRD_PARTY_NOTICES.md").read_text())
        with patch.object(vendor, "download", side_effect=self.fetch):
            self.assertEqual(vendor.build_update(self.root, "6.0.2"), outputs)

    def test_corrupt_download_fails_before_any_file_changes(self):
        before = {path: path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        self.archive += b"tampering"
        with patch.object(vendor, "download", side_effect=self.fetch):
            with self.assertRaisesRegex(ValueError, "SHA-512 integrity"):
                vendor.build_update(self.root, "6.0.2")
        self.assertEqual(before, {path: path.read_bytes() for path in self.root.rglob("*") if path.is_file()})

    def test_existing_integrity_cannot_silently_change(self):
        self.manifest["reveal.js"] = {"version": "6.0.2", "dist": {"integrity": "sha512-old"}}
        self.manifest_path.write_text(json.dumps(self.manifest))
        with patch.object(vendor, "download", side_effect=self.fetch):
            with self.assertRaisesRegex(ValueError, "recorded release"):
                vendor.build_update(self.root, "6.0.2")

    def test_archive_package_version_must_match_metadata(self):
        self.files["package/package.json"] = json.dumps({**self.package, "version": "6.0.1"}).encode()
        self.set_archive(self.files)
        with patch.object(vendor, "download", side_effect=self.fetch):
            with self.assertRaisesRegex(ValueError, "archive package identity"):
                vendor.build_update(self.root, "6.0.2")

    def test_missing_file_and_symlink_are_rejected_without_extraction(self):
        remote = vendor.FILES["reveal/reveal.js"]
        for altered in ({name: data for name, data in self.files.items() if name != remote},
                        {**self.files, remote: None}):
            with self.subTest(files=sorted(altered)):
                with self.assertRaises(ValueError):
                    vendor.archive_files(archive_bytes(altered))
        self.assertFalse((self.root / "outside.js").exists())

    def test_invalid_javascript_is_rejected_before_install(self):
        self.files["package/dist/reveal.js"] = b"function broken( {"
        self.set_archive(self.files)
        with patch.object(vendor, "download", side_effect=self.fetch):
            with self.assertRaisesRegex(ValueError, "syntax check failed"):
                vendor.build_update(self.root, "6.0.2")
        self.assertFalse((self.root / "shared/reveal/reveal.js").exists())

    def test_partial_write_failure_restores_previous_files(self):
        old = self.root / "old.js"
        new = self.root / "new.js"
        failed = self.root / "failed.js"
        old.write_bytes(b"original")
        real_write = vendor.atomic_write

        def fail_once(path, value):
            if path == failed:
                raise OSError("disk full")
            real_write(path, value)

        with patch.object(vendor, "atomic_write", side_effect=fail_once):
            with self.assertRaisesRegex(OSError, "disk full"):
                vendor.install({old: b"updated", new: b"new", failed: b"unwritten"})
        self.assertEqual(old.read_bytes(), b"original")
        self.assertFalse(new.exists())
        self.assertFalse(failed.exists())

    def test_nonexact_versions_do_not_fetch(self):
        with patch.object(vendor, "download") as fetch:
            for version in ("latest", "6", "^6.0.2", "6.0.2-beta.1", "../../6.0.2"):
                with self.subTest(version=version), self.assertRaises(ValueError):
                    vendor.build_update(self.root, version)
            fetch.assert_not_called()


class FreshnessCheck(unittest.TestCase):
    def setUp(self):
        self.manifest = {"reveal.js": {"version": "6.0.2"}, "highlight.js": {"version": "11.12.0"}}

    def current(self, package):
        return {"name": package, "version": self.manifest[package]["version"]}

    def test_current_and_missing_manifest_package(self):
        results, code = checker.check(self.manifest, self.current)
        self.assertEqual(code, 0)
        self.assertEqual([result["status"] for result in results], ["current", "current"])
        results, code = checker.check({}, self.current)
        self.assertEqual(code, 2)
        self.assertTrue(all(result["status"] == "error" for result in results))

    def test_numeric_version_ordering_and_mismatch_exit_status(self):
        self.manifest["reveal.js"]["version"] = "6.9.0"
        results, code = checker.check(self.manifest, lambda package: (
            {"name": package, "version": "6.10.0"} if package == "reveal.js" else self.current(package)))
        self.assertEqual(code, 1)
        self.assertEqual(results[0]["status"], "update-available")

    def test_one_lookup_failure_still_checks_other_vendor(self):
        calls = []

        def fetch(package):
            calls.append(package)
            if package == "reveal.js":
                raise OSError("offline")
            return self.current(package)

        results, code = checker.check(self.manifest, fetch)
        self.assertEqual(code, 2)
        self.assertEqual(calls, list(checker.PACKAGES))
        self.assertEqual([result["status"] for result in results], ["error", "current"])

    def test_wrong_registry_identity_and_prerelease_fail_closed(self):
        for metadata in ({"name": "wrong", "version": "6.0.2"},
                         {"name": "reveal.js", "version": "7.0.0-beta.1"}):
            with self.subTest(metadata=metadata):
                results, code = checker.check(self.manifest, lambda package: metadata)
                self.assertEqual(code, 2)
                self.assertEqual(results[0]["status"], "error")


if __name__ == "__main__":
    unittest.main()
