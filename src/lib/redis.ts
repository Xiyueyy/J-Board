import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisErrorBound?: boolean;
};

function createRedis() {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  if (!globalForRedis.redisErrorBound) {
    client.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[redis] ${message}`);
    });
    globalForRedis.redisErrorBound = true;
  }

  return client;
}

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedis();
  }

  return globalForRedis.redis;
}

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = globalForRedis.redis ?? createRedis();
}
