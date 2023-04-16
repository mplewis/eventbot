import { EventData } from "./template";

export function ppEvent(data: EventData, desc: string): string {
	return `
**Name:** ${data.name}
**Date:** ${data.date}
**Location:** ${data.location}
**URL:** ${data.url}

${desc}
	`.trim();
}

export function parsePPEvent(raw: string): { data: EventData; desc: string } | { error: string } {
	const matcher = /\*\*Name:\*\* (.*)\n\*\*Date:\*\* (.*)\n\*\*Location:\*\* (.*)\n\*\*URL:\*\* (.*)\n\n([\s\S]*)/m;
	const match = matcher.exec(raw);
	if (!match) return { error: "failed to parse event" };
	const [, name, date, location, url, desc] = match;
	return { data: { name, date, location, url }, desc };
}
