"use client";

import { useEffect, useRef, useLayoutEffect } from "react";

/**
 * Escape closes exactly one layer per key press (highest priority, then latest opened, wins).
 * radix overlays (modal, popover, drawer, select) handle Escape themselves in the capture phase and
 * cancel the event, so a layer registered here (the mobile navigation) only closes when no radix
 * overlay is open above it.
 */
export const ESCAPE_PRIORITY = {
  nav: 0,
  drawer: 1,
  popover: 2,
  modal: 3,
} as const;

interface Layer {
  id: number;
  priority: number;
  onEscape: () => void;
}

const layers: Layer[] = [];
let nextId = 1;
let installed = false;

function topLayer(): Layer | undefined {
  let top: Layer | undefined;
  for (const layer of layers) {
    if (!top || layer.priority > top.priority || (layer.priority === top.priority && layer.id > top.id)) {
      top = layer;
    }
  }
  return top;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const top = topLayer();
  if (!top) return;
  event.preventDefault();
  top.onEscape();
}

function install() {
  if (installed || typeof document === "undefined") return;
  document.addEventListener("keydown", onKeyDown);
  installed = true;
}

/** Registers an Escape handler while `active`. */
export function useEscapeLayer(active: boolean, priority: number, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useLayoutEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    install();
    const layer: Layer = { id: nextId++, priority, onEscape: () => handlerRef.current() };
    layers.push(layer);
    return () => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
    };
  }, [active, priority]);
}
