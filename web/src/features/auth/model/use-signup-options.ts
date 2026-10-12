import { useQuery } from "@tanstack/react-query";
import { isApiError, queryKeys } from "@/shared/api";
import type { SignupOptions } from "@/entities/me";
import { authApi } from "../api/auth-api";

export const signupOptionKeys = { list: () => queryKeys.list("signup-options", {}) };

/**
 * Temporary sign-up options (`GET /api/auth/signup-options`). `null` when sign-up is closed: the API answers 404
 * outside demo mode, so the page and the login link only exist on the development server.
 */
export function useSignupOptions() {
  return useQuery<SignupOptions | null>({
    queryKey: signupOptionKeys.list(),
    queryFn: async () => {
      try {
        return await authApi.signupOptions();
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}
