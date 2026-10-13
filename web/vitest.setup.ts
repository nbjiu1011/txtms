import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lacks the pointer-capture and scrolling APIs radix calls when a Select opens or an item gains focus.
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}

afterEach(() => {
  cleanup();
});
