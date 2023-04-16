import dayjs from "dayjs";
import { EventData } from "./template";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(advancedFormat);
dayjs.extend(timezone);

export const prettyDateFormat = "dddd, MMMM D, YYYY [at] h:mm A z";

const MISSING_SENTINEL = "*not provided*";

export function ppEvent(data: EventData): string {
	const d: Record<string, any> = {};
	for (const [key, value] of Object.entries(data)) {
		const k = key as keyof EventData;
		d[k] = value ?? MISSING_SENTINEL;
	}
	return `
*Here's your event preview. If everything looks good, hit **Create Event** to add it to the server. Otherwise, you can correct the details or delete this draft.*
*I understand natural language – you can tell me to "change the date to 7:30 PM on Jan 11" or "change the location to Cheesman Park."*
────────────────────────────────────────
**Name:** ${d.name}
**Date:** ${dayjs(d.date).format(prettyDateFormat)} (${d.date})
**Location:** ${d.location}
**URL:** ${d.url}

${d.desc}
	`.trim();
}

export function parsePPEvent(raw: string): { data: EventData } | { error: string } {
	const matcher =
		/\*\*Name:\*\* (.*)\n\*\*Date:\*\* [^\(]*\((.*)\)\n\*\*Location:\*\* (.*)\n\*\*URL:\*\* (.*)\n\n([\s\S]*)/;
	const match = matcher.exec(raw);
	if (!match) return { error: "failed to parse event" };
	const vals: (string | null)[] = [];
	for (let i = 1; i < match.length; i++) {
		vals[i] = match[i];
		if (match[i] === MISSING_SENTINEL) vals[i] = null;
	}
	const [, name, date, location, url, desc] = vals;
	return { data: { name, date, location, url, desc } };
}
