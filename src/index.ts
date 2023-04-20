import { Client, ClientUser, Events } from "discord.js";
import { discordBotToken } from "./env";
import { glog } from "./log";
import { handleButtonClick, handleMessage, handleModalSubmit } from "./discord";
import { BitFieldResolvable } from "discord.js";
import { GatewayIntentsString } from "discord.js";

/** The intents this bot requires to function */
const intents: BitFieldResolvable<GatewayIntentsString, number> = ["Guilds", "GuildMessages"];

/** Catch any thrown error and log it rather than crashing. */
async function catchWrap(fn: () => Promise<void>) {
	try {
		await fn();
	} catch (error: any) {
		glog.error({ error: error?.stack ?? error }, "unhandled error");
	}
}
async function main() {}

main();

/** The current signed-in bot user */
let me: ClientUser | undefined;

// Connect to Discord
const client = new Client({ intents });
client.once(Events.ClientReady, (c) => {
	me = c.user;
	glog.info({ tag: c.user.tag }, "Connected!");
});
glog.info("Connecting...");
client.login(discordBotToken);

// Handle incoming messages
client.on("messageCreate", (m) => {
	catchWrap(async () => {
		if (!me) {
			glog.error("missing `me` on message create");
			return;
		}
		glog.debug(m, "messageCreate");
		return handleMessage(me, m);
	});
});

// Handle interactions (button clicks, modal submits, etc.)
client.on("interactionCreate", async (intn) => {
	catchWrap(async () => {
		glog.debug(intn, "interactionCreate");
		if (intn.isButton()) return handleButtonClick(intn);
		if (intn.isModalSubmit()) return handleModalSubmit(intn);
		glog.error(`Unknown interaction type: ${intn.type}`);
	});
});
