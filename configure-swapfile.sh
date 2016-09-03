#!/usr/bin/env bash
set -o errexit -o xtrace

[ 0 -eq "${EUID}" ] || {
  echo root required >&2
  exit 1
}

swapon --summary | grep ^/swapfile && {
  echo swap configured
  free --mega
  exit 0
}

test -a /swapfile ||
  dd if=/dev/zero of=/swapfile bs=1M count=1K # 1GiB

blkid /swapfile ||
  mkswap /swapfile

swapon /swapfile
