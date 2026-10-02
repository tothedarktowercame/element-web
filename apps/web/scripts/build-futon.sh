#!/usr/bin/env bash

# Copyright 2026 Joseph Corneli
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE in the repository root for full details.

set -euo pipefail

web_dir=$(cd "$(dirname "$0")/.." && pwd)
cp "$web_dir/futon/config.json" "$web_dir/config.json"
cd "$web_dir"
pnpm build
