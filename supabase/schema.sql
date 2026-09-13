-- ============================================================================
-- Foolscap schema
--
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is idempotent, so running it twice is safe.
--
-- Auth itself needs no tables: Supabase Auth owns auth.users. This file adds
-- the one table the app writes to, plus the row level security that makes a
-- student's history readable only by that student.
-- ============================================================================

create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  topic_title   text not null,
  subject       text default '',
  right_count   integer not null check (right_count >= 0),
  total_count   integer not null check (total_count > 0),
  -- { "<section heading>": { "right": 2, "total": 3 }, ... }
  section_stats jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  constraint attempts_score_sane check (right_count <= total_count)
);

-- The three reads the app actually makes: newest first, by user, by topic.
create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

create index if not exists attempts_user_topic_idx
  on public.attempts (user_id, topic_title, created_at desc);

-- ----------------------------------------------------------------------------
-- Row level security. Without this, the anon key would read every row.
-- ----------------------------------------------------------------------------

alter table public.attempts enable row level security;

drop policy if exists "read own attempts" on public.attempts;
create policy "read own attempts"
  on public.attempts for select
  using (auth.uid() = user_id);

drop policy if exists "insert own attempts" on public.attempts;
create policy "insert own attempts"
  on public.attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own attempts" on public.attempts;
create policy "delete own attempts"
  on public.attempts for delete
  using (auth.uid() = user_id);

-- Attempts are an append-only record of what happened. Nobody edits history,
-- so there is deliberately no update policy.

-- ----------------------------------------------------------------------------
-- Data API privileges.
--
-- Projects created with "Automatically expose new tables" switched on already
-- grant these. Stating them here means the schema also works on a project with
-- that switch off, instead of failing with an opaque permission error.
--
-- Only `authenticated` is granted: every policy above tests auth.uid(), so an
-- anonymous caller has no reason to reach the table at all.
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, delete on public.attempts to authenticated;

-- Projects created with "Automatically expose new tables" on also grant `anon`.
-- Row level security already blocks it, because every policy tests auth.uid()
-- and an unauthenticated caller has none. Revoking anyway means the table is
-- closed at two layers instead of one, so a future policy written carelessly
-- cannot accidentally open it to the public.
revoke all on public.attempts from anon;

-- ============================================================================
-- Saved sheets.
--
-- attempts records how a quiz went. This records what was generated, so the
-- dashboard can list a student's past revision sheets and reopen one instead
-- of paying Gemini to rebuild it.
-- ============================================================================

create table if not exists public.sheets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  subject    text default '',
  depth      text not null default 'quick',
  -- The whole RevisionSheet, exactly as the app renders it.
  sheet      jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sheets_user_created_idx
  on public.sheets (user_id, created_at desc);

alter table public.sheets enable row level security;

drop policy if exists "read own sheets" on public.sheets;
create policy "read own sheets"
  on public.sheets for select
  using (auth.uid() = user_id);

drop policy if exists "insert own sheets" on public.sheets;
create policy "insert own sheets"
  on public.sheets for insert
  with check (auth.uid() = user_id);

drop policy if exists "delete own sheets" on public.sheets;
create policy "delete own sheets"
  on public.sheets for delete
  using (auth.uid() = user_id);

grant select, insert, delete on public.sheets to authenticated;
revoke all on public.sheets from anon;

-- ============================================================================
-- Optional: a demo account with seeded history.
--
-- Create the user first in Dashboard > Authentication > Users > Add user:
--   email:    demo@foolscap.app
--   password: something you choose
--   confirm the email so it can sign in without a mailbox
--
-- Then run the block below. It fills ten weeks of plausible revision activity
-- so the heatmap, the topic tracker and the comparison all have something to
-- show on a fresh machine. This is clearly demo data, not real student data.
-- ============================================================================

do $$
declare
  demo_id uuid;
  topics text[] := array[
    'Deadlock: conditions, handling, and the banker''s algorithm',
    'CPU scheduling: turnaround, waiting time and starvation',
    'Paging, segmentation and the translation lookaside buffer',
    'Process synchronisation and the critical section problem'
  ];
  subjects text[] := array['Operating Systems','Operating Systems','Operating Systems','Operating Systems'];
  i int;
  n int;
  day_offset int;
  score int;
begin
  select id into demo_id from auth.users where email = 'demo@foolscap.app';

  if demo_id is null then
    raise notice 'No demo@foolscap.app user found. Create it in the Auth dashboard first, then rerun this block.';
    return;
  end if;

  delete from public.attempts where user_id = demo_id;

  for i in 1..array_length(topics, 1) loop
    -- Three attempts per topic, spread out, generally improving.
    for n in 0..2 loop
      day_offset := 62 - (i * 9) - (n * 3);
      score := least(5, 2 + n + (i % 2));

      insert into public.attempts
        (user_id, topic_title, subject, right_count, total_count, section_stats, created_at)
      values (
        demo_id,
        topics[i],
        subjects[i],
        score,
        5,
        jsonb_build_object(
          'Core definitions',   jsonb_build_object('right', least(2, score), 'total', 2),
          'Worked procedure',   jsonb_build_object('right', greatest(0, score - 2), 'total', 2),
          'Common confusions',  jsonb_build_object('right', case when score >= 4 then 1 else 0 end, 'total', 1)
        ),
        now() - make_interval(days => day_offset)
      );
    end loop;
  end loop;

  raise notice 'Seeded demo history for %', demo_id;
end $$;
