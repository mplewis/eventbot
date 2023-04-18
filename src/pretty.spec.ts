import { describe, it, expect } from "vitest";
import { EventData } from "./template";
import { auditMessage, parseAuditMessage, parsePPEvent, ppEvent } from "./pretty";

describe("pretty", () => {
	describe("ppEvent", () => {
		const data: EventData = {
			name: "Central Park Meetup",
			start: "2023-04-17T18:00:00.000Z",
			end: null,
			location: "Central Park",
			desc: "Come to Central Park and hang out with us! Bring your own brats.",
		};

		it("pretty prints an event", () => {
			const pp = ppEvent(data);
			expect(pp).toMatchInlineSnapshot(`
				"**Name:** Central Park Meetup
				**Start:** Monday, April 17, 2023 at 12:00 PM MDT (2023-04-17T18:00:00.000Z)
				**End:** *not provided*
				**Location:** Central Park

				Come to Central Park and hang out with us! Bring your own brats."
			`);
		});

		it("is reversible", () => {
			const pretty = ppEvent(data);
			const parsed = parsePPEvent(pretty);
			expect(parsed).toEqual(data);
		});
	});

	describe("parsePPEvent", () => {
		it("parses a pretty-printed event", () => {
			const pretty = `
*Here's your event preview. If everything looks good, hit **Create Event** to add it to the server. Otherwise, you can correct the details or delete this draft.*
*I understand natural language – you can tell me to \\"change the date to 7:30 PM on Jan 11\\" or \\"change the location to Cheesman Park.\\"*
────────────────────────────────────────
**Name:** Central Park Meetup
**Start:** Sunday, August 1, 2021 at 5:00 PM MDT (2023-04-17T12:00:00.000-06:00)
**End:** *not provided*
**Location:** Central Park

Come to Central Park and hang out with us! Bring your own brats.
			`.trim();
			const parsed = parsePPEvent(pretty);
			expect(parsed).toEqual({
				name: "Central Park Meetup",
				start: "2023-04-17T18:00:00.000Z",
				end: null,
				location: "Central Park",
				desc: "Come to Central Park and hang out with us! Bring your own brats.",
			});
		});
	});

	describe("parseAuditMessage", () => {
		it("parses the generated audit message", () => {
			expect(parseAuditMessage(auditMessage("fs0ciety#1337"))).toEqual("fs0ciety#1337");
		});
	});
});
