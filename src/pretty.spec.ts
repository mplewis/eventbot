import { describe, it, expect } from "vitest";
import { EventData } from "./template";
import { parsePPEvent, ppEvent } from "./pretty";

describe("pretty", () => {
	describe("ppEvent", () => {
		const data: EventData = {
			name: "Central Park Meetup",
			date: "2021-08-01T19:00:00-04:00",
			location: "Central Park",
			url: null,
		};
		const desc = "Come to Central Park and hang out with us! Bring your own brats.";

		it("pretty prints an event", () => {
			const pp = ppEvent(data, desc);
			expect(pp).toMatchInlineSnapshot(`
				"**Name:** Central Park Meetup
				**Date:** Sunday, August 1, 2021 at 5:00 PM MDT (2021-08-01T19:00:00-04:00)
				**Location:** Central Park
				**URL:** *not provided*

				Come to Central Park and hang out with us! Bring your own brats."
			`);
		});

		it("is reversible", () => {
			const pretty = ppEvent(data, desc);
			const parsed = parsePPEvent(pretty);
			expect(parsed).toEqual({ data, desc });
		});
	});
});
