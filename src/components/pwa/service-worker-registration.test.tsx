import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "./service-worker-registration";

describe("ServiceWorkerRegistration", () => {
  const readyStateDescriptor = Object.getOwnPropertyDescriptor(document, "readyState");
  const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  afterEach(() => {
    vi.unstubAllEnvs();
    if (readyStateDescriptor) Object.defineProperty(document, "readyState", readyStateDescriptor);
    if (serviceWorkerDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });

  it("registers immediately when hydration starts after the load event", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
  });
});
