import { createStore } from "zustand/vanilla";

/**
 * Access token held in memory only (never persisted). Lost on reload by design:
 * the app calls `POST /api/auth/refresh` (httpOnly cookie) on start.
 */
interface AccessTokenState {
  token: string | null;
}

export const accessTokenStore = createStore<AccessTokenState>(() => ({ token: null }));

export function getAccessToken(): string | null {
  return accessTokenStore.getState().token;
}

export function setAccessToken(token: string | null): void {
  accessTokenStore.setState({ token });
}
