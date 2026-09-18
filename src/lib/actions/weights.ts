"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { weightEntrySchema } from "@/lib/validation/weight";

export async function createWeightEntryAction(form: FormData) {
  const parsed = weightEntrySchema.safeParse({
    weightKg: form.get("weightKg"),
    measuredAt: form.get("measuredAt"),
    measurementType: form.get("measurementType"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "体重记录无效");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_weight_entry", {
    p_weight_kg: parsed.data.weightKg,
    p_measured_at: parsed.data.measuredAt,
    p_measurement_type: parsed.data.measurementType,
  });
  if (error) throw new Error("体重记录保存失败");
  revalidatePath("/weight");
}

export async function deleteWeightEntryAction(form: FormData) {
  const entryId = String(form.get("entryId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) throw new Error("记录编号无效");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("delete_weight_entry", { p_entry_id: entryId });
  if (error) throw new Error("删除失败");
  revalidatePath("/weight");
}
