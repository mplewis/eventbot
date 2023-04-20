import * as dotenv from "dotenv";

/**
 * Get the value for an environment variable. If unset, throw an error or return a default value.
 * @param key The name of the environment variable to look up
 * @param dfault The fallback value if this variable is unset
 * @returns The value of the environment variable
 */
function get(key: string, dfault?: string): string {
	const val = process.env[key] || dfault;
	if (!val) throw new Error(`missing env var ${key}`);
	return val;
}

dotenv.config();

/** The token used to sign in as a Discord bot */
export const discordBotToken = get("DISCORD_BOT_TOKEN");
/** The API key used to access the OpenAI API */
export const openaiAPIKey = get("OPENAI_API_KEY");
/** Display logs at or above this log level */
export const logLevel = get("LOG_LEVEL", "info");
/** Listen in this channel only. */
export const listenChannel = get("LISTEN_CHANNEL", "eventbot");
