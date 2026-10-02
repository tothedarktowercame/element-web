/*
Copyright 2026 Joseph Corneli

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/
// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

import {
    highlightFutonAnnotationIntent,
    selectFutonAnnotationEvent,
    syncFutonAnnotationTheme,
} from "./FutonAnnotations";

describe("selectFutonAnnotationEvent", () => {
    it("sends the selected Matrix event only to a mounted FUTON widget", () => {
        const futonPost = vi.fn();
        const root = {
            querySelectorAll: vi.fn().mockReturnValue([{ contentWindow: { postMessage: futonPost } }]),
        } as unknown as ParentNode;

        selectFutonAnnotationEvent("$old-turn", root, "https://zone.example");

        expect(futonPost).toHaveBeenCalledWith(
            { type: "futon.select-event", eventId: "$old-turn" },
            "https://zone.example",
        );
        expect(root.querySelectorAll).toHaveBeenCalledWith('iframe[src*="/xiang-widget/"]');
    });
});

it("sends hover intent and its event to the annotation widget", () => {
    const postMessage = vi.fn();
    const root = document.createElement("div");
    const frame = document.createElement("iframe");
    frame.src = "https://zone.test/xiang-widget/?annotations=1";
    Object.defineProperty(frame, "contentWindow", { value: { postMessage } });
    root.append(frame);

    highlightFutonAnnotationIntent("$event", "report-problem", root, "https://zone.test");
    expect(postMessage).toHaveBeenCalledWith(
        { type: "futon.highlight-intent", eventId: "$event", intent: "report-problem" },
        "https://zone.test",
    );
});

it("sends Element's resolved dark theme and font to the annotation widget", () => {
    document.body.className = "cpd-theme-dark";
    document.body.style.fontFamily = "Inter, sans-serif";
    document.body.style.color = "rgb(230, 230, 230)";
    document.body.style.backgroundColor = "rgb(20, 20, 20)";
    const postMessage = vi.fn();
    const query = vi
        .spyOn(document, "querySelectorAll")
        .mockReturnValue([
            { contentWindow: { postMessage }, addEventListener: vi.fn() },
        ] as unknown as NodeListOf<HTMLIFrameElement>);

    const message = syncFutonAnnotationTheme(document, "https://zone.test");
    expect(message.theme).toBe("dark");
    expect(message.fontFamily).toContain("Inter");
    expect(postMessage).toHaveBeenCalledWith(message, "https://zone.test");
    query.mockRestore();
});

it("resends the current theme when the widget finishes loading", () => {
    document.body.className = "cpd-theme-dark";
    const postMessage = vi.fn();
    const frame = document.createElement("iframe");
    frame.src = "https://zone.test/xiang-widget/?annotations=1";
    Object.defineProperty(frame, "contentWindow", { value: { postMessage } });
    const query = vi
        .spyOn(document, "querySelectorAll")
        .mockReturnValue([frame] as unknown as NodeListOf<HTMLIFrameElement>);

    syncFutonAnnotationTheme(document, "https://zone.test");
    postMessage.mockClear();
    frame.dispatchEvent(new Event("load"));

    expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "futon.annotation-theme", theme: "dark" }),
        "https://zone.test",
    );
    query.mockRestore();
});
