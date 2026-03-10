import { create } from 'zustand';
import type { User } from '../api/types';
import { authApi } from '../api/endpoints';
import {
  setTokens as storeTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '../api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  loadFromStorage: () => Promise<void>;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  login: async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    storeTokens(response.accessToken, response.refreshToken);
    set({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isLoading: false,
    });
  },

  logout: () => {
    clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    storeTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken });
  },

  loadFromStorage: async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();

    if (!accessToken || accessToken === 'undefined' || accessToken === 'null') {
      clearTokens();
      set({ isLoading: false });
      return;
    }

    set({ accessToken, refreshToken });

    try {
      const user = await authApi.me();
      set({ user, isLoading: false });
    } catch {
      clearTokens();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
      });
    }
  },

  isAuthenticated: () => {
    const state = get();
    return state.user !== null && state.accessToken !== null;
  },
}));
