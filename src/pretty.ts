import dayjs from "dayjs";
import { EventData } from "./template";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(advancedFormat);
dayjs.extend(timezone);

export const prettyDateFormat = "dddd, MMMM D, YYYY [at] h:mm A z";

const MISSING_SENTINEL = "*not provided*";

export function ppEvent(data: EventData, desc: string): string {
	const d: Record<string, any> = {};
	for (const [key, value] of Object.entries(data)) {
		const k = key as keyof EventData;
		d[k] = value ?? MISSING_SENTINEL;
	}
	return `
**Name:** ${d.name}
**Date:** ${dayjs(d.date).format(prettyDateFormat)} (${d.date})
**Location:** ${d.location}
**URL:** ${d.url}

${desc}
	`.trim();
}

export function parsePPEvent(raw: string): { data: EventData; desc: string } | { error: string } {
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
	return { data: { name, date, location, url }, desc: desc ?? "*description is missing*" };
}
