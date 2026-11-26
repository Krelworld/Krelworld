#!/usr/bin/env bash
# Put the built game on the Krelworld GitHub Pages site, the way the other games are hosted:
# as a folder, public/knockout-day/, on the claude/krelworld-game branch, whose workflow deploys
# the whole site to https://krelworld.github.io/Krelworld/ on every push.
# Only that one folder is touched. Run from stadium/ after `node build.mjs`.
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH=claude/krelworld-game
WT=$(mktemp -d)
git fetch -q origin "$BRANCH"
git worktree add -q --detach "$WT" FETCH_HEAD
trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
DEST="$WT/public/knockout-day"
rm -rf "$DEST"
mkdir -p "$DEST"
# The standalone page (with its own <html> head), the game, and the loose assets (no file limit here).
cp dist/stadium/local.html "$DEST/index.html"
cp dist/stadium/game.js "$DEST/"
for d in art audio icons kit tiles scenes world; do
  mkdir -p "$DEST/$d"
  find "dist/stadium/$d" -maxdepth 1 \( -name '*.png' -o -name '*.mp3' \) -exec cp {} "$DEST/$d/" \;
done
cat > "$DEST/README.md" <<'EOF'
# Knockout Day

Built from `stadium/` on the `claude/determined-lamport-hhdywr` branch by `stadium/tools/deploy-pages.sh`.
Don't edit here: rebuild and redeploy from the source branch.
EOF
cd "$WT"
git add public/knockout-day
if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
git commit -q -m "Knockout Day: deploy build to public/knockout-day

${DEPLOY_TRAILER:-}"
for i in 1 2 3 4; do
  if git push -q origin "HEAD:$BRANCH"; then echo "pushed: https://krelworld.github.io/Krelworld/knockout-day/"; exit 0; fi
  # Someone else pushed to the site branch meanwhile: put our one folder on top of theirs and retry.
  sleep $((i * 2)); git fetch -q origin "$BRANCH"; git rebase -q FETCH_HEAD
done
echo "push failed" >&2; exit 1
