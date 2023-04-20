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
import { auditMessage, eventPreviewGuide, parseAuditMessage, parsePPEvent, ppEvent } from "./pretty";
import { TextInputStyle } from "discord.js";
import { ModalActionRowComponentBuilder } from "discord.js";
import { parseEditEvent } from "./openai";
import { CacheType, ModalSubmitInteraction } from "discord.js";
import { now, validEventDataSchema } from "./template";
import { listenChannel } from "./env";

const GENERIC_ERROR_MESSAGE = (verb: string) => ({
	content: `Sorry, we ran into an issue ${verb} your event.`,
	ephemeral: true,
});

/**
 * Handle an incoming message.
 * @param me The bot user
 * @param m The received message
 */
export async function handleMessage(me: ClientUser, m: Message<boolean>) {
	if (!m.content) return; // if it wasn't for us, we can't see the content
	const channelName = (m.guild?.channels.cache.find((c) => c.id === m.channelId)?.name || "").toLowerCase();
	if (channelName !== listenChannel.toLowerCase()) return; // ignore messages in other channels
	if (m.author.id === me?.id) return; // ignore our own messages
	const log = glog.child({ from: m.author.tag });

	// strip the leading @Eventbot tag
	const tagMatcher = /^(<@\d+>\s*)/;
	const content = m.content.replace(tagMatcher, "");

	log.info({ content }, "received message");

	const loading = await m.reply("Parsing your event data. Please wait...");

	const resp = await parseCreateEvent({ ...now(), eventInfo: content });
	if ("error" in resp) {
		log.error({ error: resp.error }, "error parsing event");
		loading.edit("Sorry, something went wrong.");
		return;
	}
	if ("irrelevant" in resp) {
		loading.edit("Sorry, that didn't look like an event to me.");
		return;
	}

	// Manually copy the full event body as the content when we create an event. We can't trust the LLM to do it.
	const msg = ppEvent({ ...resp.result, desc: content }, eventPreviewGuide);
	// post the username in a message as an audit log
	const op = await m.reply({ content: auditMessage(m.author.tag) });
	await op.reply({ content: msg, components: [buildActionButtons()] });
	await loading.delete();
}

/**
 * Handle a button click interaction.
 * @param intn The interaction
 */
export async function handleButtonClick(intn: ButtonInteraction<CacheType>) {
	const id = intn.customId;
	if (id === "createEventBtn") {
		createEventFromDraft(intn);
		return;
	}
	if (id === "editDetailsBtn") {
		showEditModal(intn);
		return;
	}
	if (id === "discardDraftBtn") {
		discardDraft(intn);
		return;
	}

	(async () => {
		glog.error({ customId: intn.customId }, "unknown button interaction");
		const resp = await intn.reply({ content: `\`${intn.customId}\` not implemented yet.`, ephemeral: true });
		setTimeout(() => resp.delete(), 2000);
	})();
}

/**
 * Create an event from a draft.
 * @param intn The "Create Event" button interaction
 * @returns
 */
async function createEventFromDraft(intn: ButtonInteraction<CacheType>) {
	const { guild, channel } = intn;
	if (!guild) {
		glog.error("no guild found for create event button");
		intn.reply(GENERIC_ERROR_MESSAGE("creating"));
		return;
	}
	if (!channel) {
		glog.error("no channel found for create event button");
		intn.reply(GENERIC_ERROR_MESSAGE("creating"));
		return;
	}
	const log = glog.child({ from: intn.user.tag });

	const data = parsePPEvent(intn.message.content);
	const validated = validEventDataSchema.safeParse(data);
	if (!validated.success) {
		const { error } = validated;
		const errors = error.issues.map((e: any) => `**${e.path.join(".")}**: ${e.message}`).join("\n");
		log.info({ data, errors }, "event failed validation");
		intn.reply({
			content: `Please fix the below issue(s) before creating your event:\n${errors}`,
			ephemeral: true,
		});
		return;
	}
	log.info({ event: validated.data }, "creating validated event");

	const v = validated.data;
	const params: GuildScheduledEventCreateOptions = {
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
		entityType: GuildScheduledEventEntityType.External,
		name: v.name,
		scheduledStartTime: v.start,
		scheduledEndTime: v.end,
	};
	if (v.location) params.entityMetadata = { location: v.location };

	const op = await parentMessage(intn.message);
	if (!op) {
		log.error("No parent message found for create event button");
		intn.reply(GENERIC_ERROR_MESSAGE);
		return;
	}
	const authorTag = parseAuditMessage(op.content);
	if (!authorTag) {
		log.error("No audit message parsed from OP for create event button");
		intn.reply(GENERIC_ERROR_MESSAGE);
		return;
	}
	v.desc = `*Event created by ${authorTag}*\n${v.desc || ""}`.trim();
	params.description = v.desc;

	try {
		await guild.scheduledEvents.create(params);
	} catch (error: any) {
		log.error(error?.stack ?? error, "error creating event");
		intn.reply({
			content: `Sorry, we ran into an issue creating your event:\n\`\`\`${e}\`\`\``,
			ephemeral: true,
		});
		return;
	}

	log.info({ event: v }, "created event");
	const confirmContent = { content: `*Created new server event:*\n${ppEvent(v)}` };
	await channel.send(confirmContent);
	intn.message.delete();
	op.delete();
}

