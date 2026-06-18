#!/bin/bash
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Building and restarting containers..."
docker compose up --build -d

echo "==> Done. Running containers:"
docker compose ps
