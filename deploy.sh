#!/bin/bash
# Initializes this folder as a git repo and pushes to gabrielsnyder/ai-grades
set -e

REPO="https://github.com/gabrielsnyder/ai-grades.git"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "→ Working in: $DIR"
cd "$DIR"

if [ ! -d ".git" ]; then
  git init
  echo "→ Initialized git repo"
fi

git add .
git commit -m "Initial commit: Senate AI Policy Tracker (React + Vite)" || echo "(nothing new to commit)"

git branch -M main

if ! git remote get-url origin &>/dev/null; then
  git remote add origin "$REPO"
  echo "→ Remote added: $REPO"
fi

git push -u origin main
echo "✓ Pushed to $REPO"
