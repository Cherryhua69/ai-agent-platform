import "@vitest/expect";
import "vitest";

type JestDomValue = string | number | string[];

type JestDomAssertions = {
  toBeInTheDocument(): void;
  toHaveAttribute(attribute: string, value?: string | RegExp): void;
  toHaveClass(...classNames: string[]): void;
  toHaveTextContent(text: string | RegExp): void;
  toHaveValue(value?: JestDomValue): void;
};

declare module "@vitest/expect" {
  interface Assertion<T = unknown> extends JestDomAssertions {}
  interface AsymmetricMatchersContaining extends JestDomAssertions {}
}

declare module "vitest" {
  interface Assertion<T = unknown> extends JestDomAssertions {}
  interface AsymmetricMatchersContaining extends JestDomAssertions {}
}
