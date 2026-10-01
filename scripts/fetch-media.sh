#!/usr/bin/env bash
# Manually download the exercise images (JPG) and animations (GIF) into ./media.
# You normally DON'T need this — `docker compose up` fetches them automatically.
# The dataset's exercise data, code and instructions are MIT-licensed; its images and
# animations are © Gym visual and require their own license for redistribution.
# `media/` is gitignored and kept for local development only (see NOTICE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset "$tmp"
mkdir -p media/img media/gif
cp "$tmp"/images/*.jpg media/img/
cp "$tmp"/videos/*.gif media/gif/
echo "✓ $(ls media/img | wc -l) images, $(ls media/gif | wc -l) GIFs"
