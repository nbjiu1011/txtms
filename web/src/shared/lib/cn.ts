import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Project token names (`globals.css` `@theme`). tailwind-merge only knows Tailwind's default scale names,
 * so `rounded-btn` / `shadow-pop` would otherwise not be treated as conflicting with `rounded-md` / `shadow-lift`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["sm", "btn", "md", "banner", "lg", "pill"],
      shadow: ["pop", "lift"],
    },
  },
});

/**
 * Joins conditional class names and resolves Tailwind conflicts so the last one wins
 * (a caller's `className` overrides the component default, regardless of CSS output order).
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
