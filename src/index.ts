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
import { parsePPEvent, ppEvent, prettyDateFormat } from "./pretty";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { parseEditEvent } from "./openai";

let me: ClientUser | undefined;
const client = new Client({ intents: ["Guilds", "GuildMessages"] });

client.once(Events.ClientReady, (c) => {
	let log = glog.child({ id: c.user.id, tag: c.user.tag });
	me = c.user;
	log.info("Ready!");
});

glog.info("Connecting...");
client.login(discordBotToken);

function now() {
	return {
		// TODO: set tz for dayjs using config
		dateWithTZ: dayjs().format(prettyDateFormat),
		utcOffset: dayjs().format("Z"),
	};
}

client.on("messageCreate", async (m) => {
	if (!m.content) return;
	if (m.author.id === me?.id) return;
	const tagMatcher = /(<@\d+>\s*)/g;
	const content = m.content.replaceAll(tagMatcher, "");
	let log = glog.child({ from: m.author.id, me: me?.id, content });
	log.info("Received message");

	const loading = await m.channel.send("Thinking...");

	const resp = await parseCreateEvent({ ...now(), eventInfo: content });
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
							.setCustomId("updateInfo")
							.setLabel("What do you want to change?")
							.setStyle(TextInputStyle.Paragraph)
							.setPlaceholder("e.g.\nThe event starts at 4 pm, Jan 11.\nThe address is 123 Wynkoop St.")
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
		const resp1 = parsePPEvent(intn.message.content);
		if ("error" in resp1) {
			glog.error(resp1.error);
			intn.reply({
				content: "Sorry, we ran into an issue editing your event. Please try recreating the event from scratch.",
				ephemeral: true,
			});
			return;
		}
		glog.debug(resp1);
		const { data, desc } = resp1;

		const updateInfo = intn.fields.getTextInputValue("updateInfo");
		const resp2 = await parseEditEvent({ ...now(), existingEventData: data, updateInfo });
		if ("error" in resp2) {
			glog.error(resp2.error);
			intn.reply({
				content: `Sorry, we ran into an issue editing your event. Please try again.\n\nYou sent:\n${updateInfo}`,
				ephemeral: true,
			});
			return;
		}
		if ("irrelevant" in resp2) {
			intn.reply({
				content: `Sorry, the message you wrote didn't look like an event update to me.\n\nYou sent:\n${updateInfo}`,
				ephemeral: true,
			});
			return;
		}
		const updated = ppEvent(resp2.result, desc);
		await intn.message.edit(updated);

		(async () => {
			const resp = await intn.reply({ content: "Updated your event data!", ephemeral: true });
			setTimeout(() => resp.delete(), 5000);
		})();
	}
});
