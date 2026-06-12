#!/usr/bin/env bash
set -euo pipefail

run_command() {
  case "$1" in
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
    help)
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
    *)
      echo "Unknown command: $1"
      echo ""
      run_command help
      return 1
      ;;
  esac
}

if [[ $# -eq 0 ]]; then
  echo "Select an option:"
  select choice in install dev build start dmg prod "q to quit"; do
    if [[ -n "${choice:-}" ]]; then
      if [[ "$choice" == "q" ]]; then
        echo "Bye."
        break
      fi

      run_command "$choice"
      break
    fi

    echo "Please enter a number from the list."
  done
else
  run_command "$1"
fi
