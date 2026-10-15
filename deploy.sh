#!/bin/bash
# Runs ON the Raspberry Pi: pull, build and reload the dashboard under PM2.
set -e
APP_DIR="${APP_DIR:-$HOME/seizure-detection-app}"
cd "$APP_DIR"
git pull
yarn install --frozen-lockfile
yarn build

pm2 stop app || true
sleep 2
pm2 reload app || pm2 start ecosystem.config.js --only app
