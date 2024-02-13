import { container } from "@sapphire/framework";
import { WebSocket } from "ws";
import { EventEmitter } from "events";
import nodeCron from "node-cron";
import { Time } from "@sapphire/time-utilities";
import { ignoredAttacker, RCEEventType } from "../vars";
import {
  ChatMessage,
  ItemSpawn,
  RCERole,
  KillMessage,
  SocketData,
  NoteEdit,
} from "../interfaces";

class RCEManagerEvents extends EventEmitter {}

export default class RCEManager {
  private socket: WebSocket;
  private isReconnecting: boolean;
  public emitter: RCEManagerEvents;

  public constructor() {
    this.isReconnecting = false;
    this.connectWs();

    this.emitter = new RCEManagerEvents();
  }

  public reconnectWs(): void {
    if (!this.isReconnecting) {
      this.isReconnecting = true;
      this.connectWs();
    }
  }

  private async connectWs(): Promise<void> {
    while (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      try {
        this.socket = new WebSocket(
          `ws://${process.env.RUST_IP_ADDRESS}:${process.env.RUST_RCON_PORT}/${process.env.RUST_FTP_PASSWORD}`
        );

        await new Promise((resolve) => {
          this.socket.addEventListener("open", () => {
            this.isReconnecting = false;
            container.logger.ws(
              "WebSocket connection established with RCE server"
            );
            resolve(null);
          });
        });
      } catch (error) {
        container.logger.error(error);
        await new Promise((resolve) => setTimeout(resolve, Time.Second * 5));
      }
    }

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.addEventListener("close", () => {
      if (!this.isReconnecting) {
        container.logger.ws("WebSocket connection closed with RCE server");
        this.isReconnecting = true;
        this.connectWs();
      }
    });

    this.socket.addEventListener("error", (error) => {
      container.logger.error(error);
    });

    this.socket.addEventListener("message", (message) => {
      const data: SocketData = JSON.parse(message.data.toString());

      // Kill Feed
      if (data.Message.includes("was killed by")) {
        const killObject: KillMessage = {
          victim: data.Message.split(" was killed by ")[0],
          attacker: data.Message.split(" was killed by ")[1].split("\x00")[0],
        };

        // Ignore if attacker or victim is in ignoredAttacker array
        if (
          ignoredAttacker.includes(killObject.attacker.toLowerCase()) ||
          ignoredAttacker.includes(killObject.victim.toLowerCase()) ||
          Number(killObject.attacker) ||
          Number(killObject.victim)
        ) {
          return;
        }

        this.emitter.emit(RCEEventType.KillMessage, killObject);
      }

      // Player Joining
      if (
        data.Message.includes("joined [xboxone]") ||
        data.Message.includes("joined [ps4]")
      ) {
        const username = data.Message.split(" joined ")[0];
        this.emitter.emit(RCEEventType.PlayerJoin, { username });
      }

      // Join Team
      const joinTeamMatch = data.Message.match(
        /\[(.*?)\] has joined \[(.*?)\]s team, ID: \[(\d+)\]/
      );
      if (joinTeamMatch) {
        this.emitter.emit(RCEEventType.JoinedTeam, {
          ign: joinTeamMatch[1],
          owner: joinTeamMatch[2],
          teamId: parseInt(joinTeamMatch[3], 10),
        });
      }

      // Leave Team
      const leaveTeamMatch = data.Message.match(
        /\[(.*?)\] has left \[(.*?)\]s team, ID: \[(\d+)\]/
      );
      if (leaveTeamMatch) {
        this.emitter.emit(RCEEventType.LeftTeam, {
          ign: leaveTeamMatch[1],
          owner: leaveTeamMatch[2],
          teamId: parseInt(leaveTeamMatch[3], 10),
        });
      }

      // Add to Role
      const roleMatch = data.Message.match(/\[(.*?)\]/g);
      if (roleMatch && data.Message.includes("Added")) {
        const rceRole: RCERole = {
          inGameName: roleMatch[1],
          role: roleMatch[2],
        };

        this.emitter.emit(RCEEventType.AddRole, rceRole);
      }

      // Item Spawning
      const itemSpawnMatch = data.Message.match(
        /\[ServerVar\] giving\s+(\w+)\s+(\d+)\s*x\s+(.+)\x00/
      );
      if (itemSpawnMatch) {
        const itemSpawn: ItemSpawn = {
          receiver: itemSpawnMatch[1],
          amount: parseInt(itemSpawnMatch[2], 10),
          item: itemSpawnMatch[3],
        };

        this.emitter.emit(RCEEventType.ItemSpawnMessage, itemSpawn);
      }

      // Note Editing
      const noteEditMatch = data.Message.match(
        /\[NOTE PANEL\] Player \[ ([^\]]+) \] changed name from \[\s*([\s\S]*?)\s*\] to \[\s*([\s\S]*?)\s*\]/
      );
      if (noteEditMatch) {
        const username = noteEditMatch[1].trim();
        const oldContent = noteEditMatch[2].trim();
        const newContent = noteEditMatch[3].trim();

        const noteEdit: NoteEdit = {
          username,
          oldContent: oldContent.split("\n")[0],
          newContent: newContent.split("\n")[0],
        };

        if (
          noteEdit.newContent.length > 0 &&
          noteEdit.oldContent !== noteEdit.newContent
        ) {
          this.emitter.emit(RCEEventType.NoteEdit, noteEdit);
        }
      }

      // Events
      if (data.Message.includes("[event]")) {
        if (data.Message.includes("event_airdrop")) {
          this.emitter.emit(RCEEventType.EventMessage, "Airdrop");
        }

        if (data.Message.includes("event_cargoship")) {
          this.emitter.emit(RCEEventType.EventMessage, "Cargo Ship");
        }

        if (data.Message.includes("event_cargoheli")) {
          this.emitter.emit(RCEEventType.EventMessage, "Chinook");
        }

        if (data.Message.includes("event_helicopter")) {
          this.emitter.emit(RCEEventType.EventMessage, "Patrol Helicopter");
        }
      }

      switch (data.Type) {
        case "Chat":
          const chatMessage: ChatMessage = JSON.parse(data.Message);
          this.emitter.emit(RCEEventType.ChatMessage, chatMessage);
          break;
        case "Generic":
          this.emitter.emit(RCEEventType.WebSocketMessage, data);
          break;
        default:
          container.logger.warn("Unknown RCE message type", data);
          break;
      }
    });
  }

  public sendCommand(command: string): void {
    this.socket.send(
      JSON.stringify({
        identifier: -1,
        message: command,
      })
    );
  }

  public sendCommands(commands: string[]): void {
    commands.map(async (command) => {
      await this.sendCommand(command);
    });
  }

  public setCron(name: string, time: string, commands: string[]) {
    nodeCron.schedule(time, () => {
      container.logger.info(`Executing cron job: ${name}`);
      this.sendCommands(commands);
    });
  }

  public async fetchTickets(category: string): Promise<string> {
    const tickets = await container.db.ticket.findMany({
      where: {
        category,
      },
      include: {
        messages: true,
      },
    });

    const request = await fetch("https://hastebin.com/documents", {
      method: "POST",
      body: JSON.stringify(tickets),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HASTEBIN_TOKEN}`,
      },
    });

    const response = await request.json();
    container.logger.debug(response);

    return `https://hastebin.com/${response.key}`;
  }
}
