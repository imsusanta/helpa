#!/usr/bin/env bash
set -o pipefail

log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT

if npm ci 2>&1 | tee "$log_file"; then
  exit 0
fi

status=${PIPESTATUS[0]}
message="$(tail -n 40 "$log_file")"
message="${message//'%'/'%25'}"
message="${message//$'\r'/'%0D'}"
message="${message//$'\n'/'%0A'}"
printf '::error file=package.json,title=npm ci failed::%s\n' "$message"
exit "$status"
