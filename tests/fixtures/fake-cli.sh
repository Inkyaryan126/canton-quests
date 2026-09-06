#!/bin/sh
# Canton Quests Boardroom V2 — fake CLI fixture for tests.
#
# Stands in for codex/claude/agy so the test suite never spends real
# Astra/Claude/Agy usage. Controlled entirely via environment variables:
#   FAKE_CLI_EXIT_CODE   — exit code to return (default 0)
#   FAKE_CLI_STDOUT      — text to print to stdout
#   FAKE_CLI_STDERR      — text to print to stderr
#   FAKE_CLI_SLEEP_MS    — milliseconds to sleep before exiting (simulate a hang)
#   FAKE_CLI_OUTPUT_FILE_CONTENT — if set, written to any `-o <file>` argument found
#   FAKE_CLI_TOUCH_FILE  — if set, a path (relative to cwd) to write, simulating
#                          an agent actually editing a file in the repo
#   FAKE_CLI_TOUCH_CONTENT — content for FAKE_CLI_TOUCH_FILE (default: a marker line)

sleep_ms="${FAKE_CLI_SLEEP_MS:-0}"
if [ "$sleep_ms" -gt 0 ] 2>/dev/null; then
  sleep_seconds=$(awk "BEGIN { print $sleep_ms / 1000 }")
  sleep "$sleep_seconds"
fi

if [ -n "$FAKE_CLI_STDOUT" ]; then
  printf '%s\n' "$FAKE_CLI_STDOUT"
fi
if [ -n "$FAKE_CLI_STDERR" ]; then
  printf '%s\n' "$FAKE_CLI_STDERR" >&2
fi

if [ -n "$FAKE_CLI_OUTPUT_FILE_CONTENT" ]; then
  prev=""
  for arg in "$@"; do
    if [ "$prev" = "-o" ]; then
      printf '%s\n' "$FAKE_CLI_OUTPUT_FILE_CONTENT" > "$arg"
    fi
    prev="$arg"
  done
fi

if [ -n "$FAKE_CLI_TOUCH_FILE" ]; then
  mkdir -p "$(dirname "$FAKE_CLI_TOUCH_FILE")"
  printf '%s\n' "${FAKE_CLI_TOUCH_CONTENT:-boardroom fake-cli test change}" > "$FAKE_CLI_TOUCH_FILE"
fi

exit "${FAKE_CLI_EXIT_CODE:-0}"
