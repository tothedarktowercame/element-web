/*
Copyright 2026 Joseph Corneli

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/** Tell each mounted FUTON annotation widget which timeline event was selected. */
export function selectFutonAnnotationEvent(
    eventId: string,
    root: ParentNode = document,
    targetOrigin: string = window.location.origin,
): void {
    const message = { type: "futon.select-event", eventId };
    root.querySelectorAll<HTMLIFrameElement>('iframe[src*="/xiang-widget/"]').forEach((iframe) => {
        iframe.contentWindow?.postMessage(message, targetOrigin);
    });
}
