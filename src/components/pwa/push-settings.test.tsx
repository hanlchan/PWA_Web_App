import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/push", () => ({
  savePushSubscriptionAction: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  removePushSubscriptionAction: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { savePushSubscriptionAction } from "@/lib/actions/push";
import { PushSettings } from "./push-settings";

describe("PushSettings", () => {
  const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (serviceWorkerDescriptor) Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
    else Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("reuses an existing subscription and registers it for the current user", async () => {
    const subscription = {
      endpoint: "https://push.example.test/subscription",
      getKey: (name: string) => Uint8Array.from(name === "auth" ? [1, 2, 3] : [4, 5, 6]).buffer,
    };
    const subscribe = vi.fn();
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe } };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicKey: "AQ" }) }));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    render(<PushSettings />);

    fireEvent.click(await screen.findByRole("button", { name: "重新登记当前设备" }));
    await waitFor(() => expect(savePushSubscriptionAction).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: subscription.endpoint,
      p256dh: "BAUG",
      auth: "AQID",
    })));
    expect(subscribe).not.toHaveBeenCalled();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("运动提醒已开启");
  });

  it("creates a subscription only after a click on the new Origin", async () => {
    const subscription = {
      endpoint: "https://push.example.test/new-origin",
      getKey: (name: string) => Uint8Array.from(name === "auth" ? [1, 2, 3] : [4, 5, 6]).buffer,
    };
    const subscribe = vi.fn().mockResolvedValue(subscription);
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration) },
    });
    vi.stubGlobal("PushManager", class {});
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicKey: "AQ" }) }));
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    render(<PushSettings />);

    expect(requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "开启运动提醒" }));
    await waitFor(() => expect(savePushSubscriptionAction).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: subscription.endpoint,
    })));
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
  });
});
