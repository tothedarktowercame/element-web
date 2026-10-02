/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

interface Cue {
    start: number;
    end: number;
    text: string;
    label?: string;
    method?: string;
}

interface Fragment {
    intent: string;
    target?: string | null;
    rationale?: string;
    display_cues?: Cue[];
}

interface TurnDetail {
    record?: {
        source_text?: string;
        sentences?: Array<{ id?: string; cues?: Cue[] }>;
    };
    analysis?: {
        status?: string;
        source_text?: string;
        labeller?: string;
        sentences?: Array<{ fragments?: Fragment[] }>;
    } | null;
}

export interface FutonIntentMark {
    start: number;
    end: number;
    text: string;
    intent: string;
    help: string;
}

interface TurnSummary {
    "id": string;
    "evidence-id"?: string;
}

const MAX_CUE_CODEPOINTS = 80;
const MAX_CUE_WORDS = 8;
const summaryPromises = new Map<string, { expires: number; value: Promise<Map<string, string>> }>();

function codepoints(value: string): string[] {
    return Array.from(value);
}

function exactMark(source: string, cue: Cue, intent: string, help: string): FutonIntentMark | null {
    const sourcePoints = codepoints(source);
    if (!Number.isInteger(cue.start) || !Number.isInteger(cue.end) || cue.start < 0 || cue.end <= cue.start)
        return null;
    if (cue.end > sourcePoints.length || sourcePoints.slice(cue.start, cue.end).join("") !== cue.text) return null;
    if (codepoints(cue.text).length > MAX_CUE_CODEPOINTS || cue.text.trim().split(/\s+/u).length > MAX_CUE_WORDS)
        return null;
    if (cue.text.includes("\n")) return null;

    return {
        start: sourcePoints.slice(0, cue.start).join("").length,
        end: sourcePoints.slice(0, cue.end).join("").length,
        text: cue.text,
        intent,
        help,
    };
}

export function validatedIntentMarks(detail: TurnDetail): { source: string; marks: FutonIntentMark[] } | null {
    const source = detail.record?.source_text;
    if (typeof source !== "string") return null;

    const analysis = detail.analysis;
    if (analysis?.status === "analyzed" && analysis.source_text === source) {
        const marks = (analysis.sentences ?? []).flatMap((sentence) =>
            (sentence.fragments ?? []).flatMap((fragment) => {
                const help = [
                    fragment.intent,
                    fragment.target ? `→ ${fragment.target}` : "",
                    fragment.rationale ?? "",
                    analysis.labeller ? `(${analysis.labeller})` : "",
                ]
                    .filter(Boolean)
                    .join(" · ");
                return (fragment.display_cues ?? [])
                    .map((cue) => exactMark(source, cue, fragment.intent, help))
                    .filter((mark): mark is FutonIntentMark => mark !== null);
            }),
        );
        if (marks.length > 0) return { source, marks };
    }

    const marks = (detail.record?.sentences ?? []).flatMap((sentence) =>
        (sentence.cues ?? [])
            .map((cue) =>
                exactMark(source, cue, cue.label ?? "cue", `${cue.label ?? "cue"} (${cue.method ?? "lexical"})`),
            )
            .filter((mark): mark is FutonIntentMark => mark !== null),
    );
    return { source, marks };
}

export function clearFutonIntentMarks(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>("[data-futon-intent-mark]").forEach((element) =>
        element.replaceWith(element.textContent ?? ""),
    );
    root.normalize();
}

export function applyFutonIntentMarks(root: HTMLElement, source: string, marks: FutonIntentMark[]): number {
    clearFutonIntentMarks(root);
    const visible = root.textContent ?? "";
    const sourceOffset = source === visible ? 0 : source.indexOf(visible);
    if (sourceOffset < 0 || source.indexOf(visible, sourceOffset + 1) >= 0) return 0;

    let applied = 0;
    for (const mark of [...marks].sort((a, b) => b.start - a.start || b.end - a.end)) {
        const start = mark.start - sourceOffset;
        const end = mark.end - sourceOffset;
        if (start < 0 || end > visible.length || visible.slice(start, end) !== mark.text) continue;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes: Array<{ node: Text; start: number; end: number }> = [];
        let position = 0;
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            nodes.push({ node, start: position, end: position + node.data.length });
            position += node.data.length;
        }
        for (const entry of nodes.reverse()) {
            const partStart = Math.max(start, entry.start);
            const partEnd = Math.min(end, entry.end);
            if (partStart >= partEnd || entry.node.parentElement?.closest("[data-futon-intent-mark]")) continue;
            const localStart = partStart - entry.start;
            const selected = entry.node.splitText(localStart);
            selected.splitText(partEnd - partStart);
            const underline = document.createElement("span");
            underline.dataset.futonIntentMark = mark.intent;
            underline.title = mark.help;
            selected.replaceWith(underline);
            underline.append(selected);
            applied++;
        }
    }
    return applied;
}

async function turnIds(client: MatrixClient, roomId: string): Promise<Map<string, string>> {
    const cached = summaryPromises.get(roomId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = fetch("/chat-api/api/xiang/turns?limit=300", {
        headers: {
            "Authorization": `Bearer ${client.getAccessToken()}`,
            "Accept": "application/json",
            "X-Matrix-Room": roomId,
        },
    })
        .then(async (response) => {
            if (!response.ok) throw new Error(`FUTON turn list returned ${response.status}`);
            const body = (await response.json()) as { turns?: TurnSummary[] };
            return new Map(
                (body.turns ?? []).flatMap((turn) => (turn["evidence-id"] ? [[turn["evidence-id"], turn.id]] : [])),
            );
        })
        .catch(() => new Map<string, string>());
    summaryPromises.set(roomId, { expires: Date.now() + 10_000, value });
    return value;
}

export async function decorateWithFutonIntentMarks(
    root: HTMLElement,
    client: MatrixClient,
    roomId: string,
    eventId: string,
): Promise<number> {
    const turnId = (await turnIds(client, roomId)).get(eventId);
    if (!turnId) return 0;
    const response = await fetch(`/chat-api/api/xiang/turns/${encodeURIComponent(turnId)}`, {
        headers: {
            "Authorization": `Bearer ${client.getAccessToken()}`,
            "Accept": "application/json",
            "X-Matrix-Room": roomId,
        },
    });
    if (!response.ok) return 0;
    const validated = validatedIntentMarks((await response.json()) as TurnDetail);
    return validated ? applyFutonIntentMarks(root, validated.source, validated.marks) : 0;
}
