import nunjucks from "nunjucks";

nunjucks.configure("templates", { autoescape: false });

export async function render(name: string, args: object): Promise<string> {
	return nunjucks.render(`${name}.njk`, args);
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
