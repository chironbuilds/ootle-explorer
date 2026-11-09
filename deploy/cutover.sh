#!/usr/bin/env bash
# Moves explorer.tari.mw to its mainnet build with one nginx reload.
#   cutover.sh             switch now, if the mainnet indexer is serving mainnet
#   cutover.sh --wait      keep checking every 15 s, then switch
#   cutover.sh --rollback  restore the config saved by the last switch
set -euo pipefail
SITE=/etc/nginx/sites-available/ootle-explorer
BACKUP=/root/ootle-explorer.nginx.pre-mainnet
INDEXER=https://indexer-a.ootle.tari.com

if [ "${1:-}" = "--rollback" ]; then
  cp "$BACKUP" "$SITE"
  nginx -t
  systemctl start veil-og
  systemctl reload nginx
  echo "rolled back explorer.tari.mw to the saved config"
  exit 0
fi

ready() { curl -fsS -m 10 "$INDEXER/network" 2>/dev/null | grep -q '"network_byte":0'; }
if ! ready; then
  [ "${1:-}" = "--wait" ] || { echo "mainnet indexer is not serving mainnet yet; nothing changed" >&2; exit 1; }
  until ready; do sleep 15; done
fi

if grep -q "root /var/www/ootle-explorer-mainnet;" "$SITE"; then
  echo "already on mainnet"
  exit 0
fi
[ -f /var/www/ootle-explorer-mainnet/index.html ] || { echo "no mainnet build on the server" >&2; exit 1; }

cp "$SITE" "$BACKUP"
sed -i -e 's#root /var/www/ootle-explorer;#root /var/www/ootle-explorer-mainnet;#' -e 's#http://127.0.0.1:8793#http://127.0.0.1:8795#g' "$SITE"
if ! nginx -t; then
  cp "$BACKUP" "$SITE"
  echo "nginx -t failed; restored the previous config" >&2
  exit 1
fi
systemctl reload nginx
systemctl stop veil-og
echo "explorer.tari.mw now serves mainnet ($(date -u +%FT%TZ))"
