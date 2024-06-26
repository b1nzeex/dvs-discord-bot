import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import {
  ButtonInteraction,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { servers } from "../../servers";

interface RedeemKey {
  name: string;
  key: string;
  commands: string[];
}

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ViewModerationButton extends InteractionHandler {
  public async parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("confirm_redeem")) {
      return this.none();
    }

    return this.some({
      key: interaction.customId.split("@")[1],
      ign: interaction.customId.split("@")[2],
      server: interaction.customId.split("@")[3],
    });
  }

  public async run(
    interaction: ButtonInteraction,
    data: { key: string; ign: string; server: string }
  ) {
    await interaction.deferReply({ ephemeral: true });

    // Get the key data
    const redeemKeys: RedeemKey[] = this.container.settings.get(
      "global",
      "keys",
      []
    );
    const redeemKey = redeemKeys.find((key) => key.key === data.key);

    // If the key doesn't exist, send a response
    if (!redeemKey) {
      return interaction.editReply({
        content: "You provided an invalid redeem key.",
      });
    }

    // Delete the key
    redeemKeys.splice(redeemKeys.indexOf(redeemKey), 1);

    // Replace {username} with the in game name in the commands array
    redeemKey.commands = redeemKey.commands.map((command) =>
      command.replace(/{username}/g, data.ign)
    );

    // Execute the commands
    if (redeemKey.commands.length) {
      const success = await this.container.rce.sendCommands(
        servers.find((server) => server.id === data.server),
        redeemKey.commands
      );

      if (!success) {
        return interaction.editReply({
          content:
            "Something went wrong while redeeming the key. Please try again later.",
        });
      }

      // Save the keys
      this.container.settings.set("global", "keys", redeemKeys);
    }

    // Send to code redemption channel
    const channel = this.container.client.channels.cache.get(
      process.env.CODE_REDEMPTION_LOG_CHANNEL_ID
    ) as TextChannel;

    const serverInfo = servers.find(
      (s) => s.id.toLowerCase() === data.server.toLowerCase()
    );

    if (
      channel &&
      channel
        .permissionsFor(interaction.guild.members.me)
        .has([PermissionFlagsBits.SendMessages])
    ) {
      channel.send({
        content: `[${serverInfo.name}] **${interaction.user}** redeemed \`${
          redeemKey.name
        }\`\n\`\`\`\n${redeemKey.commands.join("\n")}\n\`\`\`\n**Key:** \`${
          redeemKey.key
        }\`\n**In-Game Username:** \`${data.ign}\``,
      });
    }

    // Send a response
    return interaction.editReply({
      content: `You have redeemed \`${redeemKey.name}\` for the in-game username: \`${data.ign}\``,
    });
  }
}
