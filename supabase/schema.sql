-- SAT-R&R schema for Supabase (PostgreSQL)
-- Run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'engineer' check (role in ('admin','engineer','viewer')),
  organization text,
  created_at timestamptz not null default now()
);

create table if not exists public.sat_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project text not null,
  customer text,
  machine text not null,
  harness text,
  sat_type text not null default 'SAT',
  sat_version text not null default '1.0',
  engineer text,
  target integer not null default 0 check (target >= 0),
  planned_minutes numeric,
  required_rate numeric,
  min_availability numeric check (min_availability is null or min_availability between 0 and 100),
  min_quality numeric check (min_quality is null or min_quality between 0 and 100),
  good integer not null default 0 check (good >= 0),
  failed integer not null default 0 check (failed >= 0),
  notes text,
  status text not null default 'draft' check (status in ('draft','in_progress','completed')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sat_downtime_events (
  id uuid primary key default gen_random_uuid(),
  sat_id uuid not null references public.sat_runs(id) on delete cascade,
  station text not null,
  category text not null default 'Process',
  reason text not null,
  responsibility text not null default 'TBD' check (responsibility in ('LEONI','Supplier','TBD')),
  affects_machine boolean not null default true,
  started_at timestamptz not null,
  ended_at timestamptz,
  responsible text,
  corrective_action text,
  owner text,
  action_status text not null default 'Open' check (action_status in ('Open','In progress','Completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.sat_actions (
  id uuid primary key default gen_random_uuid(),
  sat_id uuid not null references public.sat_runs(id) on delete cascade,
  title text not null,
  description text,
  owner text,
  due_date date,
  status text not null default 'Open' check (status in ('Open','In progress','Completed')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  created_at timestamptz not null default now()
);

create index if not exists sat_runs_user_created_idx on public.sat_runs(user_id, created_at desc);
create index if not exists sat_events_sat_idx on public.sat_downtime_events(sat_id);
create index if not exists sat_actions_sat_idx on public.sat_actions(sat_id);

-- Automatically create a profile for each new authenticated user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.sat_runs enable row level security;
alter table public.sat_downtime_events enable row level security;
alter table public.sat_actions enable row level security;

-- User can read/update own profile. Admin profile management is intentionally
-- not self-grantable; assign role='admin' manually in the Supabase dashboard.
create policy "profile read own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profile update own" on public.profiles;
-- Profile role is not user-editable; role changes are performed by a trusted admin in Supabase.

-- SAT rows are private to their creator. This is a safe default for first deployment.
create policy "sat select own" on public.sat_runs for select to authenticated using (user_id = auth.uid());
create policy "sat insert own" on public.sat_runs for insert to authenticated with check (user_id = auth.uid());
create policy "sat update own" on public.sat_runs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sat delete own" on public.sat_runs for delete to authenticated using (user_id = auth.uid());

-- Child rows inherit access through the owning SAT record.
create policy "events select own sat" on public.sat_downtime_events for select to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "events insert own sat" on public.sat_downtime_events for insert to authenticated
with check (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "events update own sat" on public.sat_downtime_events for update to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()))
with check (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "events delete own sat" on public.sat_downtime_events for delete to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));

create policy "actions select own sat" on public.sat_actions for select to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "actions insert own sat" on public.sat_actions for insert to authenticated
with check (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "actions update own sat" on public.sat_actions for update to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()))
with check (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));
create policy "actions delete own sat" on public.sat_actions for delete to authenticated
using (exists(select 1 from public.sat_runs r where r.id=sat_id and r.user_id=auth.uid()));

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant select, insert, update, delete on public.sat_runs to authenticated;
grant select, insert, update, delete on public.sat_downtime_events to authenticated;
grant select, insert, update, delete on public.sat_actions to authenticated;
