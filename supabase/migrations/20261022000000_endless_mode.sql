-- Endless mode: random questions, 3 lives (a timeout costs one). See docs/KONZEPT.md §2.

create table endless_runs (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null,
  locale      text not null check (locale in ('de', 'en')),
  lives       smallint not null default 3 check (lives >= 0),
  score       int not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index endless_runs_player_idx on endless_runs (player_id, started_at desc);

create table endless_questions (
  run_id       uuid not null references endless_runs (id) on delete cascade,
  seq          smallint not null check (seq >= 1),
  question_id  text not null references questions (id),
  started_at   timestamptz not null default now(),
  penalty_s    smallint not null default 0,
  answered_at  timestamptz,                  -- set on a valid answer or timeout
  entity_id    text references entities (id),
  points       smallint,
  primary key (run_id, seq),
  unique (run_id, question_id)
);
-- All-time answer counts per question drive the endless scoring.
create index endless_questions_answers_idx on endless_questions (question_id, entity_id) where entity_id is not null;

create table endless_guesses (
  id          bigint generated always as identity primary key,
  run_id      uuid not null references endless_runs (id) on delete cascade,
  seq         smallint not null,
  raw_input   text not null check (char_length(raw_input) <= 100),
  normalized  text not null,
  entity_id   text references entities (id),
  result      text not null check (result in ('valid', 'wrong_entity', 'unknown', 'duplicate_wrong')),
  points      smallint,
  created_at  timestamptz not null default now()
);
create index endless_guesses_run_idx on endless_guesses (run_id, seq);
create index endless_guesses_unknown_idx on endless_guesses (normalized) where result = 'unknown';

-- Locks in a valid answer and returns the all-time counts for the question *including* it.
-- Returns no row if the question was already answered.
create function lock_endless_answer(p_run_id uuid, p_seq smallint, p_entity_id text)
returns table (n int, total int)
language plpgsql
set search_path = public
as $$
declare
  v_question text;
begin
  update endless_questions
     set answered_at = now(), entity_id = p_entity_id
   where run_id = p_run_id and seq = p_seq and answered_at is null
  returning question_id into v_question;
  if not found then
    return;
  end if;

  return query
  select (count(*) filter (where eq.entity_id = p_entity_id))::int, count(*)::int
    from endless_questions eq
   where eq.question_id = v_question and eq.entity_id is not null;
end;
$$;

-- Closes an open question without an answer and takes a life. Returns the lives left
-- (no row if the question was not open, e.g. answered in a race).
create function endless_timeout(p_run_id uuid, p_seq smallint)
returns table (lives smallint, ended boolean)
language plpgsql
set search_path = public
as $$
begin
  update endless_questions
     set answered_at = now(), points = 0
   where run_id = p_run_id and seq = p_seq and answered_at is null;
  if not found then
    return;
  end if;

  return query
  update endless_runs r
     set lives = greatest(r.lives - 1, 0),
         ended_at = case when r.lives <= 1 then now() else r.ended_at end
   where r.id = p_run_id
  returning r.lives, r.ended_at is not null;
end;
$$;

alter table endless_runs      enable row level security;
alter table endless_questions enable row level security;
alter table endless_guesses   enable row level security;

revoke execute on function lock_endless_answer(uuid, smallint, text) from public, anon, authenticated;
revoke execute on function endless_timeout(uuid, smallint) from public, anon, authenticated;
