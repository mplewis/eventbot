import dayjs from "dayjs";
import { EventData } from "./template";
import advancedFormat from "dayjs/plugin/advancedFormat";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(advancedFormat);
dayjs.extend(timezone);

export const prettyDateFormat = "dddd, MMMM D, YYYY [at] h:mm A z";

export function ppEvent(data: EventData, desc: string): string {
	return `
**Name:** ${data.name}
**Date:** ${dayjs(data.date).format(prettyDateFormat)} (${data.date})
**Location:** ${data.location}
**URL:** ${data.url}

${desc}
	`.trim();
}

export function parsePPEvent(raw: string): { data: EventData; desc: string } | { error: string } {
	const matcher =
		/\*\*Name:\*\* (.*)\n\*\*Date:\*\* [^\(]*\((.*)\)\n\*\*Location:\*\* (.*)\n\*\*URL:\*\* (.*)\n\n([\s\S]*)/;
	const match = matcher.exec(raw);
	if (!match) return { error: "failed to parse event" };
	const [, name, date, location, url, desc] = match;
	return { data: { name, date, location, url }, desc };
}
