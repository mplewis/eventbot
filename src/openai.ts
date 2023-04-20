import { Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import { openaiAPIKey } from "./env";
import { glog } from "./log";
import { EventData, eventDataSchema, promptCreateEvent, promptEditEvent } from "./template";
import { ZodType } from "zod";

const configuration = new Configuration({ apiKey: openaiAPIKey });
const openai = new OpenAIApi(configuration);

/** The options to use when making a completion request to GPT */
const options: CreateCompletionRequest = {
	model: "text-davinci-003",
	max_tokens: 2048,
	temperature: 0.0,
};

/** The shape of the response returned from GPT completion */
export type CompletionResult<T> = { result: T } | { irrelevant: true } | { error: string };

/**
 * Complete a prompt by submitting it to GPT.
 * @param validator The schema to use for validating the result
 * @param prompt The prompt to complete
 * @returns The completion result
 */
async function complete<T>(validator: ZodType<T>, prompt: string): Promise<CompletionResult<T>> {
	const log = glog.child({ prompt });
	log.debug("submitting prompt");
	let result: unknown;

	try {
		const completion = await openai.createCompletion({ ...options, prompt });
		let { text } = completion.data.choices[0];
		if (!text) return { error: "did not receive a completion" };

		// Append the opening JSON brace to the completion if it was the end of the prompt
		if (prompt.trim().endsWith("{") && !text.trim().startsWith("{")) text = `{${text}`;

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
	log.debug({ result }, "completed prompt");
	return { result: result as T };
}

/**
 * Parse a Create Event request with GPT.
 * @param args The arguments for a new event
 * @returns The completion result
 */
export async function parseCreateEvent(
	...args: Parameters<typeof promptCreateEvent>
): Promise<CompletionResult<EventData>> {
	return complete<EventData>(eventDataSchema, await promptCreateEvent(...args));
}

/**
 * Parse an Edit Event request with GPT.
 * @param args The arguments for an edited event
 * @returns The completion result
 */
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
