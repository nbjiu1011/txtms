import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface ErrorDetailsProps {
  /** Lead sentence (usually the server message). */
  message?: ReactNode;
  items: string[];
  className?: string;
}

/** Server `details` of a refused write (blocking requests, missing items) as a danger list (tinted like a danger banner). */
export function ErrorDetails({ message, items, className }: ErrorDetailsProps) {
  if (!message && items.length === 0) return null;
  return (
    <div
      role="alert"
      className={cn(
        "border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))]",
        "rounded-md py-2.5 px-3 text-[13px] mt-3",
        "[&_b]:block [&_b]:font-semibold [&_b]:text-danger [&_ul]:mt-1.5 [&_ul]:mb-0 [&_ul]:pl-[18px]",
        className,
      )}
    >
      {message ? <b>{message}</b> : null}
      {items.length ? (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
