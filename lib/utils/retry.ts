/**
 * Retry utility with exponential backoff for external API calls
 */

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = mergedConfig
  
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )
      
      // Add jitter (±10%)
      const jitter = delay * 0.1 * (Math.random() * 2 - 1)
      
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay + jitter)}ms:`, lastError.message)
      await sleep(delay + jitter)
    }
  }
  
  throw lastError
}

/**
 * Fetch with timeout and retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options
  
  return withRetry(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })
      
      // Check if response should trigger a retry
      if (!response.ok) {
        const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
        if (config.retryableStatusCodes.includes(response.status)) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      }
      
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }, retryConfig)
}

/**
 * Error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message)
    this.name = 'TimeoutError'
  }
}
