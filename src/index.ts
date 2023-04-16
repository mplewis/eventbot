import { Client, ClientUser, Events } from "discord.js";
import dayjs from "dayjs";
import { discordBotToken } from "./env";
import { promptCreateEvent } from "./template";
import { glog } from "./log";
import { complete } from "./openai";

let me: ClientUser | undefined;
const client = new Client({ intents: ["Guilds", "GuildMessages"] });

const eventInfo = `
Hey All! I'm organizing a get together for anyone who wants to come out east (or is already out here).  The Parkside Eatery located at 14515 E Alameda Ave, Aurora, CO 80012, has an open area for seating, a bar, and tons of restaurants including:
- Gina's Kitchen - an allergy sensitive restaurant with vegan as well a gluten free options
- Taco Choi
- The Lucky Bird
- Halal Guys
- Five Guys
- Cheba Hut (toasted subs)
- Playa Bowls
It's also right down the street from In and Out Burger and the Aurora Metro Center for the public transportation users.

This will be a fun, casual, family friendly get together.  Everyone is welcome.  Come have fun!
`;

const eventInfo2 = `LFG for Ragnaros, need a tank and a healer.  I'm a 60 mage.`;

client.once(Events.ClientReady, (c) => {
	let log = glog.child({ id: c.user.id, tag: c.user.tag });
	me = c.user;
	log.info("Ready!");
});

(async () => {
	const dateWithTZ = dayjs().format("MMMM D, YYYY, h:mm A z");
	const prompt = await promptCreateEvent({ dateWithTZ, eventInfo: eventInfo });
	glog.info(prompt);
	// const result = await complete(prompt);
	// glog.info(result);
})();

glog.info("Connecting...");
client.login(discordBotToken);

client.on("messageCreate", async (m) => {
	if (!m.content) return;
	if (m.author.id === me?.id) return;
	const tagMatcher = /(<@\d+>\s*)/g;
	const content = m.content.replaceAll(tagMatcher, "");
	let log = glog.child({ from: m.author.id, me: me?.id, content });
	log.info("Received message");

	const dateWithTZ = dayjs().format("MMMM D, YYYY, h:mm A z");
	const prompt = await promptCreateEvent({ dateWithTZ, eventInfo: content });
	const compl = await complete(prompt);
	m.channel.send(compl);
});
