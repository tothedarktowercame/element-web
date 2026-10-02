<!--
Copyright 2026 Joseph Corneli

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
-->

# FUTON Element Web

This directory contains deployment configuration for the Element Web fork served at
`https://zone.hyperreal.enterprises/chat/`. The default homeserver is
`matrix.paragogy.net`; users may still choose another homeserver for federated accounts.

Build from the repository root:

```sh
NX_DAEMON=false NX_PARALLEL=1 apps/web/scripts/build-futon.sh
```

The script copies this tracked configuration to Element's ignored development
`apps/web/config.json`, then builds `apps/web/webapp`. Production installs use an
immutable directory under `/srv` and switch `/srv/futon-element-current` to that
directory only after the build and Caddy configuration have been validated.

Keep FUTON-specific integration behind Element's documented customization points.
Changes that are useful without FUTON should be developed on separate branches from
`upstream/develop` so they can be submitted through Element's normal pull-request process.
