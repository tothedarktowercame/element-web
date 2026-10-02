/*
Copyright 2026 Joseph Corneli

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";

import { selectFutonAnnotationEvent } from "./FutonAnnotations";

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
