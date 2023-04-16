import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	ClientUser,
	Events,
	ModalBuilder,
	TextInputBuilder,
} from "discord.js";
import dayjs from "dayjs";
import { discordBotToken } from "./env";
import { glog } from "./log";
import { parseCreateEvent } from "./openai";
import { parsePPEvent, ppEvent } from "./pretty";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { ActionRow } from "discord.js";

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

	const loading = await m.channel.send("Thinking...");

	const dateWithTZ = dayjs().format("MMMM D, YYYY, h:mm A z");
	const utcOffset = dayjs().format("Z");
	const resp = await parseCreateEvent({ dateWithTZ, utcOffset, eventInfo: content });
	if ("error" in resp) {
		log.error(resp.error);
		m.channel.send("Sorry, something went wrong.");
		return;
	}
	if ("irrelevant" in resp) {
		m.channel.send("Sorry, that didn't look like an event to me.");
		return;
	}
	const msg = ppEvent(resp.result, content);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setLabel("Create Event").setStyle(ButtonStyle.Success).setCustomId("createEventBtn"),
		new ButtonBuilder().setLabel("Edit Details").setStyle(ButtonStyle.Primary).setCustomId("editDetailsBtn"),
		new ButtonBuilder().setLabel("Delete Event").setStyle(ButtonStyle.Danger).setCustomId("deleteEventBtn")
	);
	await m.channel.send({ content: msg, components: [row] });
	await loading.delete();
});

client.on("interactionCreate", async (intn) => {
	glog.debug(intn);

	if (intn.isButton()) {
		const parsed = parsePPEvent(intn.message.content);
		glog.debug(parsed);

		const id = intn.customId;
		if (id === "editDetailsBtn") {
			const modal = new ModalBuilder()
				.setCustomId("editDetailsModal")
				.setTitle("Edit Event Details")
				.addComponents(
					new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
						new TextInputBuilder()
							.setCustomId("updateData")
							.setLabel("What do you want to change?")
							.setStyle(TextInputStyle.Paragraph)
					)
				);
			await intn.showModal(modal);
			return;
		}

		(async () => {
			const resp = await intn.reply({ content: `\`${intn.customId}\` not implemented yet.`, ephemeral: true });
			setTimeout(() => resp.delete(), 2000);
		})();
	}

	if (intn.isModalSubmit()) {
		if (!intn.message) {
			glog.error("No message found for modal submit");
			return;
		}
		const parsed = parsePPEvent(intn.message.content);
		glog.debug(parsed);

		intn.message.edit("Updating your event data, please wait...");

		(async () => {
			const resp = await intn.reply({ content: "Modal submitted", ephemeral: true });
			setTimeout(() => resp.delete(), 2000);
		})();
	}
});
