import { PlanForm } from "@/components/plans/plan-form";
import { createPlanAction } from "@/lib/actions/plans";
import { isValidIsoDate } from "@/lib/calendar/date";

export default async function NewPlanPage({searchParams}:{searchParams:Promise<{date?:string}>}){const {date}=await searchParams;const startDate=date&&isValidIsoDate(date)?date:undefined;return <main><h1 className="mb-6 text-2xl font-bold">创建运动计划</h1><PlanForm action={createPlanAction} initial={{start_date:startDate}}/></main>;}
