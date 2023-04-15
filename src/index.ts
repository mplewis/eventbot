import { Client, ClientUser, Events } from "discord.js";
import { Configuration, OpenAIApi } from "openai";
import { pino } from "pino";
import dayjs from "dayjs";
import { discordBotToken, openaiAPIKey } from "./env";
import { prompt } from "./template";

const glog = pino();

const configuration = new Configuration({ apiKey: openaiAPIKey });
const openai = new OpenAIApi(configuration);

(async () => {
	const dateWithTZ = dayjs().format("MMMM D, YYYY, h:mm A z");
	const promptData = await prompt.createEvent({ dateWithTZ, eventInfo: "Test stuff" });
	glog.info(promptData);
})();

let me: ClientUser | undefined;
const client = new Client({ intents: ["Guilds", "GuildMessages"] });

client.once(Events.ClientReady, (c) => {
	let log = glog.child({ id: c.user.id, tag: c.user.tag });
	me = c.user;
	log.info("Ready!");
});

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
	const promptData = (await prompt.createEvent)({ dateWithTZ, eventInfo: content });

	const completion = await openai.createCompletion({
		model: "text-davinci-003",
		prompt: promptData,
	});
	const resp = completion.data.choices[0].text || "Sorry, something went wrong.";
	m.channel.send(resp);
});
