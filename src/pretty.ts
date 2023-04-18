import dayjs from "dayjs";
import { EventData } from "./template";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";
import { glog } from "./log";

dayjs.extend(advancedFormat);
dayjs.extend(timezone);

export const prettyDateFormat = "dddd, MMMM D, YYYY [at] h:mm A z";

export const eventPreviewGuide = `
*Here's your event preview. If everything looks good, hit **Create Event** to add it to the server. Otherwise, you can correct the details or delete this draft.*
*I understand natural language – you can tell me to "change the date to 7:30 PM on Jan 11" or "change the location to Cheesman Park."*
────────────────────────────────────────
`.trim();

const MISSING_SENTINEL = "*not provided*";
const kvMatcher = /^\*\*([A-Za-z]+):\*\* (.*)$/;
const dateMatcher = /[^\(]+\(([^\)]+)\)/;

function formatDate(date: string | null | undefined): string {
	glog.debug(date);
	if (!date || date === "" || date === MISSING_SENTINEL) return MISSING_SENTINEL;
	return `${dayjs(date).format(prettyDateFormat)} (${date})`;
}

function parseDate(raw: string): string | null {
	if (raw === MISSING_SENTINEL) return null;
	const match = raw.match(dateMatcher);
	if (!match) return null;
	glog.info({ match });
	const date = new Date(match[1]).toISOString();
	if (!date) return null;
	return date;
}

export function ppEvent(data: EventData, prefix?: string): string {
	const d: Record<string, any> = {};
	for (const [key, value] of Object.entries(data)) {
		const k = key as keyof EventData;
		d[k] = value ?? MISSING_SENTINEL;
	}
	let out = `
**Name:** ${d.name}
**Start:** ${formatDate(d.start)}
**End:** ${formatDate(d.end)}
**Location:** ${d.location}

${d.desc}
	`.trim();
	if (prefix) out = `${prefix}\n${out}`;
	return out;
}

export function parsePPEvent(raw: string): EventData {
	const data: EventData = { name: null, start: null, end: null, location: null, desc: null };
	const lines = raw.split("\n");
	const kvLines = lines
		.map((line, idx) => ({ line, idx }))
		.map(({ line, idx }) => ({ match: line.match(kvMatcher), idx }))
		.filter(({ match }) => match)
		.map(({ match, idx }) => ({ match: match as RegExpMatchArray, idx }));

	for (const { match } of kvLines) {
		let [_, key, value] = match;
		key = key.toLowerCase();
		if (key === "name") data.name = value;
		else if (key === "start") data.start = parseDate(value);
		else if (key === "end") data.end = parseDate(value);
		else if (key === "location") data.location = value;
		else glog.warn(`Unknown key when parsing pp event: ${key}`);
	}

	const lastKvLineIdx = kvLines[kvLines.length - 1]?.idx;
	const descLines = lines.slice(lastKvLineIdx + 1);
	data.desc = descLines.join("\n").trim();

	return data;
}

export function auditMessage(userTag: string): string {
	return `Event creation started by \`${userTag}\``;
}

export function parseAuditMessage(raw: string): string | null {
	const match = raw.match(/^Event creation started by `(.+)`/);
	if (!match) return null;
	return match[1];
}
