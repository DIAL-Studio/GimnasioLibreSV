#!/usr/bin/env bash
# health.sh — GimnasioLibreSV project health check
command -v node >/dev/null 2>&1 || { echo "FAIL: node not found"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "FAIL: docker not found"; exit 1; }
[ -f docker-compose.yml ] || { echo "FAIL: docker-compose.yml not found"; exit 1; }
[ -d frontend ] || { echo "FAIL: frontend/ not found"; exit 1; }
[ -d api ] || { echo "FAIL: api/ not found"; exit 1; }
echo "Health check passed."
exit 0
