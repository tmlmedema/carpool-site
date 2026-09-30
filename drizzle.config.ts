import "./scripts/load-env";
import { defineConfig } from "drizzle-kit";
import { tursoConfig } from "./lib/db/env";

export default defineConfig({
  dialect: "turso",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: tursoConfig(),
  strict: true,
});
