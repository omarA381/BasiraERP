/**
 * Custom React hooks.
 */

export function useNexterp() {
  // Bridge to the preload-exposed API
  if (typeof window !== 'undefined' && window.nexterp) {
    return window.nexterp;
  }
  return null;
}