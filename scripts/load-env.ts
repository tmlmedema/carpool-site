// Loads .env files the same way Next.js does (.env.development unless NODE_ENV=production),
// for tools that run outside Next: drizzle-kit and the scripts in this folder.
import * as nextEnvModule from "@next/env";

// @next/env is CommonJS. Native ESM (tsx) exposes it only as `default`; drizzle-kit's
// bundler exposes the named export directly.
type NextEnv = typeof import("@next/env");
const nextEnv: NextEnv = "loadEnvConfig" in nextEnvModule ? nextEnvModule : (nextEnvModule as unknown as { default: NextEnv }).default;

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
