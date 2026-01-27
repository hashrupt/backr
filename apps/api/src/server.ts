import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import authPlugin from "./lib/auth.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import entityRoutes from "./routes/entities.js";
import campaignRoutes from "./routes/campaigns.js";
import interestRoutes from "./routes/interests.js";
import inviteRoutes from "./routes/invites.js";
import backingRoutes from "./routes/backings.js";
import appRoutes from "./routes/apps.js";
import adminAppsRoutes from "./routes/admin/apps.js";

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
    transport:
      config.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  },
});

// Plugins
await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
await app.register(helmet);
await app.register(swagger, {
  openapi: {
    info: {
      title: "Backr API",
      description: "Crowdsourced staking platform on Canton Network",
      version: "0.1.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
});
await app.register(swaggerUi, { routePrefix: "/docs" });
await app.register(authPlugin);

// Routes
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: "/auth" });
await app.register(entityRoutes, { prefix: "/entities" });
await app.register(campaignRoutes, { prefix: "/campaigns" });
await app.register(interestRoutes, { prefix: "/interests" });
await app.register(inviteRoutes, { prefix: "/invites" });
await app.register(backingRoutes, { prefix: "/backings" });
await app.register(appRoutes, { prefix: "/apps" });
await app.register(adminAppsRoutes, { prefix: "/admin/apps" });

// Start
try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    `Backr API running on ${config.HOST}:${config.PORT} (Site ${config.SITE_VARIANT} / DAML v${config.DAML_MODEL_VERSION})`
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export default app;
