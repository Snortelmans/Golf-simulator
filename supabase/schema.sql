-- Eigen Baan: tabellen voor online delen (week 4).
--
-- Plak dit in de SQL-editor van je Supabase-project (supabase.com > project > SQL Editor > New query > Run).
-- Twee tabellen: gepubliceerde banen en gespeelde scores. Iedereen mag lezen en toevoegen
-- (geen accounts, alleen een bijnaam), niemand mag via de app wijzigen of wissen.
-- Dat is genoeg voor een demo. Voor een echte club komen hier accounts bij.

create extension if not exists "pgcrypto";

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  author text not null default 'anoniem' check (char_length(author) <= 40),
  theme text not null default 'classic',
  holes int not null check (holes between 1 and 18),
  par int not null,
  data jsonb not null,
  plays int not null default 0
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  course_id uuid not null references public.courses(id) on delete cascade,
  player text not null default 'anoniem' check (char_length(player) <= 40),
  strokes int not null check (strokes between 1 and 400),
  par int not null,
  season text,
  source text
);

create index if not exists scores_course_idx on public.scores (course_id, strokes);

alter table public.courses enable row level security;
alter table public.scores enable row level security;

drop policy if exists "iedereen mag banen lezen" on public.courses;
create policy "iedereen mag banen lezen" on public.courses for select using (true);
drop policy if exists "iedereen mag banen publiceren" on public.courses;
create policy "iedereen mag banen publiceren" on public.courses for insert with check (true);

drop policy if exists "iedereen mag scores lezen" on public.scores;
create policy "iedereen mag scores lezen" on public.scores for select using (true);
drop policy if exists "iedereen mag scores melden" on public.scores;
create policy "iedereen mag scores melden" on public.scores for insert with check (true);

-- Teller 'plays' ophogen zonder update-rechten voor iedereen.
create or replace function public.count_play(course uuid)
returns void language sql security definer as $$
  update public.courses set plays = plays + 1 where id = course;
$$;
