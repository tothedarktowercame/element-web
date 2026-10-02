/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
// @vitest-environment happy-dom

import {
    applyFutonIntentMarks,
    registerFutonIntentMarks,
    resetFutonIntentPollersForTests,
    validatedIntentMarks,
} from "./FutonIntentMarks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

const client = { getAccessToken: () => "token" } as MatrixClient;

async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

function requestUrl(value: string | URL | Request): string {
    if (typeof value === "string") return value;
    return value instanceof URL ? value.href : value.url;
}

describe("FUTON intent marks", () => {
    afterEach(() => {
        resetFutonIntentPollersForTests();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

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

    it("uses Xiaoxiang draft fragments when analysis has not arrived", () => {
        const detail = {
            record: { source_text: "Please make this work today", sentences: [] },
            analysis: null,
            draft: {
                status: "drafted",
                labeller: "小象",
                source_text: "Please make this work today",
                fragments: [
                    {
                        start: 0,
                        end: 27,
                        text: "Please make this work today",
                        intent: "ask-action",
                        guesses: ["ask-action", "propose"],
                    },
                ],
            },
        };
        expect(validatedIntentMarks(detail)?.marks).toEqual([
            expect.objectContaining({ text: "Please make this", intent: "ask-action", basis: "draft" }),
        ]);
    });

    it("prefers Xiang analysis over a Xiaoxiang draft", () => {
        const source = "Please approve this";
        const detail = {
            record: { source_text: source, sentences: [] },
            draft: {
                status: "drafted",
                source_text: source,
                fragments: [
                    { start: 0, end: 19, text: source, intent: "ask-action", guesses: ["ask-action", "approve"] },
                ],
            },
            analysis: {
                status: "analyzed",
                source_text: source,
                labeller: "象",
                sentences: [
                    {
                        fragments: [
                            {
                                intent: "approve",
                                display_cues: [{ start: 7, end: 14, text: "approve" }],
                            },
                        ],
                    },
                ],
            },
        };
        expect(validatedIntentMarks(detail)?.marks).toEqual([
            expect.objectContaining({ text: "approve", intent: "approve" }),
        ]);
    });

    it("shows both guesses for an unsure draft fragment", () => {
        const source = "Maybe continue later";
        const detail = {
            record: { source_text: source, sentences: [] },
            draft: {
                status: "drafted",
                labeller: "小象",
                source_text: source,
                fragments: [{ start: 0, end: 20, text: source, intent: null, guesses: ["continue", "defer"] }],
            },
        };
        expect(validatedIntentMarks(detail)?.marks[0]).toEqual(
            expect.objectContaining({ intent: "unresolved", help: "? · guesses: continue, defer · (小象)" }),
        );
    });

    it("underlines only an author's declared proforma mark with solid styling", () => {
        const source = "🈸 Please continue";
        const detail = {
            record: { source_text: source, sentences: [] },
            draft: {
                status: "drafted",
                source_text: source,
                fragments: [
                    {
                        start: 0,
                        end: 17,
                        text: source,
                        intent: "ask-action",
                        guesses: ["ask-action", "approve"],
                        basis: "declared" as const,
                        mark: "🈸",
                    },
                ],
            },
        };
        const validated = validatedIntentMarks(detail)!;
        const root = document.createElement("div");
        root.textContent = source;
        expect(applyFutonIntentMarks(root, validated.source, validated.marks)).toBe(1);
        const mark = root.querySelector<HTMLElement>("[data-futon-intent-mark]");
        expect(mark?.textContent).toBe("🈸");
        expect(mark?.dataset.futonIntentBasis).toBe("declared");
    });

    it("rejects a draft fragment whose declared text does not match the source", () => {
        const source = "Please approve this";
        const detail = {
            record: { source_text: source, sentences: [] },
            draft: {
                status: "drafted",
                source_text: source,
                fragments: [{ start: 0, end: 19, text: "Please dispute this", intent: "approve", guesses: [] }],
            },
        };
        expect(validatedIntentMarks(detail)?.marks).toEqual([]);
    });

    it("polls the turn list once per room rather than once per body", async () => {
        vi.useFakeTimers();
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(JSON.stringify({ turns: [] }), { status: 200 }));
        const dispose = Array.from({ length: 10 }, (_, index) =>
            registerFutonIntentMarks(document.createElement("div"), client, "!room:test", `$event-${index}`),
        );
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(10_000);
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        dispose.forEach((fn) => fn());
    });

    it("does not refetch detail after a turn is already analyzed", async () => {
        vi.useFakeTimers();
        const list = { turns: [{ "id": "turn-1", "evidence-id": "$event", "analysis-status": "analyzed" }] };
        const detail = { record: { source_text: "approve this", sentences: [] }, analysis: null };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(
                async (url) =>
                    new Response(JSON.stringify(requestUrl(url).includes("turn-1") ? detail : list), { status: 200 }),
            );
        const dispose = registerFutonIntentMarks(document.createElement("div"), client, "!room:test", "$event");
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(20_000);
        await settle();
        expect(fetchMock.mock.calls.filter(([url]) => requestUrl(url).includes("turn-1"))).toHaveLength(1);
        dispose();
    });

    it("refetches and redecorates exactly once when analysis status changes", async () => {
        vi.useFakeTimers();
        let analyzed = false;
        const detailRequests: string[] = [];
        vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
            const path = requestUrl(url);
            if (!path.includes("turn-1")) {
                return new Response(
                    JSON.stringify({
                        turns: [
                            {
                                "id": "turn-1",
                                "evidence-id": "$event",
                                "analysis-status": analyzed ? "analyzed" : "requested",
                            },
                        ],
                    }),
                    { status: 200 },
                );
            }
            detailRequests.push(path);
            const detail = analyzed
                ? {
                      record: { source_text: "approve this", sentences: [] },
                      analysis: {
                          status: "analyzed",
                          source_text: "approve this",
                          sentences: [
                              {
                                  fragments: [
                                      {
                                          intent: "approve",
                                          display_cues: [{ start: 0, end: 7, text: "approve" }],
                                      },
                                  ],
                              },
                          ],
                      },
                  }
                : { record: { source_text: "approve this", sentences: [] }, analysis: null };
            return new Response(JSON.stringify(detail), { status: 200 });
        });
        const root = document.createElement("div");
        root.textContent = "approve this";
        const dispose = registerFutonIntentMarks(root, client, "!room:test", "$event");
        await settle();
        analyzed = true;
        await vi.advanceTimersByTimeAsync(10_000);
        await settle();
        expect(detailRequests).toHaveLength(2);
        expect(root.querySelectorAll("[data-futon-intent-mark='approve']")).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(10_000);
        await settle();
        expect(detailRequests).toHaveLength(2);
        dispose();
    });
});
