import { Client, ClientUser, Events } from "discord.js";
import { discordBotToken } from "./env";
import { glog } from "./log";
import { handleButtonClick, handleMessage, handleModalSubmit } from "./discord";

let me: ClientUser | undefined;

const client = new Client({ intents: ["Guilds", "GuildMessages"] });
client.once(Events.ClientReady, (c) => {
	let log = glog.child({ id: c.user.id, tag: c.user.tag });
	me = c.user;
	log.info("Ready!");
});
glog.info("Connecting...");
client.login(discordBotToken);

client.on("messageCreate", (m) => {
	if (!me) {
		glog.error("missing `me` on message create");
		return;
	}
	return handleMessage(me, m);
});

client.on("interactionCreate", async (intn) => {
	glog.debug(intn);
	if (intn.isButton()) return handleButtonClick(intn);
	if (intn.isModalSubmit()) return handleModalSubmit(intn);
	glog.error(`Unknown interaction type: ${intn.type}`);
});
