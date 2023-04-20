import dayjs from "dayjs";
import { EventData } from "./template";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";
import { glog } from "./log";

dayjs.extend(advancedFormat);
dayjs.extend(timezone);

/** Render dates in a human-readable way, e.g. `Monday, January 1, 2021 at 12:00 PM EST` */
export const prettyDateFormat = "dddd, MMMM D, YYYY [at] h:mm A z";

export const eventPreviewGuide = `
*Here's your event preview. If everything looks good, hit **Create Event** to add it to the server. Otherwise, you can correct the details or delete this draft.*
*I understand natural language – you can tell me to "change the date to 7:30 PM on Jan 11" or "change the location to Cheesman Park."*
────────────────────────────────────────
`.trim();

/** Identifies a field that should be made `null` when parsed from the Discord draft */
const MISSING_SENTINEL = "*not provided*";
/** Matches a `**key**: value` */
const kvMatcher = /^\*\*([A-Za-z]+):\*\* (.*)$/;
/** Matches an ISO date wrapped in parens at the end of a pretty-formatted date line */
const dateMatcher = /[^\(]+\(([^\)]+)\)/;

/**
 * Format a date for display in a Discord event draft.
 * @param date The date to format
 * @returns The date formatted as a string, pretty format first, ISO format in params
 */
function formatDate(date: string | null | undefined): string {
	glog.debug(date);
	if (!date || date === "" || date === MISSING_SENTINEL) return MISSING_SENTINEL;
	return `${dayjs(date).format(prettyDateFormat)} (${date})`;
}

/**
 * Parse a date from a Discord event draft.
 * @param raw The raw date string from the Discord draft
 * @returns The ISO representation of the date
 */
function parseDate(raw: string): string | null {
	if (raw === MISSING_SENTINEL) return null;
	const match = raw.match(dateMatcher);
	if (!match) return null;
	glog.info({ match });
	const date = new Date(match[1]).toISOString();
	if (!date) return null;
	return date;
}

/**
 * Pretty-print an event for a Discord event draft message.
 * @param data The data to format
 * @param prefix Some text to prepend to the output
 * @returns The formatted event
 */
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

/**
 * Parse a pretty-printed event from a Discord event draft message.
 * @param raw The raw text from the draft
 * @returns The parsed event data
 */
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

/**
 * Build an audit message to log the creator of an event out of band.
 * @param userTag The user tag of the event creator
 * @returns A formatted string that can be parsed
 */
export function auditMessage(userTag: string): string {
	return `Event creation started by \`${userTag}\``;
}

/**
 * Parse an audit message to get the user tag of the event creator.
 * @param raw The raw audit message
 * @returns The user tag of the event creator, or null if the message is not an audit message
 */
export function parseAuditMessage(raw: string): string | null {
	const match = raw.match(/^Event creation started by `(.+)`/);
	if (!match) return null;
	return match[1];
}
