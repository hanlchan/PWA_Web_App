"use client";

import { useEffect } from "react";

import { clearSessionAction, syncSessionAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/cloudbase/client";

export function AuthSessionSync() {
  useEffect(() => {
    const auth = createClient().auth;
    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        void clearSessionAction();
        return;
      }
      if (!session?.access_token || !session.refresh_token || !session.expires_in) return;
      void syncSessionAction({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
