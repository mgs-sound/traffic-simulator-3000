#!/usr/bin/env python3
"""Dev server: python3 -m http.server plus Cache-Control: no-store.

Chromium heuristically caches assets served without cache headers, which can
leave a stale main.js/config.js pair running after an edit — a miserable class
of phantom bug. no-store kills that for development; production hosting sets
its own cache policy.
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    http.server.ThreadingHTTPServer(('', PORT), NoStoreHandler).serve_forever()
