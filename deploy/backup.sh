#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# GimnasioLibreSV — data backup.
#
# Archives ./data (profiles, passkeys, per-user state, session secret, VAPID
# keys) into ./backups/data-YYYY-MM-DD-HHMM.tar.gz, prunes old local archives
# and optionally copies the new archive offsite with rclone.
#
# Usage:
#   deploy/backup.sh                          # local backup, keep the last 7
#   deploy/backup.sh --keep 14                # keep the last 14
#   RCLONE_REMOTE=gdrive:gym1 deploy/backup.sh
#
# Restore:
#   tar -xzf backups/data-YYYY-MM-DD-HHMM.tar.gz -C /path/to/stack
#
# Cron (daily at 03:30) — see docs/DEPLOY_VPS.md:
#   30 3 * * * cd /srv/gimnasios/gym1 && ./deploy/backup.sh >> backups/backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${KEEP:-7}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

usage() {
  cat <<'EOF'
Usage: deploy/backup.sh [options]

Backs up the GimnasioLibreSV data directory (./data) into ./backups.

Options:
  -k, --keep N      How many local archives to keep (default: 7, or $KEEP)
  -o, --out DIR     Destination directory (default: ./backups, or $BACKUP_DIR)
  -r, --remote R    rclone destination, e.g. gdrive:gym-backups (or $RCLONE_REMOTE).
                    When unset, no offsite copy is made.
  -h, --help        Show this help

Environment:
  DATA_DIR          Data directory to archive (default: <repo>/data)
  BACKUP_DIR        Same as --out
  KEEP              Same as --keep
  RCLONE_REMOTE     Same as --remote
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -k|--keep)   KEEP="${2:?--keep needs a number}"; shift 2 ;;
    -o|--out)    BACKUP_DIR="${2:?--out needs a directory}"; shift 2 ;;
    -r|--remote) RCLONE_REMOTE="${2:?--remote needs an rclone destination}"; shift 2 ;;
    -h|--help)   usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$KEEP" in
  ''|*[!0-9]*) echo "ERROR: --keep must be a positive integer (got: $KEEP)" >&2; exit 2 ;;
esac
if [ "$KEEP" -lt 1 ]; then
  echo "ERROR: --keep must be at least 1 (got: $KEEP)" >&2
  exit 2
fi

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

[ -d "$DATA_DIR" ] || { log "ERROR: data directory not found: $DATA_DIR"; exit 1; }
if [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  log "WARNING: $DATA_DIR is empty — nothing to back up (start the stack first?)."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date '+%Y-%m-%d-%H%M')"
ARCHIVE="$BACKUP_DIR/data-$STAMP.tar.gz"

log "→ Archiving $DATA_DIR ..."
tar -czf "$ARCHIVE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
log "✓ Backup written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Prune old local archives, keeping the newest $KEEP.
ls -1t "$BACKUP_DIR"/data-*.tar.gz | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
  rm -f -- "$old"
  log "· pruned old backup: $old"
done

# Offsite copy (optional).
if [ -n "$RCLONE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    log "ERROR: RCLONE_REMOTE is set but rclone is not installed."
    exit 1
  fi
  log "→ Copying to $RCLONE_REMOTE ..."
  rclone copy "$ARCHIVE" "$RCLONE_REMOTE"
  log "✓ Offsite copy done."
else
  log "· RCLONE_REMOTE not set — skipping offsite copy."
fi

log "Done."
