import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ClientUser,
	GuildScheduledEventCreateOptions,
	GuildScheduledEventEntityType,
	GuildScheduledEventPrivacyLevel,
	Message,
	ModalBuilder,
	TextInputBuilder,
} from "discord.js";
import { glog } from "./log";
import { parseCreateEvent } from "./openai";
import { parsePPEvent, ppEvent } from "./pretty";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { parseEditEvent } from "./openai";

import { CacheType, ModalSubmitInteraction } from "discord.js";
import { now, validEventDataSchema } from "./template";
import z from "zod";

export async function handleMessage(me: ClientUser, m: Message<boolean>) {
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
	// Manually copy the full event body as the content when we create an event. We can't trust the LLM to do it.
	const msg = ppEvent({ ...resp.result, desc: content });
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setLabel("Create Event").setStyle(ButtonStyle.Success).setCustomId("createEventBtn"),
		new ButtonBuilder().setLabel("Edit Details").setStyle(ButtonStyle.Primary).setCustomId("editDetailsBtn"),
		new ButtonBuilder().setLabel("Discard Draft").setStyle(ButtonStyle.Danger).setCustomId("discardDraftBtn")
	);
	await m.channel.send({ content: msg, components: [row] });
	await loading.delete();
}

export async function handleButtonClick(intn: ButtonInteraction<CacheType>) {
	const id = intn.customId;

	if (id === "discardDraftBtn") {
		let forName = " ";
		const data = parsePPEvent(intn.message.content);
		if (data.name) forName = `for "${data.name}"`;
		await intn.message.delete();
		intn.reply({
			content: `Your event draft ${forName} was successfully discarded.`.replaceAll(/\s+/g, " "),
			ephemeral: true,
		});
		return;
	}

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

	if (id === "createEventBtn") {
		const { guild } = intn;
		if (!guild) {
			glog.error("No guild found for create event button");
			intn.reply({ content: "Sorry, we ran into an issue creating your event.", ephemeral: true });
			return;
		}
		const data = parsePPEvent(intn.message.content);
		const validated = validEventDataSchema.safeParse(data);
		if (!validated.success) {
			const { error } = validated;
			const msgs = error.issues.map((e: any) => `**${e.path.join(".")}**: ${e.message}`).join("\n");
			glog.debug(error);
			intn.reply({
				content: `Please fix the below issue(s) before creating your event:\n${msgs}`,
				ephemeral: true,
			});
			return;
		}

		const v = validated.data;
		const params: GuildScheduledEventCreateOptions = {
			name: v.name,
			scheduledStartTime: v.start,
			scheduledEndTime: v.end,
			privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
			entityType: GuildScheduledEventEntityType.External,
		};
		if (v.location) params.entityMetadata = { location: v.location };
		if (v.desc) params.description = v.desc;
		try {
			await guild.scheduledEvents.create(params);
		} catch (e) {
			glog.error(e);
			intn.reply({
				content: `Sorry, we ran into an issue creating your event:\n\`\`\`${e}\`\`\``,
				ephemeral: true,
			});
			return;
		}
		await intn.message.delete();
		intn.channel?.send({ content: `Created new server event:\n\n${ppEvent(v)}` });
		return;
	}

	(async () => {
		const resp = await intn.reply({ content: `\`${intn.customId}\` not implemented yet.`, ephemeral: true });
		setTimeout(() => resp.delete(), 2000);
	})();
}

export async function handleModalSubmit(intn: ModalSubmitInteraction<CacheType>) {
	if (!intn.message) {
		glog.error("No message found for modal submit");
		return;
	}

	const data = parsePPEvent(intn.message.content);
	glog.debug(data);
	const updateInfo = intn.fields.getTextInputValue("updateInfo");
	const loading = intn.reply({ content: "Updating your event data. Please wait...", ephemeral: true });

	const resp = await parseEditEvent({ ...now(), existingEventData: data, updateInfo });
	glog.debug(resp);
	if ("error" in resp) {
		glog.error(resp.error);
		intn.reply({
			content: `Sorry, we ran into an issue editing your event. Please try again.\n\nYou sent:\n${updateInfo}`,
			ephemeral: true,
		});
		(await loading).delete();
		return;
	}
	if ("irrelevant" in resp) {
		intn.reply({
			content: `Sorry, the message you wrote didn't look like an event update to me.\n\nYou sent:\n${updateInfo}`,
			ephemeral: true,
		});
		(await loading).delete();
		return;
	}

	const updated = ppEvent(resp.result);
	await intn.message.edit(updated);
	(await loading).delete();
}
