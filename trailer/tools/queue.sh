#!/bin/sh
# run batch files listed in queue.txt one after another (one browser at a time); append to queue.txt to add more
cd "$(dirname "$0")"
while true; do
  next=$(grep -v '^#' queue.txt | head -1)
  [ -z "$next" ] && { sleep 5; continue; }
  sed -i "0,/^$next\$/s//#$next/" queue.txt
  echo "== batch $next $(date +%T)"
  PROF=1 python3 scout.py "$next" 1
done
