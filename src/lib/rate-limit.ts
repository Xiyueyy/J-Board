import { getRedis } from "./redis";
import { randomUUID } from "crypto";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

/**
 * Sliding window rate limiter using Redis.
 * @param key - Unique identifier (e.g. `ratelimit:payment:${userId}`)
 * @param limit - Max requests allowed in the window
 * @param windowSeconds - Time window in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - windowMs);
    pipeline.zadd(key, now, `${now}:${randomUUID()}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) ?? 0;

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      reset: Math.ceil(windowSeconds - (now % (windowSeconds * 1000)) / 1000),
    };
  } catch {
    // If Redis is unavailable, degrade gracefully instead of blocking user actions.
    return {
      success: true,
      remaining: limit,
      reset: windowSeconds,
    };
  }
}
