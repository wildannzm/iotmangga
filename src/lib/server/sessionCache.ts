// ponytail: in-memory session cache, 30s TTL. Upgrade: Redis if multi-instance.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { user: { id: string; username: string; name: string | null }; expiresAt: number }>();

export function getSession(sessionId: string) {
  const entry = cache.get(sessionId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(sessionId);
    return null;
  }
  return entry.user;
}

export function setSession(sessionId: string, user: { id: string; username: string; name: string | null }, expiresAt: number) {
  cache.set(sessionId, { user, expiresAt });
}

export function deleteSession(sessionId: string) {
  cache.delete(sessionId);
}
