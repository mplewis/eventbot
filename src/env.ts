import * as dotenv from "dotenv";

function get(key: string, dfault?: string): string {
	const val = process.env[key] || dfault;
	if (!val) throw new Error(`missing env var ${key}`);
	return val;
}

dotenv.config();

export const discordBotToken = get("DISCORD_BOT_TOKEN");
export const openaiAPIKey = get("OPENAI_API_KEY");
export const logLevel = get("LOG_LEVEL", "info");
