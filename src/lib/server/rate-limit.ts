/**
 * Simple in-memory rate limiter using sliding window.
 * For production, consider Redis-backed rate limiting.
 */

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < 3600_000);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}, 300_000);

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (e.g., IP address, IP+slug)
 * @param limit - Maximum allowed requests in the window
 * @param windowMs - Time window in milliseconds (default: 1 hour)
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number = 3600_000
): boolean {
    const now = Date.now();
    let entry = store.get(key);

    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= limit) {
        return false;
    }

    entry.timestamps.push(now);
    return true;
}

/**
 * Get remaining requests for a given key.
 */
export function getRemainingRequests(
    key: string,
    limit: number,
    windowMs: number = 3600_000
): number {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry) return limit;

    const validTimestamps = entry.timestamps.filter((t) => now - t < windowMs);
    return Math.max(0, limit - validTimestamps.length);
}
