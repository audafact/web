#!/bin/bash
#
# GUARD: Refuse to run destructive DB commands (db reset, db push to remote) against prod.
# Source this from scripts that run supabase db reset, db push, or other destructive ops.
#
# Usage: source scripts/guard-destructive.sh
# Or: . scripts/guard-destructive.sh
#
# Reads linked project from supabase/.temp/project-ref or SUPABASE_PROJECT_REF env.

set -e

PROD_REF="julxtxaspzhwbylnqkkj"
RED='\033[0;31m'
NC='\033[0m'

# Resolve script dir (when sourced, $0 may be bash)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

LINKED_REF=""
if [ -n "$SUPABASE_PROJECT_REF" ]; then
  LINKED_REF="$SUPABASE_PROJECT_REF"
elif [ -f "supabase/.temp/project-ref" ]; then
  LINKED_REF=$(cat supabase/.temp/project-ref 2>/dev/null | tr -d '[:space:]')
fi

if [ -n "$LINKED_REF" ] && [ "$LINKED_REF" = "$PROD_REF" ]; then
  echo -e "${RED}[GUARD]${NC} Linked project is PROD ($PROD_REF). Refusing to run destructive commands."
  echo "Run destructive commands on local (supabase start) or staging only."
  echo "Unlink prod: supabase unlink. Link staging: supabase link --project-ref YOUR_STAGING_REF"
  exit 1
fi
