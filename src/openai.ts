import { Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import { openaiAPIKey } from "./env";
import { glog } from "./log";
import { EventData, eventDataSchema, promptCreateEvent, promptEditEvent, proposedEvent } from "./template";
import { ZodType } from "zod";

const configuration = new Configuration({ apiKey: openaiAPIKey });
const openai = new OpenAIApi(configuration);

const options: CreateCompletionRequest = {
	model: "text-davinci-003",
	max_tokens: 2048,
	temperature: 0.0,
};

export type CompletionResult<T> = { result: T } | { irrelevant: true } | { error: string };

async function complete<T>(validator: ZodType<T>, prompt: string): Promise<CompletionResult<T>> {
	glog.info(prompt);
	const completion = await openai.createCompletion({ ...options, prompt });
	let { text } = completion.data.choices[0];
	if (!text) return { error: "did not receive a completion" };
	if (prompt.trim().endsWith("{")) text = `{${text}`;

	let result: unknown;
	try {
		result = JSON.parse(text);
		if (!result) return { error: "did not parse anything" };
		if (typeof result !== "object") return { error: `did not parse an object: got ${result}` };
	} catch (e: any) {
		glog.error(e);
		return { error: e.toString() };
	}
	if ("irrelevant" in result) return { irrelevant: true };
	const v = validator.safeParse(result);
	if (!v.success) return { error: v.error.message };
	return { result: result as T };
}

export async function parseCreateEvent(
	...args: Parameters<typeof promptCreateEvent>
): Promise<CompletionResult<EventData>> {
	return complete<EventData>(eventDataSchema, await promptCreateEvent(...args));
}

export async function parseEditEvent(
	...args: Parameters<typeof promptEditEvent>
): Promise<CompletionResult<EventData>> {
	const resp = await complete<EventData>(eventDataSchema, await promptEditEvent(...args));
	if ("result" in resp) {
		const { result } = resp;
		const vals = new Set(Object.values(result));
		if (vals.size === 1 && vals.has(null)) return { irrelevant: true };
	}
	return resp;
}

export async function parseProposedEvent(...args: Parameters<typeof proposedEvent>): Promise<CompletionResult> {
	return complete(await proposedEvent(...args));
}
