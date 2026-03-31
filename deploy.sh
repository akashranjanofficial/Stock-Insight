#!/usr/bin/env bash
# ============================================================
#  deploy.sh — Easy deployment script for Stock-Insight
# ============================================================
#  Usage:
#    ./deploy.sh                  # Commits & pushes all changes to current branch
#    ./deploy.sh "commit message" # Uses custom commit message
#    ./deploy.sh --prod           # Merges current branch into main & pushes (triggers GitHub Pages deploy)
#
#  GitHub Pages deployment is fully automatic via GitHub Actions.
#  Just push to 'main' and the workflow will build & deploy.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Stock-Insight Deploy Script        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

CURRENT_BRANCH=$(git branch --show-current)

# ── Helper: commit & push ──────────────────────────────────
commit_and_push() {
  local msg="${1:-"chore: update application code"}"

  # Check for changes
  if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo -e "${YELLOW}⚠  No changes to commit.${NC}"
    exit 0
  fi

  echo -e "${GREEN}→ Staging all changes...${NC}"
  git add -A

  echo -e "${GREEN}→ Committing: ${msg}${NC}"
  git commit -m "$msg"

  echo -e "${GREEN}→ Pushing to origin/${CURRENT_BRANCH}...${NC}"
  git push -u origin "$CURRENT_BRANCH"

  echo ""
  echo -e "${GREEN}✔ Pushed successfully to '${CURRENT_BRANCH}'.${NC}"

  if [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "${CYAN}🚀 GitHub Pages deployment will start automatically.${NC}"
    echo -e "${CYAN}   Check status: https://github.com/mkratnala/Stock-Insight/actions${NC}"
  else
    echo -e "${YELLOW}ℹ  To deploy, merge this branch into 'main' or run: ./deploy.sh --prod${NC}"
  fi
}

# ── Helper: merge to main & push ───────────────────────────
deploy_to_prod() {
  echo -e "${GREEN}→ Switching to main...${NC}"
  git checkout main

  echo -e "${GREEN}→ Pulling latest main...${NC}"
  git pull origin main

  echo -e "${GREEN}→ Merging '${CURRENT_BRANCH}' into main...${NC}"
  git merge "$CURRENT_BRANCH" --no-edit

  echo -e "${GREEN}→ Pushing main to origin...${NC}"
  git push origin main

  echo -e "${GREEN}→ Switching back to '${CURRENT_BRANCH}'...${NC}"
  git checkout "$CURRENT_BRANCH"

  echo ""
  echo -e "${GREEN}✔ Merged and pushed to main!${NC}"
  echo -e "${CYAN}🚀 GitHub Pages deployment will start automatically.${NC}"
  echo -e "${CYAN}   Check status : https://github.com/mkratnla/Stock-Insight/actions${NC}"
  echo -e "${CYAN}   Live site    : https://mkratnala.github.io/Stock-Insight/${NC}"
}

# ── Main ───────────────────────────────────────────────────
case "${1:-}" in
  --prod)
    if [ "$CURRENT_BRANCH" = "main" ]; then
      echo -e "${YELLOW}Already on main. Just pushing...${NC}"
      commit_and_push "${2:-"chore: update application code"}"
    else
      # Commit any pending changes first
      if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        commit_and_push "${2:-"chore: update before merge to main"}"
      fi
      deploy_to_prod
    fi
    ;;
  *)
    commit_and_push "${1:-"chore: update application code"}"
    ;;
esac
