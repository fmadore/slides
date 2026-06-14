#!/usr/bin/env python3
"""No-cache dev server for the slides repo — run while editing.

Plain `python -m http.server` sends no cache headers, so browsers apply
heuristic caching and keep serving stale CSS/JS during rapid edits. This
variant sends no-store on every response AND ignores conditional requests,
so a reload always shows the latest files.

Usage (from the repo root):   python serve-deck.py
Then open http://localhost:8742  (landing page; talks at /talks/<slug>/)

For just presenting a finished deck, any static server is fine.
"""
import http.server
import os
import socketserver

PORT = 8742
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # serve this folder


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        for h in ("If-Modified-Since", "If-None-Match"):
            if h in self.headers:
                del self.headers[h]
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    # Threaded so the browser's parallel asset + keep-alive requests don't
    # deadlock a single worker (reveal.js opens many connections at once).
    allow_reuse_address = True
    daemon_threads = True


print(f"Serving slides/ (no-cache) at http://localhost:{PORT}")
Server(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
