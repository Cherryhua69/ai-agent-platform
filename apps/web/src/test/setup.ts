import * as matchers from "@testing-library/jest-dom/matchers";
import type {} from "@testing-library/jest-dom/vitest";
import { expect } from "vitest";

expect.extend(matchers);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("no-preference"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })
});

class ResizeObserverMock {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            x: 0,
            y: 0,
            width: 920,
            height: 520,
            top: 0,
            right: 920,
            bottom: 520,
            left: 0,
            toJSON: () => ({})
          }
        } as ResizeObserverEntry
      ],
      this
    );
  }

  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock
});

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock
});

class DOMMatrixReadOnlyMock {
  m22 = 1;
}

Object.defineProperty(window, "DOMMatrixReadOnly", {
  writable: true,
  value: DOMMatrixReadOnlyMock
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  value: 920
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  value: 520
});

HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    x: 0,
    y: 0,
    width: 920,
    height: 520,
    top: 0,
    right: 920,
    bottom: 520,
    left: 0,
    toJSON: () => ({})
  };
};
