/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";

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
        file: "matrix-room-posts.py",
        room: roomId,
        event: eventId,
        authors: JSON.stringify(authors),
    });
    return `/marimo/?${query.toString()}`;
}

export async function authorizeMarimo(roomId: string, accessToken: string | null): Promise<void> {
    if (!accessToken) throw new Error("Matrix login required");
    const response = await fetch("/chat-api/api/marimo/session", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ room_id: roomId }),
    });
    if (!response.ok) throw new Error(`Marimo authorization returned ${response.status}`);
}

interface Props {
    roomId: string;
    eventId: string;
    authors: string[];
}

export function FutonMarimoCell({ roomId, eventId, authors }: Readonly<Props>): JSX.Element {
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState(false);
    const notebookUrl = marimoPostsUrl(roomId, eventId, authors);

    useEffect(() => {
        let active = true;
        setAuthorized(false);
        setError(false);
        void authorizeMarimo(roomId, MatrixClientPeg.safeGet().getAccessToken())
            .then(() => active && setAuthorized(true))
            .catch(() => active && setError(true));
        return () => {
            active = false;
        };
    }, [roomId]);

    return (
        <section className="mx_FutonMarimoCell" data-futon-marimo-event={eventId}>
            <header>
                <strong>Editable Python cell · Marimo</strong>
                {authorized && (
                    <a href={notebookUrl} target="_blank" rel="noreferrer">
                        Open notebook
                    </a>
                )}
            </header>
            {!authorized && !error && <p>Authorizing through Matrix…</p>}
            {error && <p>Join this Matrix room to use its notebook.</p>}
            {authorized && (
                <iframe
                    src={notebookUrl}
                    title="Marimo posts-per-author cell"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
                />
            )}
        </section>
    );
}
