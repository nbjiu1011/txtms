import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface BrandMarkProps {
  /** Brand-on-navy variant used on the login hero. */
  inverse?: boolean;
  className?: string;
}

/** `.brand-mark` — "TX" tile with the brand underline. */
export function BrandMark({ inverse, className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "size-7.5 rounded-md grid place-items-center font-bold text-[12px] tracking-[-0.02em] relative overflow-hidden flex-none",
        "after:content-[''] after:absolute after:left-[5px] after:right-[5px] after:bottom-1.5 after:h-[3px] after:rounded-(--r-2) after:opacity-90",
        inverse ? "bg-brand text-navy after:bg-navy" : "bg-navy text-brand after:bg-brand",
        className,
      )}
      aria-hidden="true"
    >
      TX
    </span>
  );
}

export type PageProps = HTMLAttributes<HTMLDivElement>;

/** `.page` — screen content container (30/36/72 padding), always the full width of the work area. */
export function Page({ className, ...rest }: PageProps) {
  return <div className={cn("pt-7.5 px-9 pb-18 upto-nav:pt-5 upto-nav:px-4 upto-nav:pb-12", className)} {...rest} />;
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
    <div
      className={cn(
        "flex items-start gap-4 mb-[22px] flex-wrap",
        "[&_h1]:text-[24px] [&_h1]:leading-[1.3] [&_h1]:m-0 [&_h1]:font-semibold [&_h1]:tracking-[-0.02em]",
        "[&_p]:mt-1 [&_p]:mx-0 [&_p]:mb-0 [&_p]:text-sub",
        className,
      )}
    >
      <div>
        {eyebrow && rawEyebrow ? eyebrow : null}
        {eyebrow && !rawEyebrow ? (
          <div className="text-[13px] text-faint mb-1.5 [&_a]:no-underline [&_a:hover]:underline">{eyebrow}</div>
        ) : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}
