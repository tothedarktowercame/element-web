/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { stubClient } from "test-utils";

import { mediaFromMxc } from "./Media";

describe("Media", () => {
    it("should not download error if server returns one", async () => {
        const cli = stubClient();
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/r0/download/${mxc.slice(6)}`,
        );

        fetchMock.get("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", {
            status: 404,
            body: { errcode: "M_NOT_FOUND", error: "Not found" },
        });

        const media = mediaFromMxc("mxc://matrix.org/1234");
        await expect(media.downloadSource()).rejects.toThrow("Not found");
    });

    it("downloads authenticated media with the Matrix access token", async () => {
        const cli = stubClient();
        vi.mocked(cli.getAccessToken).mockReturnValue("matrix-token");
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(cli.mxcUrlToHttp).mockReturnValue(
            "https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234",
        );
        fetchMock.get("https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234", {
            status: 200,
            body: "image bytes",
        });

        const media = mediaFromMxc("mxc://matrix.org/1234", cli);
        await expect(media.downloadSourceAuthenticated()).resolves.toBeInstanceOf(Response);

        // eslint-disable-next-line no-restricted-properties
        expect(cli.mxcUrlToHttp).toHaveBeenCalledWith(
            "mxc://matrix.org/1234",
            undefined,
            undefined,
            undefined,
            false,
            true,
            true,
        );
        expect(fetchMock.callHistory.lastCall()?.options.headers).toEqual({ authorization: "Bearer matrix-token" });
    });
});
