import { createHash } from 'crypto'

// In-memory rate limiter with sliding window
// Can be extended to use Redis for distributed systems

interface RateLimitEntry {
  count: number
  windowStart: number
}

// Store for rate limiting - in production, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean old entries every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null

function startCleanup() {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart > 60000) { // 1 minute window expired
        rateLimitStore.delete(key)
      }
    }
  }, 300000) // 5 minutes
}

startCleanup()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  identifier: string // Unique identifier (user ID, IP, etc.)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number // Unix timestamp when limit resets
  limit: number
}

/**
 * Check if a request is allowed under rate limiting
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { windowMs, maxRequests, identifier } = config
  const now = Date.now()
  const key = createHash('md5').update(identifier).digest('hex')
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
      limit: maxRequests,
    }
  }
  
  // Within existing window
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.windowStart + windowMs,
      limit: maxRequests,
    }
  }
  
  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.windowStart + windowMs,
    limit: maxRequests,
  }
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMITS = {
  // 30 requests per minute for API endpoints
  api: {
    windowMs: 60000,
    maxRequests: 30,
  },
  // 10 requests per minute for AI chat (more expensive)
  chat: {
    windowMs: 60000,
    maxRequests: 10,
  },
  // 100 requests per minute for read-only endpoints
  readonly: {
    windowMs: 60000,
    maxRequests: 100,
  },
} as const

/**
 * Helper to format rate limit headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}
