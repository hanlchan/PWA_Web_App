"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SocialSubmitButton({ children, className }: { children: ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`${className} disabled:opacity-50`}>{pending ? "处理中…" : children}</button>;
}
