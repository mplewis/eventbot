import { readFile } from "fs/promises";
import nunjucks, { Template, compile } from "nunjucks";
import { join } from "path";

const templateCache: Record<string, Template> = {};

nunjucks.configure({ autoescape: true });

export async function render(name: string, args: object): Promise<string> {
	if (!templateCache[name]) {
		const path = join(__dirname, "..", "templates", `${name}.njk`);
		const raw = await readFile(path, "utf-8");
		templateCache[name] = compile(raw);
	}
	return templateCache[name].render(args);
}

export async function promptCreateEvent(args: { dateWithTZ: string; eventInfo: string }): Promise<string> {
	return render("prompt-create-event", args);
}

export async function promptEditEvent(args: {
	dateWithTZ: string;
	existingEventData: string;
	updateInfo: string;
}): Promise<string> {
	return render("prompt-edit-event", args);
}

export async function proposedEvent(args: {
	name: string;
	date: string;
	location: string;
	url: string;
	desc: string;
}): Promise<string> {
	return render("proposed-event", args);
}
