#!/usr/bin/env python3
"""Tests for tools/check-links.py — the weekly link-rot check.

It is the only thing that notices a link in a published deck going dead, and
the issue it opens is the only signal, so its grading is what these pin: gone
is dead, guarded is merely unverified, and a server that dislikes HEAD gets a
second chance with GET. A local HTTP server plays every part; nothing leaves
the machine.
"""
import contextlib
import http.server
import importlib.util
import io
import json
import os
import socket
import ssl
import tempfile
import threading
import unittest
import urllib.error
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("check_links", os.path.join(HERE, "check-links.py"))
check_links = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_links)


class Handler(http.server.BaseHTTPRequestHandler):
    """path -> (HEAD status, GET status); /blip fails twice, then recovers."""
    ROUTES = {
        "/ok": (200, 200),
        "/gone": (404, 404),
        "/removed": (410, 410),
        "/walled": (403, 403),
        "/linkedin": (999, 999),
        "/server-error": (500, 500),
        "/no-head": (405, 200),
        "/guarded-head-then-gone": (403, 404),
    }
    hits = {}

    def respond(self, method):
        path = self.path.split("?")[0]
        Handler.hits[path] = Handler.hits.get(path, 0) + 1
        if path == "/redirect":
            self.send_response(301)
            self.send_header("Location", "/ok")
            self.end_headers()
            return
        if path == "/blip":
            status = 503 if Handler.hits[path] <= 2 else 200
        else:
            head, get = self.ROUTES.get(path, (404, 404))
            status = head if method == "HEAD" else get
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_HEAD(self):
        self.respond("HEAD")

    def do_GET(self):
        self.respond("GET")

    def log_message(self, *args):
        pass


class LocalServerCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        # A proxy in the environment must not stand between the probe and the
        # loopback server, or every grade would be the proxy's opinion.
        cls._env = mock.patch.dict(os.environ, {"no_proxy": "127.0.0.1,localhost",
                                                "NO_PROXY": "127.0.0.1,localhost"})
        cls._env.start()

    @classmethod
    def tearDownClass(cls):
        cls._env.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        Handler.hits = {}


