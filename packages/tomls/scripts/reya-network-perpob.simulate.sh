#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export REYA_FORK_ENV=reya_network
export REYA_PERPOB_SIMULATE_ONLY=true
exec "$SCRIPT_DIR/../../tests/scripts/perpob-fork.test.sh" "$@"
