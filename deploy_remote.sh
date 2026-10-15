#!/bin/bash
# Runs on your workstation: SSH to the Pi and execute deploy.sh there.
#   PI_HOST=pi@my-pi.local ./deploy_remote.sh
set -e
PI_HOST="${PI_HOST:-pi@raspberrypi.local}"
APP_DIR="${APP_DIR:-seizure-detection-app}"   # relative to the Pi user's home

ssh -t -o ConnectTimeout=10 "$PI_HOST" "APP_DIR=\$HOME/$APP_DIR bash \$HOME/$APP_DIR/deploy.sh"
