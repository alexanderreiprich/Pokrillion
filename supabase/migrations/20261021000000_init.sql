-- Pokrillion – initial schema. See docs/KONZEPT.md §6.
-- All tables have RLS enabled and no policies: only the server (service role) may access them.

-- ---------------------------------------------------------------------------
-- Content (written by `npm run content:build` / `content:push`)
-- ---------------------------------------------------------------------------

create table entities (
  id           text primary key check (id ~ '^[a-z]+:[a-z0-9-]+$'),
  kind         text not null,
  names        jsonb not null,               -- {"de": "...", "en": "..."}
  attrs        jsonb not null default '{}',
  familiarity  smallint not null check (familiarity between 1 and 100),
  updated_at   timestamptz not null default now()
);
create index entities_kind_idx on entities (kind);

create table entity_aliases (
  alias      text not null,                  -- normalized, see src/lib/game/normalize.ts
  entity_id  text not null references entities (id) on delete cascade,
  primary key (alias, entity_id)
);
create index entity_aliases_entity_idx on entity_aliases (entity_id);

create table questions (
  id                    text primary key,
  category              text not null check (category in ('pokedex', 'games', 'anime')),
  question_group        text,
  difficulty            smallint not null check (difficulty between 1 and 5),
  time_limit_s          smallint not null default 25,
  cooldown_days         smallint not null default 120,
  prompt                jsonb not null,      -- {"de": "...", "en": "..."}
  universe              text[] not null,     -- entity kinds used for fuzzy matching
  masterball_entity_id  text not null references entities (id),
  active                boolean not null default true,
  source                text,
  updated_at            timestamptz not null default now()
);

create table question_answers (
  question_id  text not null references questions (id) on delete cascade,
  entity_id    text not null references entities (id) on delete cascade,
  prior_share  double precision not null check (prior_share >= 0 and prior_share <= 1),
  primary key (question_id, entity_id)
);

-- ---------------------------------------------------------------------------
-- Daily puzzles (written by the scheduler)
-- ---------------------------------------------------------------------------

create table puzzles (
  puzzle_date  date primary key,
  number       int not null unique check (number >= 1),
  created_at   timestamptz not null default now()
);

create table puzzle_questions (
  puzzle_date  date not null references puzzles (puzzle_date) on delete cascade,
  position     smallint not null check (position between 1 and 7),
  question_id  text not null references questions (id),
  primary key (puzzle_date, position),
  unique (puzzle_date, question_id)
);
create index puzzle_questions_question_idx on puzzle_questions (question_id, puzzle_date desc);

-- ---------------------------------------------------------------------------
-- Gameplay (written by the API)
-- ---------------------------------------------------------------------------

create table plays (
  id           uuid primary key default gen_random_uuid(),
  puzzle_date  date not null references puzzles (puzzle_date),
  player_id    uuid not null,                -- anonymous id from the `pid` cookie
  locale       text not null check (locale in ('de', 'en')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  total_score  smallint,
  unique (puzzle_date, player_id)
);

create table play_questions (
  play_id      uuid not null references plays (id) on delete cascade,
  position     smallint not null check (position between 1 and 7),
  started_at   timestamptz not null default now(),
  penalty_s    smallint not null default 0,
  answered_at  timestamptz,                  -- set on a valid answer or timeout
  entity_id    text references entities (id),
  points       smallint,
  primary key (play_id, position)
);

create table guesses (
  id          bigint generated always as identity primary key,
  play_id     uuid not null references plays (id) on delete cascade,
  position    smallint not null,
  raw_input   text not null check (char_length(raw_input) <= 100),
  normalized  text not null,
  entity_id   text references entities (id),
  result      text not null check (result in ('valid', 'wrong_entity', 'unknown', 'duplicate_wrong')),
  points      smallint,
  created_at  timestamptz not null default now()
);
create index guesses_play_idx on guesses (play_id, position);
-- Curation: which unknown inputs come up most often?
create index guesses_unknown_idx on guesses (normalized) where result = 'unknown';

-- How often each valid answer was given per puzzle question. n(a) and N for the scoring.
create view puzzle_answer_counts with (security_invoker = true) as
select p.puzzle_date, pq.position, pq.entity_id, count(*)::int as n
from play_questions pq
join plays p on p.id = pq.play_id
where pq.entity_id is not null
group by p.puzzle_date, pq.position, pq.entity_id;

-- Locks in a valid answer and returns the counts *including* it, in one transaction.
-- Returns no row if the question was already answered (double submit / race).
create function lock_answer(p_play_id uuid, p_position smallint, p_entity_id text)
returns table (n int, total int)
language plpgsql
set search_path = public
as $$
declare
  v_date date;
begin
  update play_questions
     set answered_at = now(), entity_id = p_entity_id
   where play_id = p_play_id and position = p_position and answered_at is null;
  if not found then
    return;
  end if;

  select puzzle_date into v_date from plays where id = p_play_id;

  return query
  select coalesce(sum(c.n) filter (where c.entity_id = p_entity_id), 0)::int,
         coalesce(sum(c.n), 0)::int
    from puzzle_answer_counts c
   where c.puzzle_date = v_date and c.position = p_position;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down: no direct client access.
-- ---------------------------------------------------------------------------

alter table entities          enable row level security;
alter table entity_aliases    enable row level security;
alter table questions         enable row level security;
alter table question_answers  enable row level security;
alter table puzzles           enable row level security;
alter table puzzle_questions  enable row level security;
alter table plays             enable row level security;
alter table play_questions    enable row level security;
alter table guesses           enable row level security;

revoke execute on function lock_answer(uuid, smallint, text) from public, anon, authenticated;
