// Per-process first-line protection. Database limits still enforce request quotas across instances.
// Each address holds at most `limit` timestamps; rejected traffic allocates no additional entries.
export function createRateLimiter({ limit = 100, windowMs = 60_000, maxAddresses = 5000 } = {}) {
  const addresses = new Map<string, number[]>();
  return (address: string, now = Date.now()): { allowed: boolean; retryAfter: number } => {
    let recent = (addresses.get(address) ?? []).filter((time) => now - time < windowMs);
    if (!recent.length) addresses.delete(address);
    if (!addresses.has(address) && addresses.size >= maxAddresses) {
      for (const [key, times] of addresses) {
        if (now - times[times.length - 1]! >= windowMs) addresses.delete(key);
      }
      // Do not evict live buckets: rotating addresses would otherwise reset other callers' limits.
      if (addresses.size >= maxAddresses) return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
    }
    if (recent.length >= limit) {
      addresses.set(address, recent);
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((recent[0]! + windowMs - now) / 1000)) };
    }
    recent = [...recent, now];
    addresses.set(address, recent);
    return { allowed: true, retryAfter: 0 };
  };
}
