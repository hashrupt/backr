import { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    version: "0.1.0",
    site: config.SITE_VARIANT,
    damlVersion: config.DAML_MODEL_VERSION,
    timestamp: new Date().toISOString(),
  }));
};

export default healthRoutes;
