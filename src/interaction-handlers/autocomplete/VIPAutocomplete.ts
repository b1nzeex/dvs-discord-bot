import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { type AutocompleteInteraction } from "discord.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Autocomplete,
})
export class VIPAutocomplete extends InteractionHandler {
  public async parse(interaction: AutocompleteInteraction) {
    if (
      !["vip", "vip_delete", "vip_view", "vip_add"].includes(
        interaction.commandName
      )
    ) {
      return this.none();
    }

    // Get the focused option
    const focused = interaction.options.getFocused(true);
    if (!focused || focused.name !== "ign") {
      return this.none();
    }

    // Get all existing vips
    const vips = this.container.vipManager.vips.filter((vip) =>
      vip.id.toLowerCase().includes(focused.value.toLowerCase())
    );

    // Return the VIPs
    return this.some(
      vips.map((vip) => ({ name: vip.id, value: vip.id })).slice(0, 25)
    );
  }

  public async run(
    interaction: AutocompleteInteraction,
    result: InteractionHandler.ParseResult<this>
  ) {
    return interaction.respond(result);
  }
}