/**
 * Show the modal for editing event details.
 * @param intn The "Edit Details" button interaction
 */
async function showEditModal(intn: ButtonInteraction<CacheType>) {
	await intn.showModal(
		new ModalBuilder()
			.setCustomId("editDetailsModal")
			.setTitle("Edit Event Details")
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId("updateInfo")
						.setLabel("What do you want to change?")
						.setStyle(TextInputStyle.Paragraph)
						.setPlaceholder(
							"You can use natural language, e.g.\nThe event starts at 4 pm, Jan 11.\nThe address is 123 Wynkoop St."
						)
				)
			)
	);
}

/**
 * Handle the submission of the edit modal.
 * @param intn The modal submit interaction
 */
export async function handleModalSubmit(intn: ModalSubmitInteraction<CacheType>) {
	const log = glog.child({ from: intn.user.tag });
	if (!intn.message) {
		log.error("no message found for modal submit");
		intn.reply(GENERIC_ERROR_MESSAGE("editing"));
		return;
	}

	const data = parsePPEvent(intn.message.content);
	const updateInfo = intn.fields.getTextInputValue("updateInfo");
	const loading = intn.reply({ content: "Updating your event data. Please wait...", ephemeral: true });
	log.info({ updateInfo }, "parsing event update");
	const resp = await parseEditEvent({ ...now(), existingEventData: data, updateInfo });

	if ("error" in resp) {
		log.error(resp.error, "error parsing event update");
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

	const updated = ppEvent(resp.result, eventPreviewGuide);
	await intn.message.edit(updated);
	log.info({ updated }, "updated event");
	(await loading).delete();
}

/**
 * Discard a draft event.
 * @param intn The "Discard Draft" button interaction
 */
async function discardDraft(intn: ButtonInteraction<CacheType>) {
	const log = glog.child({ from: intn.user.tag });
	let forName = " ";
	const data = parsePPEvent(intn.message.content);
	if (data.name) forName = `for "${data.name}"`;

	const op = await parentMessage(intn.message);
	if (op) op.delete();
	await intn.message.delete();
	log.info("discarded event draft");
	intn.reply({
		content: `Your event draft ${forName} was successfully discarded.`.replaceAll(/\s+/g, " "),
		ephemeral: true,
	});
}

/**
 * Get the parent of a message (the one the message is replying to).
 * @param m The message to get the parent of
 * @returns The message, or null if it isn't replying to a message
 */
async function parentMessage(m: Message<boolean>): Promise<Message<boolean> | null> {
	const opRef = await m.reference;
	if (!opRef?.messageId) return null;
	try {
		return m.channel?.messages.fetch(opRef.messageId);
	} catch {
		return null;
	}
}

/** Build the action buttons for an event draft. */
function buildActionButtons() {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setLabel("Create Event").setStyle(ButtonStyle.Success).setCustomId("createEventBtn"),
		new ButtonBuilder().setLabel("Edit Details").setStyle(ButtonStyle.Primary).setCustomId("editDetailsBtn"),
		new ButtonBuilder().setLabel("Discard Draft").setStyle(ButtonStyle.Danger).setCustomId("discardDraftBtn")
	);
}
