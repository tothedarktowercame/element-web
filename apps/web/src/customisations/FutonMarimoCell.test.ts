/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { marimoPostsUrl, requestsPostsPerAuthorCell } from "./FutonMarimoCell";

describe("inline Marimo cell", () => {
    it("recognises the requested chart and inline Marimo handoff", () => {
        expect(requestsPostsPerAuthorCell("Show me the number of posts per author in this room")).toBe(true);
        expect(requestsPostsPerAuthorCell("Do Marimo inputs and outputs inline with the main chat")).toBe(true);
        expect(requestsPostsPerAuthorCell("ordinary chat message")).toBe(false);
    });

    it("carries exact room, event and author provenance into the notebook", () => {
        const url = new URL(marimoPostsUrl("!room:test", "$event", ["@joe:test", "@bot:test"]), "https://zone.test");
        expect(url.pathname).toBe("/marimo/");
        expect(url.searchParams.get("file")).toBe("matrix-room-posts.py");
        expect(url.searchParams.get("room")).toBe("!room:test");
        expect(url.searchParams.get("event")).toBe("$event");
        expect(JSON.parse(url.searchParams.get("authors")!)).toEqual(["@joe:test", "@bot:test"]);
    });
});
