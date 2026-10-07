"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/shared/api";
import { Toaster } from "@/shared/ui";
import { useSessionBootstrap } from "@/features/auth";

function SessionBootstrap() {
  useSessionBootstrap();
  return null;
}

/** Client providers: TanStack Query, session bootstrap (token refresh) and the toast outlet. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
