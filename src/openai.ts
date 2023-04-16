import { Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import { openaiAPIKey } from "./env";
import { glog } from "./log";

const configuration = new Configuration({ apiKey: openaiAPIKey });
const openai = new OpenAIApi(configuration);

const options: CreateCompletionRequest = {
	model: "text-davinci-003",
	max_tokens: 2048,
	temperature: 0.0,
};

export async function complete(prompt: string): Promise<{ result: object } | { irrelevant: true } | { error: string }> {
	const completion = await openai.createCompletion({ ...options, prompt });
	const { text } = completion.data.choices[0];
	if (!text) return { error: "did not receive a completion" };
	let result: unknown;
	try {
		result = JSON.parse(`{${text}`); // add leading { because we left one in the prompt
		if (!result) return { error: "did not parse anything" };
		if (typeof result !== "object") return { error: `did not parse an object: got ${result}` };
	} catch (e: any) {
		glog.error(e);
		return { error: e.toString() };
	}
	if ("irrelevant" in result) return { irrelevant: true };
	return { result };
}
