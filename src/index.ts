import { Client, ClientUser, Events, GatewayIntentBits } from "discord.js";
import * as dotenv from "dotenv";
import { pino } from "pino";

const glog = pino();

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) throw new Error("missing bot token");

let me: ClientUser | undefined;
const client = new Client({ intents: ["Guilds", "GuildMessages"] });

client.once(Events.ClientReady, (c) => {
	let log = glog.child({ id: c.user.id, tag: c.user.tag });
	me = c.user;
	log.info("Ready!");
});

glog.info("Connecting...");
client.login(token);

client.on("messageCreate", (m) => {
	if (!m.content) return;
	if (m.author.id === me?.id) return;
	const tagMatcher = /(<@\d+>\s*)/g;
	const content = m.content.replaceAll(tagMatcher, "");
	let log = glog.child({ from: m.author.id, me: me?.id, content });
	log.info("Received message");
});
