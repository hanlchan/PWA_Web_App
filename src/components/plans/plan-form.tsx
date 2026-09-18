"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions/result";

type InitialPlan = { id?: string; title?: string; description?: string | null; duration_minutes?: number | null; recurrence_type?: string; start_date?: string; end_date?: string | null; days_of_week?: number[] | null; days_of_month?: number[] | null; start_time?: string | null; reminder_enabled?: boolean; notes?: string | null; custom_dates?: string[] };
type Props = { action: (state: ActionResult, form: FormData) => Promise<ActionResult>; initial?: InitialPlan };
const empty: ActionResult = { ok: false, message: "" };
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

export function PlanForm({ action, initial = {} }: Props) {
  const [state, formAction, pending] = useActionState(action, empty);
  const [recurrence, setRecurrence] = useState(initial.recurrence_type ?? "one_time");
  const [dates, setDates] = useState(initial.custom_dates ?? []);
  const [newDate, setNewDate] = useState("");
  return <form action={formAction} className="space-y-5">
    {initial.id && <input type="hidden" name="planId" value={initial.id}/>} 
    <label className="block text-sm font-medium">计划名称 *<input name="title" required maxLength={100} defaultValue={initial.title} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" placeholder="例如：20分钟跟跳"/></label>
    <label className="block text-sm font-medium">运动内容（可选）<textarea name="description" maxLength={2000} defaultValue={initial.description ?? ""} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/></label>
    <label className="block text-sm font-medium">重复方式<select name="recurrenceType" value={recurrence} onChange={e=>setRecurrence(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="one_time">单次</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="custom_dates">自定义日期</option></select></label>
    {recurrence === "weekly" && <fieldset><legend className="text-sm font-medium">星期</legend><div className="mt-2 grid grid-cols-7 gap-1">{weekdays.map((day,index)=><label key={day} className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm"><input className="sr-only peer" type="checkbox" name="daysOfWeek" value={index+1} defaultChecked={initial.days_of_week?.includes(index+1)}/><span className="peer-checked:font-bold peer-checked:text-emerald-600">{day}</span></label>)}</div></fieldset>}
    {recurrence === "monthly" && <fieldset><legend className="text-sm font-medium">每月日期</legend><div className="mt-2 grid grid-cols-7 gap-1">{Array.from({length:31},(_,i)=>i+1).map(day=><label key={day} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs"><input className="sr-only peer" type="checkbox" name="daysOfMonth" value={day} defaultChecked={initial.days_of_month?.includes(day)}/><span className="peer-checked:font-bold peer-checked:text-emerald-600">{day}</span></label>)}</div></fieldset>}
    {recurrence === "custom_dates" && <div><span className="text-sm font-medium">自定义日期</span><div className="mt-2 flex gap-2"><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3"/><button type="button" onClick={()=>{if(newDate&&!dates.includes(newDate)){setDates([...dates,newDate].sort());setNewDate("");}}} className="rounded-xl border border-emerald-500 px-4 text-emerald-700">添加</button></div><input type="hidden" name="customDates" value={dates.join(",")}/><div className="mt-2 flex flex-wrap gap-2">{dates.map(date=><button type="button" key={date} onClick={()=>setDates(dates.filter(item=>item!==date))} className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">{date} ×</button>)}</div></div>}
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">开始日期<input name="startDate" type="date" required defaultValue={initial.start_date ?? new Date().toISOString().slice(0,10)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label><label className="text-sm font-medium">结束日期（可选）<input name="endDate" type="date" defaultValue={initial.end_date ?? ""} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label></div>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">开始时间（可选）<input name="startTime" type="time" defaultValue={initial.start_time?.slice(0,5) ?? ""} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label><label className="text-sm font-medium">预计分钟（可选）<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={initial.duration_minutes ?? ""} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3"/></label></div>
    <label className="flex items-center justify-between rounded-xl bg-white p-4"><span className="text-sm font-medium">运动提醒</span><input name="reminderEnabled" type="checkbox" defaultChecked={initial.reminder_enabled ?? true} className="size-5 accent-emerald-500"/></label>
    <label className="block text-sm font-medium">备注（可选）<textarea name="notes" maxLength={2000} defaultValue={initial.notes ?? ""} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/></label>
    {!state.ok && state.message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-slate-900 px-4 py-4 font-bold text-white disabled:opacity-60">{pending ? "保存中…" : "保存计划"}</button>
  </form>;
}
