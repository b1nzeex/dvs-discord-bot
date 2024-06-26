import { Precondition } from "@sapphire/framework";
import type { ChatInputCommandInteraction } from "discord.js";
import { RUST_ADMINS } from "../vars";

export default class OwnerPrecondition extends Precondition {
  public async chatInputRun(interaction: ChatInputCommandInteraction) {
    const admin = RUST_ADMINS.find(
      (admin) => admin.discord === interaction.user.id
    );

    if (admin?.owner) return this.ok();

    return this.error({
      message: "You are not the owner of this bot.",
    });
  }
}

declare module "@sapphire/framework" {
  interface Preconditions {
    OwnerOnly: never;
  }
}
