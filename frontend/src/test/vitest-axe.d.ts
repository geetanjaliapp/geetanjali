import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
