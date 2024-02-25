import { Listener, container } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { RCEEventType } from "../../vars";
import { GameEvent } from "../../interfaces";

@ApplyOptions<Listener.Options>({
  name: RCEEventType.EventMessage,
  emitter: container.rce.emitter,
})
export default class GameEventListener extends Listener {
  public async run(event: GameEvent) {
    if (process.env.NODE_ENV !== "production") return;

    this.container.rce.sendCommandToServer(
      `${event.server.ipAddress}:${event.server.port}`,
      `say <color=green>${event}</color> is incoming...`
    );
  }
}
