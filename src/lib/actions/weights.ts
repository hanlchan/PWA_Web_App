"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { weightEntrySchema } from "@/lib/validation/weight";
import type { ActionResult } from "./result";

export async function createWeightEntryAction(form: FormData): Promise<ActionResult> {
  const parsed = weightEntrySchema.safeParse({
    weightKg: form.get("weightKg"),
    measuredAt: form.get("measuredAt"),
    measurementType: form.get("measurementType"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "体重记录无效" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_weight_entry", {
    p_weight_kg: parsed.data.weightKg,
    p_measured_at: parsed.data.measuredAt,
    p_measurement_type: parsed.data.measurementType,
  });
  if (error) return { ok: false, message: "体重记录保存失败" };
  revalidatePath("/weight");
  return { ok: true, data: undefined };
}

export async function deleteWeightEntryAction(form: FormData): Promise<ActionResult> {
  const entryId = String(form.get("entryId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return { ok: false, message: "记录编号无效" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("delete_weight_entry", { p_entry_id: entryId });
  if (error) return { ok: false, message: "删除失败" };
  revalidatePath("/weight");
  return { ok: true, data: undefined };
}
