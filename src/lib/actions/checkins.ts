"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function completeOccurrenceAction(form:FormData){const id=String(form.get("occurrenceId")??"");if(!id)return;const {error}=await (await createClient()).rpc("complete_occurrence",{p_occurrence_id:id});if(error)throw new Error("打卡失败，请重试");revalidatePath("/");revalidatePath("/stats");}
export async function manualCheckinAction(form:FormData){const date=String(form.get("checkinDate")??"");if(!date)return;const {error}=await (await createClient()).rpc("create_manual_checkin",{p_checkin_date:date,p_is_backfilled:false});if(error)throw new Error("打卡失败，请重试");revalidatePath("/");revalidatePath("/stats");}
export async function undoCheckinAction(form:FormData){const id=String(form.get("checkinId")??"");if(!id)return;const {error}=await (await createClient()).rpc("undo_checkin",{p_checkin_id:id});if(error)throw new Error("撤销失败，请重试");revalidatePath("/");revalidatePath("/stats");}
