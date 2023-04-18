import dayjs from "dayjs";
import nunjucks from "nunjucks";
import { z } from "zod";
import { prettyDateFormat } from "./pretty";

nunjucks.configure("templates", { autoescape: false });

export const eventDataSchema = z.object({
	name: z.string().or(z.null()),
	start: z.string().or(z.null()), // ISO8601
	end: z.string().or(z.null()), // ISO8601
	location: z.string().or(z.null()),
	desc: z.string().or(z.null()).or(z.undefined()), // we populate this
});
export type EventData = z.infer<typeof eventDataSchema>;

const errSchema = (name: string) => ({
	required_error: `Please provide a ${name} for your event.`,
	invalid_type_error: `Please provide a valid ${name} for your event.`,
});
export const validEventDataSchema = z.object({
	name: z.string({ ...errSchema("name") }),
	start: z.string({ ...errSchema("start time") }),
	end: z.string({ ...errSchema("end time") }),
	desc: z.string({ ...errSchema("description") }),
	location: z.string().or(z.null()),
});
export type ValidEventData = z.infer<typeof validEventDataSchema>;

export async function render(name: string, args: Record<string, any>): Promise<string> {
	for (const [key, value] of Object.entries(args)) {
		if (typeof value === "object") args[key] = JSON.stringify(value);
	}
	return nunjucks.render(`${name}.njk`, args);
}

export async function promptCreateEvent(args: {
	dateWithTZ: string;
	utcOffset: string;
	eventInfo: string;
}): Promise<string> {
	return render("prompt-create-event", args);
}

export async function promptEditEvent(args: {
	dateWithTZ: string;
	utcOffset: string;
	existingEventData: EventData;
	updateInfo: string;
}): Promise<string> {
	return render("prompt-edit-event", args);
}

export function now() {
	return {
		// TODO: set tz for dayjs using config
		dateWithTZ: dayjs().format(prettyDateFormat),
		utcOffset: dayjs().format("Z"),
	};
}
