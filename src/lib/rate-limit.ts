/**
 * Rate limiter with Upstash Redis backend.
 * Falls back to in-memory Map when UPSTASH_REDIS_REST_URL is not set.
 *
 * Set these env vars for production:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ── Upstash Redis setup ──────────────────────────────────────────────
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = useRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined

// Cache of Ratelimit instances per "limit:window" key
const limiters = new Map<string, Ratelimit>()

function getUpstashLimiter(limit: number, windowSeconds: number): Ratelimit {
  const key = `${limit}:${windowSeconds}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: false,
      prefix: 'rl',
    })
    limiters.set(key, limiter)
  }
  return limiter
}

// ── In-memory fallback (dev / missing env) ───────────────────────────
interface RateLimitEntry {
  count: number
  resetAt: number
}

const memStore = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now()
    for (const [k, v] of memStore) {
      if (v.resetAt < now) memStore.delete(k)
    }
  }
  // Only in Node runtime (not Edge)
  try { setInterval(cleanup, 5 * 60 * 1000) } catch { /* edge runtime */ }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  let entry = memStore.get(key)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs }
    memStore.set(key, entry)
  }
  entry.count++

  if (entry.count > limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

// ── Public API ───────────────────────────────────────────────────────
interface RateLimitOptions {
  /** Max requests per window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given key (IP, user ID, etc.)
 * Uses Upstash Redis if configured, otherwise in-memory fallback.
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (useRedis) {
    const limiter = getUpstashLimiter(options.limit, options.windowSeconds)
    const { success, remaining, reset } = await limiter.limit(key)
    return { success, remaining, resetAt: reset }
  }

  // Fallback to in-memory
  return checkMemoryRateLimit(key, options.limit, options.windowSeconds)
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
