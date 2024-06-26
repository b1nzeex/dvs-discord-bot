import {
  SapphireClient,
  LogLevel,
  ApplicationCommandRegistries,
  RegisterBehavior,
  container,
} from "@sapphire/framework";
import { Partials } from "discord.js";
import CustomLogger from "../util/CustomLogger";
import { PrismaClient } from "@prisma/client";
import RCEManager from "../util/RCEManager";
import { SettingsProvider } from "../util/SettingsProvider";
import VIPManager from "../util/VIPManager";
import WebCacheManager from "../util/WebCacheManager";
import { Server, servers } from "../servers";
import { VerifySession } from "../interfaces";

export default class BotClient extends SapphireClient {
  public constructor() {
    super({
      api: {
        listenOptions: {
          port: 3001,
          host: process.env.NODE_ENV === "production" ? "0.0.0.0" : undefined,
        },
        prefix: "/",
        origin: process.env.MAIN_WEBSITE_URL,
      },
      intents: [
        "Guilds",
        "GuildMessages",
        "GuildMembers",
        "GuildPresences",
        "GuildMessageReactions",
        "MessageContent",
      ],
      partials: [Partials.Message, Partials.Reaction, Partials.User],
      logger: {
        instance: new CustomLogger(LogLevel.Info),
      },
      presence: {
        status: "dnd",
      },
    });
  }

  public override async login(token?: string) {
    // Overwrite the default behavior of the application command registries
    ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
      RegisterBehavior.Overwrite
    );

    // Initialize servers
    container.servers = servers;

    // Connect to the database
    container.db = new PrismaClient();
    container.settings = new SettingsProvider(container.db);
    await container.settings.init();

    // Connect to the RCE server
    container.rce = new RCEManager();

    // Initialize VIP manager
    container.vipManager = new VIPManager();

    // Initialize verification sessions
    container.verifications = new Map();

    // Login to discord
    return super.login(token);
  }
}

declare module "@sapphire/pieces" {
  interface Container {
    db: PrismaClient;
    rce: RCEManager;
    settings: SettingsProvider;
    vipManager: VIPManager;
    webCache: WebCacheManager;
    servers: Server[];
    verifications: Map<string, VerifySession>;
  }
}
