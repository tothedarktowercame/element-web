/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

/* oxlint-disable react/iframe-missing-sandbox -- fixed same-origin Marimo runtime needs scripts plus its same-origin WebSocket */

export function requestsPostsPerAuthorCell(body: unknown): boolean {
    if (typeof body !== "string") return false;
    const text = body.toLowerCase();
    return (
        text.includes("posts per author") ||
        text.includes("number of posts per author") ||
        (text.includes("marimo inputs and outputs") && text.includes("inline"))
    );
}

export function marimoPostsUrl(roomId: string, eventId: string, authors: string[]): string {
    const query = new URLSearchParams({
        room: roomId,
        event: eventId,
        authors: JSON.stringify(authors),
    });
    return `/marimo-room/?${query.toString()}`;
}

interface Props {
    roomId: string;
    eventId: string;
    authors: string[];
}

export function FutonMarimoCell({ roomId, eventId, authors }: Readonly<Props>): JSX.Element {
    return (
        <section className="mx_FutonMarimoCell" data-futon-marimo-event={eventId}>
            <header>
                <strong>Python cell · Marimo</strong>
                <a href={marimoPostsUrl(roomId, eventId, authors)} target="_blank" rel="noreferrer">
                    Open notebook
                </a>
            </header>
            <iframe
                src={marimoPostsUrl(roomId, eventId, authors)}
                title="Marimo posts-per-author cell"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
            />
        </section>
    );
}
