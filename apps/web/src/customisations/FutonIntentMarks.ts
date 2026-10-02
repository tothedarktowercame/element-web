/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { highlightFutonAnnotationIntent, observeFutonAnnotationTheme } from "./FutonAnnotations";

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
    "analysis-status"?: string;
}

const MAX_CUE_CODEPOINTS = 80;
const MAX_CUE_WORDS = 8;
const POLL_INTERVAL_MS = 10_000;
const FINAL_STATUSES = new Set(["analyzed", "refused", "failed", "not-requested"]);

interface Registration {
    root: HTMLElement;
    eventId: string;
}

interface KnownTurn {
    turnId: string;
    status: string;
    validated?: { source: string; marks: FutonIntentMark[] } | null;
}

interface RoomPoller {
    client: MatrixClient;
    roomId: string;
    registrations: Set<Registration>;
    turns: Map<string, KnownTurn>;
    interval: number;
    polling?: Promise<void>;
}

const roomPollers = new Map<string, RoomPoller>();

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

function requestHeaders(client: MatrixClient, roomId: string): Record<string, string> {
    return {
        "Authorization": `Bearer ${client.getAccessToken()}`,
        "Accept": "application/json",
        "X-Matrix-Room": roomId,
    };
}

function applyValidated(root: HTMLElement, eventId: string, validated: KnownTurn["validated"]): void {
    if (!validated) return;
    applyFutonIntentMarks(root, validated.source, validated.marks);
    root.querySelectorAll<HTMLElement>("[data-futon-intent-mark]").forEach((mark) => {
        mark.addEventListener("mouseenter", () =>
            highlightFutonAnnotationIntent(eventId, mark.dataset.futonIntentMark!),
        );
        mark.addEventListener("mouseleave", () => highlightFutonAnnotationIntent(eventId, null));
    });
}

async function loadTurn(poller: RoomPoller, eventId: string, turn: KnownTurn): Promise<void> {
    const response = await fetch(`/chat-api/api/xiang/turns/${encodeURIComponent(turn.turnId)}`, {
        headers: requestHeaders(poller.client, poller.roomId),
    });
    if (!response.ok) return;
    turn.validated = validatedIntentMarks((await response.json()) as TurnDetail);
    for (const registration of poller.registrations) {
        if (registration.eventId === eventId) applyValidated(registration.root, eventId, turn.validated);
    }
}

async function pollRoom(poller: RoomPoller): Promise<void> {
    if (poller.polling) return poller.polling;
    poller.polling = (async () => {
        const response = await fetch("/chat-api/api/xiang/turns?limit=300", {
            headers: requestHeaders(poller.client, poller.roomId),
        });
        if (!response.ok) return;
        const body = (await response.json()) as { turns?: TurnSummary[] };
        const registeredIds = new Set([...poller.registrations].map(({ eventId }) => eventId));
        const changed: Array<[string, KnownTurn]> = [];
        for (const summary of body.turns ?? []) {
            const eventId = summary["evidence-id"];
            if (!eventId || !registeredIds.has(eventId)) continue;
            const status = summary["analysis-status"] ?? "requested";
            const previous = poller.turns.get(eventId);
            if (previous?.turnId === summary.id && previous.status === status) continue;
            const turn = { turnId: summary.id, status };
            poller.turns.set(eventId, turn);
            changed.push([eventId, turn]);
        }
        await Promise.all(changed.map(([eventId, turn]) => loadTurn(poller, eventId, turn)));
    })()
        .catch(() => undefined)
        .finally(() => {
            poller.polling = undefined;
        });
    return poller.polling;
}

export function registerFutonIntentMarks(
    root: HTMLElement,
    client: MatrixClient,
    roomId: string,
    eventId: string,
): () => void {
    observeFutonAnnotationTheme();
    let poller = roomPollers.get(roomId);
    if (!poller) {
        poller = {
            client,
            roomId,
            registrations: new Set(),
            turns: new Map(),
            interval: window.setInterval(() => {
                const active = roomPollers.get(roomId);
                if (active) void pollRoom(active);
            }, POLL_INTERVAL_MS),
        };
        roomPollers.set(roomId, poller);
    }
    const registration = { root, eventId };
    poller.registrations.add(registration);
    const known = poller.turns.get(eventId);
    if (known?.validated !== undefined) applyValidated(root, eventId, known.validated);
    else if (!known || !FINAL_STATUSES.has(known.status)) void pollRoom(poller);

    return () => {
        clearFutonIntentMarks(root);
        poller?.registrations.delete(registration);
        if (poller?.registrations.size === 0) {
            window.clearInterval(poller.interval);
            roomPollers.delete(roomId);
        }
    };
}

export function resetFutonIntentPollersForTests(): void {
    for (const poller of roomPollers.values()) window.clearInterval(poller.interval);
    roomPollers.clear();
}

export async function decorateWithFutonIntentMarks(
    root: HTMLElement,
    client: MatrixClient,
    roomId: string,
    eventId: string,
): Promise<number> {
    const response = await fetch("/chat-api/api/xiang/turns?limit=300", {
        headers: {
            "Authorization": `Bearer ${client.getAccessToken()}`,
            "Accept": "application/json",
            "X-Matrix-Room": roomId,
        },
    });
    if (!response.ok) return 0;
    const summary = ((await response.json()) as { turns?: TurnSummary[] }).turns?.find(
        (turn) => turn["evidence-id"] === eventId,
    );
    if (!summary) return 0;
    const detailResponse = await fetch(`/chat-api/api/xiang/turns/${encodeURIComponent(summary.id)}`, {
        headers: requestHeaders(client, roomId),
    });
    if (!detailResponse.ok) return 0;
    const validated = validatedIntentMarks((await detailResponse.json()) as TurnDetail);
    if (!validated) return 0;
    const applied = applyFutonIntentMarks(root, validated.source, validated.marks);
    root.querySelectorAll<HTMLElement>("[data-futon-intent-mark]").forEach((mark) => {
        mark.addEventListener("mouseenter", () =>
            highlightFutonAnnotationIntent(eventId, mark.dataset.futonIntentMark!),
        );
        mark.addEventListener("mouseleave", () => highlightFutonAnnotationIntent(eventId, null));
    });
    return applied;
}
