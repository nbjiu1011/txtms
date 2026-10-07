import * as z from "zod/mini";

/**
 * Client-visible environment. `NEXT_PUBLIC_*` values are inlined at build time.
 * The API origin itself is server-only (`API_ORIGIN`, used by the `/api` rewrite in next.config.ts).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_PATH: z._default(z.string().check(z.regex(/^\/[^\s]*$/)), "/api"),
});

export const env = clientEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_PATH: process.env.NEXT_PUBLIC_API_BASE_PATH,
});

export type ClientEnv = typeof env;
