import { PlanForm } from "@/components/plans/plan-form";
import { createPlanAction } from "@/lib/actions/plans";
export default function NewPlanPage(){return <main><h1 className="mb-6 text-2xl font-bold">创建运动计划</h1><PlanForm action={createPlanAction}/></main>;}
