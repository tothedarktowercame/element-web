/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// @vitest-environment happy-dom

import { applyFutonIntentMarks, validatedIntentMarks } from "./FutonIntentMarks";
import { describe, expect, it } from "vitest";

describe("FUTON intent marks", () => {
    it("underlines exact Unicode-codepoint spans without removing existing formatting", () => {
        const root = document.createElement("div");
        root.innerHTML = "A <strong>great 🌱 idea</strong> today";
        const source = root.textContent!;
        const start = Array.from(source).indexOf("g");
        const text = "great 🌱 idea";
        const detail = {
            record: { source_text: source, sentences: [] },
            analysis: {
                status: "analyzed",
                source_text: source,
                labeller: "象",
                sentences: [
                    {
                        fragments: [
                            {
                                intent: "approve",
                                rationale: "positive assessment",
                                display_cues: [{ start, end: start + Array.from(text).length, text }],
                            },
                        ],
                    },
                ],
            },
        };

        const validated = validatedIntentMarks(detail)!;
        expect(applyFutonIntentMarks(root, validated.source, validated.marks)).toBe(1);
        expect(root.querySelector("strong")?.textContent).toBe(text);
        expect(root.querySelector("[data-futon-intent-mark='approve']")?.textContent).toBe(text);
    });

    it("rejects a stale cue whose text does not match its declared offsets", () => {
        const detail = {
            record: { source_text: "approve this", sentences: [] },
            analysis: {
                status: "analyzed",
                source_text: "approve this",
                sentences: [
                    { fragments: [{ intent: "approve", display_cues: [{ start: 0, end: 7, text: "dispute" }] }] },
                ],
            },
        };
        expect(validatedIntentMarks(detail)?.marks).toEqual([]);
    });
});
