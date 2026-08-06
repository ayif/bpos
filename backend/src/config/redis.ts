import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

export async function connectRedis() {
  try {
    await redis.connect();
    console.log("[redis] connected");
  } catch (err) {
    console.error("[redis] failed to connect, continuing without cache:", (err as Error).message);
  }
}
