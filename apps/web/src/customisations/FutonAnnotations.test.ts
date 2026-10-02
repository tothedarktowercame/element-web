/*
Copyright 2026 Joseph Corneli

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/
// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";

import { highlightFutonAnnotationIntent, selectFutonAnnotationEvent } from "./FutonAnnotations";

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
