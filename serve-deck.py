#!/usr/bin/env python3
"""No-cache dev server for the slides repo — run while editing.

Plain `python -m http.server` sends no cache headers, so browsers apply
heuristic caching and keep serving stale CSS/JS during rapid edits. This
variant sends no-store on every response AND ignores conditional requests,
so a reload always shows the latest files.

Usage (from anywhere):   python serve-deck.py [--port 8742] [--host 127.0.0.1]
Then open http://localhost:8742  (landing page; talks at /talks/<slug>/)

--host 0.0.0.0 serves the deck to other devices on the network — a phone
checking the narrow layout, or a lectern machine — so it is opt-in.

For just presenting a finished deck, any static server is fine.
"""
import argparse
import http.server
import os
import socketserver

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


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8742, help="port to listen on (default 8742)")
    ap.add_argument("--host", default="127.0.0.1",
                    help="interface to bind (default 127.0.0.1; 0.0.0.0 for the local network)")
    args = ap.parse_args(argv)
    shown = "localhost" if args.host in ("127.0.0.1", "0.0.0.0") else args.host
    with Server((args.host, args.port), NoCacheHandler) as server:
        print(f"Serving slides/ (no-cache) at http://{shown}:{args.port}  — Ctrl+C to stop")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
