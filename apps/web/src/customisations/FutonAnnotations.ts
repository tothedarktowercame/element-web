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

/** Focus one intent in the annotation widget while its source cue is hovered. */
export function highlightFutonAnnotationIntent(
    eventId: string,
    intent: string | null,
    root: ParentNode = document,
    targetOrigin: string = window.location.origin,
): void {
    const message = { type: "futon.highlight-intent", eventId, intent };
    root.querySelectorAll<HTMLIFrameElement>('iframe[src*="/xiang-widget/"]').forEach((iframe) => {
        iframe.contentWindow?.postMessage(message, targetOrigin);
    });
}

export interface FutonAnnotationTheme {
    type: "futon.annotation-theme";
    theme: "light" | "dark";
    fontFamily: string;
    foreground: string;
    background: string;
}

const themeFrames = new WeakSet<HTMLIFrameElement>();

/** Send Element's resolved user theme to each isolated annotation iframe. */
export function syncFutonAnnotationTheme(
    root: Document = document,
    targetOrigin: string = window.location.origin,
): FutonAnnotationTheme {
    const bodyStyle = window.getComputedStyle(root.body);
    const surface = root.querySelector<HTMLElement>(".mx_RoomView") ?? root.body;
    const surfaceStyle = window.getComputedStyle(surface);
    const background = bodyStyle.getPropertyValue("--cpd-color-bg-canvas-default").trim();
    const foreground = bodyStyle.getPropertyValue("--cpd-color-text-primary").trim();
    const message: FutonAnnotationTheme = {
        type: "futon.annotation-theme",
        theme:
            root.body.classList.contains("cpd-theme-dark") || root.body.classList.contains("cpd-theme-dark-hc")
                ? "dark"
                : "light",
        fontFamily: bodyStyle.fontFamily,
        foreground: foreground || surfaceStyle.color,
        background: background || surfaceStyle.backgroundColor,
    };
    root.querySelectorAll<HTMLIFrameElement>('iframe[src*="/xiang-widget/"]').forEach((iframe) => {
        if (!themeFrames.has(iframe)) {
            themeFrames.add(iframe);
            iframe.addEventListener("load", () => syncFutonAnnotationTheme(root, targetOrigin), { once: true });
        }
        iframe.contentWindow?.postMessage(message, targetOrigin);
    });
    return message;
}

let themeObserver: MutationObserver | undefined;

/** Keep the widget aligned when Element's appearance setting changes. */
export function observeFutonAnnotationTheme(root: Document = document): void {
    syncFutonAnnotationTheme(root);
    if (themeObserver) return;
    themeObserver = new MutationObserver(() => syncFutonAnnotationTheme(root));
    themeObserver.observe(root.body, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
}
