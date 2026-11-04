"""Local dev server for Office Live: like `python -m http.server`, but tells the browser not to
cache, so code and sprite changes show up on a normal refresh.

Auto-login by IP: if `autologin.json` exists next to index.html (it is git-ignored), a browser
calling GET /autologin from one of its IPs gets a fresh Supabase session for that account, so the
game connects to the ponto without the login form. The password never leaves this machine; the
browser only receives the session tokens. Any other IP (and GitHub Pages) gets 404 = normal login.

autologin.json:
  { "ips": ["192.168.0.8", "127.0.0.1", "::1"], "email": "someone@engmr.com.br", "password": "..." }
(opening http://localhost:8080 on the server PC itself arrives from 127.0.0.1 / ::1, not its LAN IP)
"""
import http.server, json, os, sys, urllib.request, urllib.error

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# same project + publishable key as src/supabase.js
SUPABASE_URL = 'https://wfkypsbbfbtpsxlufozo.supabase.co'
SUPABASE_KEY = 'sb_publishable_6qKuHStezjK4YauR7DgsAQ_FGEn43re'
CONFIG = 'autologin.json'


def load_config():
    try:
        with open(CONFIG, encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def supabase_session(email, password):
    req = urllib.request.Request(
        SUPABASE_URL + '/auth/v1/token?grant_type=password',
        data=json.dumps({'email': email, 'password': password}).encode(),
        headers={'apikey': SUPABASE_KEY, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.load(r)
    return {'access_token': data['access_token'], 'refresh_token': data['refresh_token']}


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/autologin':
            return self.autologin()
        if self.path.split('?')[0].lstrip('/') == CONFIG:  # never serve the credentials file
            return self.send_error(404)
        super().do_GET()

    def autologin(self):
        ip = self.client_address[0].removeprefix('::ffff:')
        cfg = load_config()
        if not cfg or ip not in cfg.get('ips', []):
            return self.send_error(404)
        try:
            body = json.dumps(supabase_session(cfg['email'], cfg['password'])).encode()
        except (urllib.error.URLError, KeyError, ValueError) as e:
            self.log_message('autologin for %s failed: %s', ip, e)
            return self.send_error(502)
        self.log_message('autologin: %s signed in as %s', ip, cfg['email'])
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


http.server.ThreadingHTTPServer(('', PORT), NoCache).serve_forever()
