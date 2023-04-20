import dayjs from "dayjs";
import nunjucks from "nunjucks";
import { z } from "zod";
import { prettyDateFormat } from "./pretty";

// Load templates from the directory and don't escape output (we're not rendering HTML)
nunjucks.configure("templates", { autoescape: false });

/** Build an error schema that produces a pretty error for a missing field */
const errSchema = (name: string) => ({
	required_error: `Please provide a ${name} for your event.`,
	invalid_type_error: `Please provide a valid ${name} for your event.`,
});

/** The schema for an event's data */
export const eventDataSchema = z.object({
	name: z.string().or(z.null()),
	start: z.string().or(z.null()), // ISO8601
	end: z.string().or(z.null()), // ISO8601
	location: z.string().or(z.null()),
	desc: z.string().or(z.null()).or(z.undefined()), // we populate this
});
/** The schema for an event's data */
export type EventData = z.infer<typeof eventDataSchema>;

/** The schema for an event which we can successfully create in Discord */
export const validEventDataSchema = z.object({
	name: z.string({ ...errSchema("name") }),
	start: z.string({ ...errSchema("start time") }),
	end: z.string({ ...errSchema("end time") }),
	desc: z.string({ ...errSchema("description") }),
	location: z.string().or(z.null()),
});
/** The schema for an event which we can successfully create in Discord */
export type ValidEventData = z.infer<typeof validEventDataSchema>;

/**
 * Render a template by name with the given arguments.
 * @param name The name of the template to render
 * @param args The arguments to use when rendering the template
 * @returns The rendered template content
 */
async function render(name: string, args: Record<string, any>): Promise<string> {
	for (const [key, value] of Object.entries(args)) {
		if (typeof value === "object") args[key] = JSON.stringify(value);
	}
	return nunjucks.render(`${name}.njk`, args);
}

/**
 * Build the prompt to be used for parsing a new event.
 * @param args.dateWithTZ The current date including the local timezone (e.g. `November 1, 2021 at 12:00 PM EST`)
 * @param args.utcOffset The current UTC offset (e.g. `-07:00`)
 * @param args.eventInfo The raw info for the event from the user
 * @returns The rendered prompt for GPT
 */
export async function promptCreateEvent(args: {
	dateWithTZ: string;
	utcOffset: string;
	eventInfo: string;
}): Promise<string> {
	return render("prompt-create-event", args);
}

/**
 * Build the prompt to be used for parsing an existing event.
 * @param args.dateWithTZ The current date including the local timezone (e.g. `November 1, 2021 at 12:00 PM EST`)
 * @param args.utcOffset The current UTC offset (e.g. `-07:00`)
 * @param args.existingEventData The existing event data
 * @param args.updateInfo The raw info for the update from the user
 * @returns The rendered prompt for GPT
 */
export async function promptEditEvent(args: {
	dateWithTZ: string;
	utcOffset: string;
	existingEventData: EventData;
	updateInfo: string;
}): Promise<string> {
	return render("prompt-edit-event", args);
}

/**
 * Get the current date and UTC offset.
 * @returns The current date (in human-readable format) and UTC offset
 */
export function now() {
	return {
		// TODO: set tz for dayjs using config
		dateWithTZ: dayjs().format(prettyDateFormat),
		utcOffset: dayjs().format("Z"),
	};
}
