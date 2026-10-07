"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBlob } from "@/shared/api";
import { requestKeys } from "../api/request-queries";
import { requestBinaryPaths } from "../api/request-mutations";

export interface RequestImageProps {
  requestId: string;
  imageKey: string;
  alt: string;
  /** Rendered while loading or when the image cannot be read. */
  fallback?: ReactNode;
}

/**
 * RCS card image (`GET /api/requests/{id}/images/{key}`). The endpoint needs the bearer token, so the
 * bytes are fetched as a blob and shown through an object URL that is revoked with the element.
 */
export function RequestImage({ requestId, imageKey, alt, fallback = null }: RequestImageProps) {
  const image = useQuery({
    queryKey: requestKeys.image(requestId, imageKey),
    queryFn: ({ signal }) => getBlob(requestBinaryPaths.image(requestId, imageKey), { signal }),
    staleTime: Infinity,
    retry: false,
  });
  const blob = image.data;
  if (!blob) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not optimisable
    <img
      alt={alt}
      ref={(img) => {
        if (!img) return;
        const url = URL.createObjectURL(blob);
        img.src = url;
        return () => URL.revokeObjectURL(url);
      }}
    />
  );
}