class Probe(LocalServerCase):
    def grade(self, path):
        return check_links.probe(self.base + path, timeout=5)[0]

    def test_gone_statuses_are_dead(self):
        self.assertEqual(self.grade("/gone"), "dead")
        self.assertEqual(self.grade("/removed"), "dead")

    def test_bot_walls_and_server_trouble_are_only_unverified(self):
        self.assertEqual(self.grade("/walled"), "unverified")
        self.assertEqual(self.grade("/linkedin"), "unverified")
        self.assertEqual(self.grade("/server-error"), "unverified")

    def test_a_server_that_refuses_head_is_asked_again_with_get(self):
        self.assertEqual(self.grade("/no-head"), "ok")
        self.assertEqual(Handler.hits["/no-head"], 2)

    def test_the_get_answer_is_the_one_believed(self):
        self.assertEqual(self.grade("/guarded-head-then-gone"), "dead")

    def test_a_good_link_costs_one_request_and_redirects_are_followed(self):
        self.assertEqual(self.grade("/ok"), "ok")
        self.assertEqual(Handler.hits["/ok"], 1)
        self.assertEqual(self.grade("/redirect"), "ok")

    def test_a_refused_connection_is_dead(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        grade, detail = check_links.probe(f"http://127.0.0.1:{port}/", timeout=5)
        self.assertEqual(grade, "dead")
        self.assertIn("refused", detail)

    def test_a_malformed_url_is_reported_rather_than_crashing(self):
        self.assertEqual(check_links.probe("http://[::1/", timeout=5)[0], "dead")

    def test_check_retries_a_blip_before_believing_it(self):
        urls = {self.base + "/blip": ["talks/x/index.html"]}
        once = check_links.check(urls, timeout=5, workers=1, attempts=1)
        self.assertEqual(once[0].grade, "unverified")
        Handler.hits = {}
        with contextlib.redirect_stdout(io.StringIO()):     # "retrying 1 unhappy URL…"
            twice = check_links.check(urls, timeout=5, workers=1, attempts=2)
        self.assertEqual(twice[0].grade, "ok")


class ClassifyError(unittest.TestCase):
    def grade(self, exc):
        return check_links.classify_error(exc)[0]

    def test_evidence_that_the_link_itself_is_gone(self):
        self.assertEqual(self.grade(urllib.error.URLError(socket.gaierror(-2, "Name unknown"))), "dead")
        self.assertEqual(self.grade(urllib.error.URLError(ConnectionRefusedError())), "dead")
        self.assertEqual(self.grade(urllib.error.URLError(ssl.SSLCertVerificationError("bad cert"))), "dead")
        self.assertEqual(self.grade(ValueError("unknown url type")), "dead")

    def test_transient_failures_are_unverified(self):
        self.assertEqual(self.grade(urllib.error.URLError(socket.timeout("timed out"))), "unverified")
        self.assertEqual(self.grade(ConnectionResetError("reset")), "unverified")


class Report(unittest.TestCase):
    @staticmethod
    def result(url, grade="dead"):
        return check_links.Result(url, grade, "HTTP 404", ["talks/x/index.html"])

    def test_fingerprint_names_the_dead_set_not_its_order(self):
        a, b = self.result("https://a.example/"), self.result("https://b.example/")
        self.assertEqual(check_links.fingerprint([a, b]), check_links.fingerprint([b, a]))
        self.assertNotEqual(check_links.fingerprint([a]), check_links.fingerprint([a, b]))
        self.assertEqual(check_links.fingerprint([]), "clean")

    def test_markdown_carries_the_marker_the_workflow_finds_its_issue_by(self):
        dead = [self.result("https://a.example/")]
        body = check_links.render_markdown(dead, [self.result("https://b.example/", "unverified")], 2)
        self.assertTrue(body.startswith(f"<!-- link-check-report fingerprint={check_links.fingerprint(dead)} -->"))
        self.assertIn("## Dead links (1)", body)
        self.assertIn("## Could not verify (1)", body)
        self.assertIn("referenced by `talks/x/index.html`", body)


class Collect(LocalServerCase):
    def setUp(self):
        super().setUp()
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    def write(self, rel, html):
        path = os.path.join(self.root, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(html)

    def test_published_pages_only_with_fragments_folded(self):
        self.write("index.html", '<a href="https://a.example/page#one">a</a>'
                                 '<img src="//cdn.example/x.png" alt="">')
        self.write("talks/2026-01-01-demo/index.html", '<a href="https://a.example/page#two">a</a>'
                                                       '<a href="assets/local.pdf">local</a>')
        self.write("talks/_template/index.html", '<a href="https://placeholder.example/">p</a>')
        self.write("tools/fixture.html", '<a href="https://tooling.example/">t</a>')
        found = check_links.collect(self.root, skip=[])
        self.assertEqual(sorted(found), ["https://a.example/page", "https://cdn.example/x.png"])
        self.assertEqual(found["https://a.example/page"],
                         ["index.html", "talks/2026-01-01-demo/index.html"])
        self.assertEqual(check_links.collect(self.root, skip=["cdn.example"]).keys(),
                         {"https://a.example/page"})

    def run_main(self, argv):
        with contextlib.redirect_stdout(io.StringIO()):
            return check_links.main(["--root", self.root, "--timeout", "5", *argv])

    def test_exit_status_and_reports(self):
        self.write("index.html", f'<a href="{self.base}/ok">ok</a><a href="{self.base}/walled">w</a>')
        self.assertEqual(self.run_main([]), 0)
        self.assertEqual(self.run_main(["--strict"]), 1)
        self.write("talks/2026-01-01-demo/index.html", f'<a href="{self.base}/gone">gone</a>')
        report = os.path.join(self.root, "report.json")
        self.assertEqual(self.run_main(["--json", report]), 1)
        with open(report, encoding="utf-8") as handle:
            data = json.load(handle)
        self.assertEqual(data["checked"], 3)
        self.assertNotEqual(data["fingerprint"], "clean")
        grades = {row["url"].rsplit("/", 1)[1]: row["grade"] for row in data["results"]}
        self.assertEqual(grades, {"ok": "ok", "walled": "unverified", "gone": "dead"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
