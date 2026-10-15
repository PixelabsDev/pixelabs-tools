#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or discard working-tree changes before deploying." >&2
  exit 1
fi

assets_dir=$(mktemp -d "${TMPDIR:-/tmp}/pixelabs-tools-assets.XXXXXX")
cleanup() {
  python3 -c 'import shutil, sys; shutil.rmtree(sys.argv[1], ignore_errors=True)' "$assets_dir"
}
trap cleanup EXIT

git archive --format=tar HEAD | tar -xf - -C "$assets_dir"
wrangler deploy --assets "$assets_dir" "$@"
