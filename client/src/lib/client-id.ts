/**
 * Persistent client identifier for this browser tab session.
 * Used to filter out SSE events triggered by this client's own mutations.
 */
function generateClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

export const CLIENT_ID = generateClientId();
