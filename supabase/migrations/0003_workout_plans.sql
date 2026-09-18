create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(100) not null check (char_length(btrim(title)) between 1 and 100),
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  recurrence_type public.recurrence_type not null,
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  days_of_week smallint[],
  days_of_month smallint[],
  start_time time,
  reminder_enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_plans_recurrence_payload check (
    (recurrence_type = 'one_time' and days_of_week is null and days_of_month is null) or
    (recurrence_type = 'weekly' and cardinality(days_of_week) > 0 and days_of_month is null) or
    (recurrence_type = 'monthly' and cardinality(days_of_month) > 0 and days_of_week is null) or
    (recurrence_type = 'custom_dates' and days_of_week is null and days_of_month is null)
  ),
  constraint workout_plans_weekdays check (
    days_of_week is null or days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint workout_plans_monthdays check (
    days_of_month is null or days_of_month <@ array[
      1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
    ]::smallint[]
  )
);

create table public.plan_custom_dates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  scheduled_date date not null,
  unique (plan_id, scheduled_date)
);

create table public.plan_occurrences (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  notification_at timestamptz,
  reminder_sent_at timestamptz,
  status public.occurrence_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint plan_occurrences_plan_date_key unique (plan_id, scheduled_date)
);

create index plan_occurrences_user_date_idx on public.plan_occurrences(user_id, scheduled_date);
create index plan_occurrences_notification_due_idx on public.plan_occurrences(notification_at)
where notification_at is not null and reminder_sent_at is null and status = 'pending';

create trigger workout_plans_set_updated_at before update on public.workout_plans
for each row execute function public.set_updated_at();

alter table public.workout_plans enable row level security;
alter table public.plan_custom_dates enable row level security;
alter table public.plan_occurrences enable row level security;

create policy workout_plans_owner_all on public.workout_plans for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plan_custom_dates_owner_all on public.plan_custom_dates for all to authenticated
using (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()))
with check (exists(select 1 from public.workout_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy plan_occurrences_owner_all on public.plan_occurrences for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
