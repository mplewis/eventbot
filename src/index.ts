import { Client, Events, GatewayIntentBits } from "discord.js";
import * as dotenv from "dotenv";
import { pino } from "pino";

const log = pino();

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("missing bot token");

const client = new Client({ intents: ["Guilds", "GuildMessages"] });

client.once(Events.ClientReady, (c) => {
	log.info("Ready!", { user: c.user.tag });
});

log.info("Connecting...");
client.login(token);

client.on("messageCreate", (m) => {
	log.info(m);
	if (m.content.includes("ping")) m.reply("pong");
});
