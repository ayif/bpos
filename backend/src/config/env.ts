import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL", "postgresql://bpos:bpos_secret@localhost:5432/bpos?schema=public"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: required("JWT_SECRET", "dev_secret_change_me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  digiflazz: {
    mode: (process.env.DIGIFLAZZ_MODE ?? "mock") as "mock" | "live",
    username: process.env.DIGIFLAZZ_USERNAME ?? "",
    apiKey: process.env.DIGIFLAZZ_API_KEY ?? "",
    // Sandbox/developer accounts: set true so live-mode calls don't touch real balance.
    testing: (process.env.DIGIFLAZZ_TESTING ?? "false") === "true",
    // Shared secret Digiflazz's callback URL must include as ?token=... .
    // The /ppob/callback endpoint refuses all requests while this is unset.
    callbackToken: process.env.DIGIFLAZZ_CALLBACK_TOKEN ?? "",
  },
};
