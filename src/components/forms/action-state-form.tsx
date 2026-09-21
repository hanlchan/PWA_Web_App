"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionResult } from "@/lib/actions/result";

type ServerFormAction = (formData: FormData) => Promise<ActionResult>;

const initialState: ActionResult = { ok: true, data: undefined };

export function ActionStateForm({
  action,
  children,
  className,
}: {
  action: ServerFormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (_previous: ActionResult, formData: FormData) => action(formData),
    initialState,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {!state.ok && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function PendingSubmitButton({
  idleLabel,
  pendingLabel = "处理中…",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  idleLabel?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : (idleLabel ?? children)}
    </button>
  );
}
