import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { tursoConfig } from "./env";
import * as schema from "./schema";

export function createDb(config = tursoConfig()) {
  return drizzle(createClient(config), { schema });
}
export type Db = ReturnType<typeof createDb>;

// One client per server instance, created on first use.
let instance: Db | undefined;
export function db() {
  return (instance ??= createDb());
}
