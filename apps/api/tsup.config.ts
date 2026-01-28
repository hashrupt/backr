import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  // Bundle local workspace packages and generated prisma
  noExternal: ["@backr/shared", /generated\/prisma/],
});
