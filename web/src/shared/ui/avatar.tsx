import type { CSSProperties } from "react";
import { cn } from "@/shared/lib";

export interface AvatarProps {
  name: string;
  /** Per-user color from the API (`avatarColor`). Falls back to the neutral avatar token. */
  color?: string | null;
  /** Diameter in px (prototype sizes: 20, 22, 24, 26, 32, 44). */
  size?: number;
  className?: string;
}

/** Shared by the avatar and the `+N` chip (`.av`). */
const AV_BASE = "rounded-[50%] grid place-items-center font-semibold flex-none";

/** Last two characters of the name, as in the reference. */
export function avatarInitials(name: string): string {
  const chars = Array.from(name || "?");
  return chars.slice(-2).join("");
}

/** `.av` — round avatar with the last two characters of the name. */
export function Avatar({ name, color, size = 26, className }: AvatarProps) {
  const style = {
    "--av-size": `${size}px`,
    ...(color ? { "--av-bg": color } : {}),
  } as CSSProperties;
  return (
    <span
      className={cn(
        AV_BASE,
        "size-[var(--av-size,26px)] text-(--on-avatar) bg-[var(--av-bg,var(--avatar-fallback))]",
        size < 24 ? "text-[10px]" : "text-[11px]",
        className,
      )}
      style={style}
      title={name}
    >
      {avatarInitials(name)}
    </span>
  );
}

export interface AvatarStackProps {
  people: { name: string; color?: string | null }[];
  /** Visible avatars before the `+N` chip. */
  max?: number;
  size?: number;
}

/** `.avs` — overlapping avatars (max 3 by default) and a `+N` chip. */
export function AvatarStack({ people, max = 3, size = 22 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center [&>span]:shadow-[0_0_0_2px_var(--surface)] [&>span+span]:-ml-[7px]">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 ? <span className={cn(AV_BASE, "size-[22px] text-[10px] bg-sunk text-sub")}>+{rest}</span> : null}
    </span>
  );
}
