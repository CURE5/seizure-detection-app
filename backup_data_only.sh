#!/bin/bash
# Quick data-only backup script for daily automated backups
# Backs up seizure logs, medication logs, and videos

PI_HOST="${1:-${PI_HOST:-pi@raspberrypi.local}}"
BACKUP_BASE_DIR="./daily_backups"
DATE=$(date +%Y%m%d)

echo "Starting daily data backup for $DATE..."

# Create backup directory
mkdir -p "$BACKUP_BASE_DIR"

# Backup seizure logs
echo "Backing up seizure logs..."
rsync -av --ignore-existing "$PI_HOST:~/seizure-detection-server/seizure_logs/" \
  "$BACKUP_BASE_DIR/seizure_logs/" 2>&1 | tail -5

# Backup medication logs
echo "Backing up medication logs..."
rsync -av --ignore-existing "$PI_HOST:~/seizure-detection-server/medication_logs/" \
  "$BACKUP_BASE_DIR/medication_logs/" 2>&1 | tail -5

# Backup HR logs
echo "Backing up HR logs..."
rsync -av --ignore-existing "$PI_HOST:~/seizure-detection-server/hr_logs/" \
  "$BACKUP_BASE_DIR/hr_logs/" 2>&1 | tail -5

# Backup Garmin backfill logs
echo "Backing up Garmin data..."
rsync -av --ignore-existing "$PI_HOST:~/seizure-detection-server/garmin_backfill/" \
  "$BACKUP_BASE_DIR/garmin_backfill/" 2>&1 | tail -5

# Backup videos (only last 7 days to save space)
echo "Backing up recent videos..."
ssh "$PI_HOST" "find ~/seizure-detection-app/public/recorded_video/ -type f -mtime -7" | \
  rsync -av --files-from=- "$PI_HOST:/" "$BACKUP_BASE_DIR/recorded_video/" 2>&1 | tail -5

# Show disk usage
echo ""
echo "Backup disk usage:"
du -sh "$BACKUP_BASE_DIR"/*

echo ""
echo "Data backup completed for $DATE"
