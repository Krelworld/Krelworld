#!/usr/bin/env bash
# Put the built game in its own repo (Krelworld/glory-quest), which deploys itself to
# https://krelworld.github.io/glory-quest/ and touches nothing else.
# Usage, from stadium/ after `node build.mjs`:  tools/deploy-repo.sh /path/to/knockout-day-clone
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=${1:?path to a clone of the glory-quest repo}
SITE="$REPO/site"
rm -rf "$SITE"; mkdir -p "$SITE" "$REPO/.github/workflows"
cp tools/site/pages.yml "$REPO/.github/workflows/pages.yml"
cp dist/stadium/local.html "$SITE/index.html"
cp dist/stadium/game.js "$SITE/"
for d in art audio icons kit tiles scenes world; do
  mkdir -p "$SITE/$d"
  find "dist/stadium/$d" -maxdepth 1 \( -name '*.png' -o -name '*.mp3' \) -exec cp {} "$SITE/$d/" \;
done
touch "$SITE/.nojekyll"
cat > "$REPO/README.md" <<'MD'
# Knockout Day

A darkly comic football-day sandbox. Play it at https://krelworld.github.io/glory-quest/

This repo only holds the built game in `site/`; the source is in `stadium/` on the
`claude/determined-lamport-hhdywr` branch of Krelworld/Krelworld, deployed here by
`stadium/tools/deploy-repo.sh`.
MD
cd "$REPO"
git add -A
git diff --cached --quiet && { echo "nothing changed"; exit 0; }
git commit -q -m "Deploy Knockout Day build${DEPLOY_TRAILER:+

$DEPLOY_TRAILER}"
git push -q -u origin HEAD:main && echo "pushed: https://krelworld.github.io/glory-quest/"
