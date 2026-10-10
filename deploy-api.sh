#!/usr/bin/env bash
# Build and publish the Veil L1-supply API service to the self-hosted server.
#
# The site itself is static files behind nginx (see deploy.sh), which has no serverless runtime --
# so the /api/l1-supply handler runs as a plain long-lived Node service on a loopback port, with
# nginx proxying /api/ to it. This uploads the compiled handler, its proto files and a minimal
# package.json, installs just the two gRPC deps on the box, and restarts the unit.
set -euo pipefail

HOST="${DEPLOY_HOST:-racknerd-new}"
ROOT="/opt/veil-api"
PORT="${VEIL_API_PORT:-8792}"

echo "==> building api"
npm run build:api
rm -rf dist-api/api/proto && mkdir -p dist-api/api/proto
cp api/proto/*.proto dist-api/api/proto/

# Only the runtime deps the handler actually imports -- the service never touches React or Vite.
# Versions are read from the repo's package.json so the box can't silently drift from the build.
node -e '
const pkg = require("./package.json");
require("fs").writeFileSync("dist-api/package.json", JSON.stringify({
  name: "veil-api",
  private: true,
  type: "module",
  dependencies: {
    "@grpc/grpc-js": pkg.dependencies["@grpc/grpc-js"],
    "@grpc/proto-loader": pkg.dependencies["@grpc/proto-loader"],
  },
}, null, 2) + "\n");
'

echo "==> uploading to $HOST"
tar -czf - -C dist-api . | ssh "$HOST" "
  set -e
  rm -rf $ROOT.new && mkdir -p $ROOT.new
  tar -xzf - -C $ROOT.new
  cd $ROOT.new && npm install --omit=dev --no-audit --no-fund --loglevel=error
  rm -rf $ROOT.old
  [ -d $ROOT ] && mv $ROOT $ROOT.old
  mv $ROOT.new $ROOT
  rm -rf $ROOT.old
  systemctl restart veil-api
"

echo "==> verifying"
for i in $(seq 1 10); do
  code=$(ssh "$HOST" "curl -s -o /dev/null -m 20 -w '%{http_code}' http://127.0.0.1:$PORT/api/l1-supply" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "  loopback  http://127.0.0.1:$PORT/api/l1-supply -> ${code:-000}"
curl -fsS -o /dev/null -m 30 -w "  public    https://explorer.tari.mw/api/l1-supply -> %{http_code}\n" \
  https://explorer.tari.mw/api/l1-supply
echo "done"
