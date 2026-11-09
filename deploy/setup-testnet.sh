#!/usr/bin/env bash
# Creates the testnet explorer's nginx site on the server, derived from the live explorer site.
# testnet-explorer.tari.mw is a Cloudflare Worker (deploy/testnet-worker) forwarding to this origin name.
# Run: ssh racknerd-new 'bash -s' < deploy/setup-testnet.sh
set -euo pipefail
DOMAIN=testnet-explorer.172-245-5-169.sslip.io
SRC=/etc/nginx/sites-available/ootle-explorer
DST=/etc/nginx/sites-available/ootle-explorer-testnet

python3 - "$SRC" "$DST" "$DOMAIN" <<'PY'
import re, sys
src, dst, domain = sys.argv[1:]
s = open(src).read()
main = s[s.index("# Veil"):s.index("# Kept for verification by IP")]
main = main.replace("server_name explorer.tari.mw 172-245-5-169.sslip.io;", f"server_name {domain};\n    listen 80;\n    listen [::]:80;")
main = main.replace("root /var/www/ootle-explorer;", "root /var/www/ootle-explorer-testnet;")
main = main.replace("http://127.0.0.1:8793", "http://127.0.0.1:8794")
main = re.sub(r"^.*managed by Certbot\n", "", main, flags=re.M)
open(dst, "w").write(main)
PY

ln -sf "$DST" /etc/nginx/sites-enabled/ootle-explorer-testnet
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/ootle-explorer-testnet "$DST"
  echo "nginx -t failed; removed the new site" >&2
  exit 1
fi
systemctl reload nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --keep-until-expiring --register-unsafely-without-email
nginx -t && systemctl reload nginx
curl -sS -o /dev/null -m 15 -w "https://$DOMAIN/ -> %{http_code}\n" "https://$DOMAIN/"
