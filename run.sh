#!/usr/bin/env bash
set -euo pipefail

CMD="${1:-help}"

case "$CMD" in
  install)
    echo "==> Installing dependencies..."
    bun install
    ;;
  dev)
    echo "==> Running dev..."
    bun run dev
    ;;
  build)
    echo "==> Building for production..."
    bun run build
    ;;
  start)
    echo "==> Starting production server..."
    bun run start
    ;;
  prod)
    echo "==> Building & starting production..."
    bun run build
    echo ""
    bun run start
    ;;
  dmg)
    echo "==> Building desktop app DMG (macOS arm64)..."
    bun run dist:desktop:dmg:arm64
    ;;
  *)
    echo "Usage: ./run.sh <command>"
    echo ""
    echo "Commands:"
    echo "  install   Install all dependencies (bun install)"
    echo "  dev       Start development server"
    echo "  build     Build all packages for production"
    echo "  start     Start production server (build first)"
    echo "  dmg       Build macOS desktop DMG (arm64)"
    echo "  prod      Build + Start (one shot)"
    ;;
esac
