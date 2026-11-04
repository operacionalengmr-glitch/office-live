"""Local dev server for Office Live: like `python -m http.server`, but tells the browser not to
cache, so code and sprite changes show up on a normal refresh."""
import http.server, os, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


http.server.ThreadingHTTPServer(('', PORT), NoCache).serve_forever()
