import { createApp } from "./app";
import { env } from "@/config/env";
import { connectRedis } from "@/config/redis";
import { prisma } from "@/config/prisma";

async function main() {
  await connectRedis();
  await prisma.$connect();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[bpos-backend] listening on port ${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("Failed to start bpos-backend:", err);
  process.exit(1);
});
