import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import styles from "./layout.module.css";

export interface BrandMarkProps {
  /** Brand-on-navy variant used on the login hero. */
  inverse?: boolean;
  className?: string;
}

/** `.brand-mark` — "TX" tile with the brand underline. */
export function BrandMark({ inverse, className }: BrandMarkProps) {
  return (
    <span className={cn(styles.brandMark, inverse && styles.inverse, className)} aria-hidden="true">
      TX
    </span>
  );
}

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  /** No max-width (`.page.wide`). */
  wide?: boolean;
}

/** `.page` — screen content container (30/36/72 padding, max 1440). */
export function Page({ wide, className, ...rest }: PageProps) {
  return <div className={cn(styles.page, wide && styles.wide, className)} {...rest} />;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Breadcrumb or eyebrow above the title. */
  eyebrow?: ReactNode;
  /** Render the eyebrow as given (no `.crumb` wrapper), e.g. the dashboard date. */
  rawEyebrow?: boolean;
  actions?: ReactNode;
  className?: string;
}

/** `.ph` — page title row with right aligned actions. */
export function PageHeader({ title, description, eyebrow, rawEyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn(styles.ph, className)}>
      <div>
        {eyebrow && rawEyebrow ? eyebrow : null}
        {eyebrow && !rawEyebrow ? <div className={styles.crumb}>{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.acts}>{actions}</div> : null}
    </div>
  );
}
