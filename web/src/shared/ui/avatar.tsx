import type { CSSProperties } from "react";
import { cn } from "@/shared/lib";
import styles from "./avatar.module.css";

export interface AvatarProps {
  name: string;
  /** Per-user color from the API (`avatarColor`). Falls back to the neutral avatar token. */
  color?: string | null;
  /** Diameter in px (prototype sizes: 20, 22, 24, 26, 32, 44). */
  size?: number;
  className?: string;
}

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
    <span className={cn(styles.av, size < 24 && styles.tiny, className)} style={style} title={name}>
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
    <span className={styles.stack}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 ? <span className={cn(styles.av, styles.more)}>+{rest}</span> : null}
    </span>
  );
}
