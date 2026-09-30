// Turso connection settings. The Vercel Turso integration sets TURSO_DATABASE_URL / TURSO_AUTH_TOKEN;
// locally, .env.development points TURSO_DATABASE_URL at a SQLite file (file:...).
export function tursoConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set (see .env.example)");
  return { url, authToken: process.env.TURSO_AUTH_TOKEN };
}
