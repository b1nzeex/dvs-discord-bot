import { Listener, container } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { RoleEvent } from "../../interfaces";
import { RCEEventType } from "../../vars";

@ApplyOptions<Listener.Options>({
  name: RCEEventType.AddRole,
  emitter: container.rce.emitter,
})
export default class AddRoleListener extends Listener {
  public async run(data: RoleEvent) {
    // Add VIP if role is VIP
    // if (data.role === "VIP") {
    //   this.container.vipManager.addVIP(data.inGameName);
    // }
  }
}
