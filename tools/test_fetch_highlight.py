"""A failed vendor regeneration must retain both last-known-good files."""
import importlib.util
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('fetch_highlight', Path(__file__).with_name('fetch-highlight.py'))
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)


class TransactionalHighlight(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / 'highlight.min.js'
        self.manifest = self.root / 'vendor-manifest.json'
        self.bundle.write_text('previous working bundle')
        self.manifest.write_text(json.dumps({'reveal.js': {'version': 'preserve'}}))
        self.before = {path: path.read_bytes() for path in (self.bundle, self.manifest)}

    def unchanged(self):
        for path, content in self.before.items():
            self.assertEqual(path.read_bytes(), content)
        self.assertEqual(sorted(path.name for path in self.root.iterdir()), ['highlight.min.js', 'vendor-manifest.json'])

    def source(self, path):
        if path == 'core.min.js':
            return 'export default {versionString:"11.12.0",registerLanguage(){},getLanguage(){return true},highlight(){}};'
        return 'export default function(){return {}};'

    def test_network_failure_never_changes_public_files(self):
        with patch.object(fetch, 'get', side_effect=OSError('offline')), self.assertRaises(OSError):
            fetch.build_bundle(self.bundle)
        self.unchanged()

    def test_syntax_failure_retains_public_files(self):
        with patch.object(fetch, 'get', return_value='export default {{{'), self.assertRaises(subprocess.CalledProcessError), \
                patch.object(fetch.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'node')):
            fetch.build_bundle(self.bundle)
        self.unchanged()

    def test_validation_is_required_and_preserves_files_without_node(self):
        with patch.object(fetch, 'get', side_effect=self.source), \
                patch.object(fetch, 'validate_bundle', side_effect=FileNotFoundError('node')), self.assertRaises(FileNotFoundError):
            fetch.build_bundle(self.bundle)
        self.unchanged()

    def test_second_rename_failure_rolls_back_bundle(self):
        replace = os.replace
        calls = 0
        def fail_second(source, target):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('manifest is locked')
            return replace(source, target)
        with patch.object(fetch, 'get', side_effect=self.source), patch.object(fetch, 'validate_bundle'), \
                patch.object(fetch.os, 'replace', side_effect=fail_second), self.assertRaises(OSError):
            fetch.build_bundle(self.bundle)
        self.unchanged()

    def test_failed_rollback_preserves_recovery_bytes(self):
        replace = os.replace
        calls = 0
        def fail_after_first(source, target):
            nonlocal calls
            calls += 1
            if calls > 1:
                raise OSError('destination locked')
            return replace(source, target)
        with patch.object(fetch, 'get', side_effect=self.source), patch.object(fetch, 'validate_bundle'), \
                patch.object(fetch.os, 'replace', side_effect=fail_after_first), self.assertRaisesRegex(RuntimeError, 'preserved at'):
            fetch.build_bundle(self.bundle)
        recovery = list(self.root.glob('.highlight-recovery-*'))
        self.assertEqual(len(recovery), 1)
        self.assertEqual(recovery[0].read_bytes(), self.before[self.bundle])
        self.assertEqual(self.manifest.read_bytes(), self.before[self.manifest])

    def test_success_checks_real_javascript_and_preserves_other_packages(self):
        with patch.object(fetch, 'get', side_effect=self.source):
            fetch.build_bundle(self.bundle)
        manifest = json.loads(self.manifest.read_text())
        self.assertEqual(manifest['reveal.js']['version'], 'preserve')
        self.assertEqual(manifest['highlight.js']['sha256'], fetch.hashlib.sha256(self.bundle.read_bytes()).hexdigest())

    def test_concurrent_manifest_edit_is_not_overwritten(self):
        def concurrent_edit(_path):
            self.manifest.write_text('{"other":"new"}')
        with patch.object(fetch, 'get', side_effect=self.source), patch.object(fetch, 'validate_bundle', side_effect=concurrent_edit), \
                self.assertRaisesRegex(RuntimeError, 'changed during generation'):
            fetch.build_bundle(self.bundle)
        self.assertEqual(self.bundle.read_bytes(), self.before[self.bundle])
        self.assertEqual(self.manifest.read_text(), '{"other":"new"}')


if __name__ == '__main__':
    unittest.main()
