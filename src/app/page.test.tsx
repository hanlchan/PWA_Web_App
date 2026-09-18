import Home from "./page";
import { describe, expect, it } from "vitest";

describe("Home", () => {
  it("redirects visitors to the login page", () => {
    try {
      Home();
    } catch (error) {
      expect(error).toMatchObject({ digest: "NEXT_REDIRECT;replace;/login;307;" });
      return;
    }

    throw new Error("Expected the home page to redirect to /login");
  });
});
