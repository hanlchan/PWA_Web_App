import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("test configuration", () => {
  it("discovers Playwright specs only from the browser test directory", () => {
    const config = readProjectFile("playwright.config.ts");

    expect(config).toContain('testDir: "./tests/e2e"');
    expect(config).toContain('testMatch: "**/*.spec.ts"');
  });

  it("excludes Playwright specs from Vitest discovery", () => {
    const config = readProjectFile("vitest.config.ts");

    expect(config).toContain('exclude: ["tests/e2e/**"]');
  });

  it("registers explicit Testing Library cleanup", () => {
    const setup = readProjectFile("src/test/setup.ts");

    expect(setup).toContain("afterEach(cleanup)");
  });
});
