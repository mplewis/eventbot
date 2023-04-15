import * as dotenv from "dotenv";

function get(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`missing env var ${key}`);
	return val;
}

dotenv.config();

export const discordBotToken = get("DISCORD_BOT_TOKEN");
export const openaiAPIKey = get("OPENAI_API_KEY");
