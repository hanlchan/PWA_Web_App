import { notFound } from "next/navigation";
import { PlanForm } from "@/components/plans/plan-form";
import { deletePlanAction, updatePlanAction } from "@/lib/actions/plans";
import { getPlan } from "@/lib/queries/plans";

export default async function PlanPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const plan=await getPlan(id);if(!plan)notFound();return <main><h1 className="mb-6 text-2xl font-bold">编辑计划</h1><PlanForm action={updatePlanAction} initial={plan}/><form action={deletePlanAction} className="mt-4"><input type="hidden" name="planId" value={id}/><button className="w-full rounded-xl border border-rose-200 px-4 py-3 font-semibold text-rose-600">删除计划</button></form></main>;}
