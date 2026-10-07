"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib";
import { IconButton } from "../button";
import { Icon } from "../icons/icons";
import { ESCAPE_PRIORITY, useEscapeLayer } from "./escape-stack";
import { useMounted } from "./use-mounted";
import styles from "./overlay.module.css";

export interface PopoverPosition {
  x: number;
  y: number;
}

/**
 * Same placement as the reference `openPop`: right edge aligned to the anchor's right edge,
 * clamped to 8px from the viewport, 6px below the anchor.
 */
export function computePopoverPosition(anchor: DOMRect, width: number, viewportWidth: number): PopoverPosition {
  return {
    x: Math.max(8, Math.min(viewportWidth - width - 8, anchor.right - width)),
    y: anchor.bottom + 6,
  };
}

export interface PopoverProps {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  /** Width used for placement and rendering (reference: 380 default, 320 add-tab, 300 persona). */
  width?: number;
  children: ReactNode;
  className?: string;
}

/** `.pop[role=dialog]` — fixed popover anchored under a trigger. Outside click and Escape close it. */
export function Popover({ open, anchor, onClose, label, width = 380, children, className }: PopoverProps) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useEscapeLayer(open, ESCAPE_PRIORITY.popover, onClose);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => setPosition(computePopoverPosition(anchor.getBoundingClientRect(), width, window.innerWidth));
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchor, width]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, anchor, onClose]);

  if (!open || !mounted || !position) return null;
  const style = {
    "--pop-x": `${position.x}px`,
    "--pop-y": `${position.y}px`,
    "--pop-w": `${width}px`,
  } as CSSProperties;

  return createPortal(
    <div ref={ref} className={cn(styles.pop, className)} role="dialog" aria-label={label} style={style}>
      {children}
    </div>,
    document.body,
  );
}

/** `.pop-h` — header row; a `<b>` child takes the remaining width. */
export function PopoverHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.popH, className)} {...rest} />;
}

/** `.pop-b` — scrollable body. */
export function PopoverBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.popB, className)} {...rest} />;
}

/** Small faint section label inside a popover body. */
export function PopoverSection({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.section, className)} {...rest} />;
}

/** `.vitem` — clickable popover row. */
export function PopoverItem({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(styles.vitem, className)} {...rest} />;
}

export interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** `.drawer[role=dialog]` — right side sheet (min(420px,100%)). Escape closes it. */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  const mounted = useMounted();
  useEscapeLayer(open, ESCAPE_PRIORITY.drawer, onClose);
  if (!open || !mounted) return null;
  return createPortal(
    <aside className={styles.drawer} role="dialog" aria-label={title}>
      <div className={styles.drawerH}>
        <h3>{title}</h3>
        <IconButton label="닫기" onClick={onClose}>
          <Icon name="x" />
        </IconButton>
      </div>
      <div className={styles.drawerB}>{children}</div>
    </aside>,
    document.body,
  );
}
