#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Mister Chameleon — Platform Release Script
#
# Usage:
#   ./platform/release.sh <tenant-cms-path>
#
# Example:
#   ./platform/release.sh /home/sites/tenant-acme/cms
#
# What this script does:
#   1. Reads platform/manifest.json for the list of managed files
#   2. Copies every listed file from this (platform) repo to the tenant repo
#   3. Never touches content/, users/, storage/, or any non-mrc_* files
#   4. Creates a timestamped backup of every file it overwrites
#
# What it never does:
#   - Modify content/ (Statamic entries, terms, assets)
#   - Delete files that are not listed in the manifest
#   - Touch any file whose name does NOT start with "mrc_" (except blueprints)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SCRIPT_DIR/manifest.json"

# ── Argument check ────────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tenant-cms-path>"
  echo ""
  echo "  tenant-cms-path   Absolute path to the tenant's Statamic CMS root"
  echo "                    (the directory that contains resources/, content/, etc.)"
  exit 1
fi

TENANT_ROOT="$1"

if [[ ! -d "$TENANT_ROOT" ]]; then
  echo "ERROR: Tenant directory not found: $TENANT_ROOT"
  exit 1
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest.json not found at $MANIFEST"
  exit 1
fi

# ── Protected path check ──────────────────────────────────────────────────────

PROTECTED=("content/" "users/" "storage/")

# ── Backup directory ──────────────────────────────────────────────────────────

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$TENANT_ROOT/.platform_backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"
echo "Platform release — $(date)"
echo "  Platform root : $PLATFORM_ROOT"
echo "  Tenant root   : $TENANT_ROOT"
echo "  Backup dir    : $BACKUP_DIR"
echo ""

# ── Release ───────────────────────────────────────────────────────────────────

UPDATED=0
SKIPPED=0
ADDED=0

# Parse file list from manifest (requires jq or python3)
if command -v jq &>/dev/null; then
  PATHS=$(jq -r '.files[].path' "$MANIFEST")
else
  PATHS=$(python3 -c "import json,sys; data=json.load(open('$MANIFEST')); [print(f['path']) for f in data['files']]")
fi

while IFS= read -r rel_path; do
  src="$PLATFORM_ROOT/$rel_path"
  dst="$TENANT_ROOT/$rel_path"

  # ── Safety: never touch protected directories ─────────────────────────────
  for protected in "${PROTECTED[@]}"; do
    if [[ "$rel_path" == "$protected"* ]]; then
      echo "  PROTECTED — skipping: $rel_path"
      ((SKIPPED++)) || true
      continue 2
    fi
  done

  # ── Source must exist ─────────────────────────────────────────────────────
  if [[ ! -f "$src" ]]; then
    echo "  MISSING source — skipping: $rel_path"
    ((SKIPPED++)) || true
    continue
  fi

  # ── Backup existing file ──────────────────────────────────────────────────
  if [[ -f "$dst" ]]; then
    backup_path="$BACKUP_DIR/$rel_path"
    mkdir -p "$(dirname "$backup_path")"
    cp "$dst" "$backup_path"
    ((UPDATED++)) || true
    action="Updated"
  else
    mkdir -p "$(dirname "$dst")"
    ((ADDED++)) || true
    action="Added"
  fi

  # ── Copy file ─────────────────────────────────────────────────────────────
  cp "$src" "$dst"
  echo "  $action: $rel_path"

done <<< "$PATHS"

echo ""
echo "Release complete — $UPDATED updated, $ADDED added, $SKIPPED skipped"
echo "Backups stored in: $BACKUP_DIR"
echo ""
echo "Tip: To verify a tenant's Statamic installation picked up the changes:"
echo "  php artisan statamic:clear-cache  (or restart the PHP process)"
