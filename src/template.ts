import { readFile } from "fs/promises";
import nunjucks, { Template, compile } from "nunjucks";
import { join } from "path";

const templateCache: Record<string, Template> = {};

nunjucks.configure({ autoescape: true });

// export type Renderable<T extends object> = (args: T) => string;

export type Renderable = {
	template: string;
};

// async function template<T extends object>(name: string): Promise<Renderable<T>> {
// 	if (!templateCache[name]) {
// 		const path = join(__dirname, "..", "templates", `${name}.njk`);
// 		const raw = await readFile(path, "utf-8");
// 		templateCache[name] = compile(raw);
// 	}
// 	return templateCache[name].render;
// }

export async function render<T extends Renderable>(args: T): Promise<string> {
	return "TODO";
}

export const templates: Record<string, Renderable> = {
	"prompt-create-event": {
		template: "prompt-create-event",
		dateWithTZ: string;
		eventInfo: string;
	}

}

// export const prompt = {
// 	createEvent: template<{
// 		dateWithTZ: string;
// 		eventInfo: string;
// 	}>("prompt-create-event"),

// 	editEvent: template<{
// 		dateWithTZ: string;
// 		existingEventData: string;
// 		updateInfo: string;
// 	}>("prompt-edit-event"),
// };

// export const proposedEvent = template<{
// 	name: string;
// 	date: string;
// 	location: string;
// 	url: string;
// 	desc: string;
// }>("proposed-event");
