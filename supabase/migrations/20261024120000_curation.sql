-- Read-only aggregates for the curation view (/[lang]/admin). Daily and endless mode combined.

-- Every guess with the question it was made on.
create view admin_guesses with (security_invoker = true) as
select g.created_at, g.raw_input, g.normalized, g.entity_id, g.result, pq.question_id, 'daily'::text as mode
  from guesses g
  join plays p on p.id = g.play_id
  join puzzle_questions pq on pq.puzzle_date = p.puzzle_date and pq.position = g.position
union all
select g.created_at, g.raw_input, g.normalized, g.entity_id, g.result, eq.question_id, 'endless'::text
  from endless_guesses g
  join endless_questions eq on eq.run_id = g.run_id and eq.seq = g.seq;

-- Every finished question (valid answer or timeout).
create view admin_answers with (security_invoker = true) as
select pq_.answered_at, pz.question_id, pq_.entity_id, pq_.points, 'daily'::text as mode
  from play_questions pq_
  join plays p on p.id = pq_.play_id
  join puzzle_questions pz on pz.puzzle_date = p.puzzle_date and pz.position = pq_.position
 where pq_.answered_at is not null
union all
select eq.answered_at, eq.question_id, eq.entity_id, eq.points, 'endless'::text
  from endless_questions eq
 where eq.answered_at is not null;

-- Unknown inputs, most frequent first. `questions` = where they were typed.
create function admin_unknown_inputs(p_since timestamptz, p_limit int)
returns table (normalized text, sample text, n int, questions text[])
language sql stable set search_path = public
as $$
  select g.normalized, min(g.raw_input), count(*)::int, array_agg(distinct g.question_id)
    from admin_guesses g
   where g.result = 'unknown' and g.created_at >= p_since
   group by g.normalized
   order by count(*) desc, g.normalized
   limit p_limit
$$;

-- Real entities that were guessed but don't count for that question.
create function admin_disputed(p_since timestamptz, p_limit int)
returns table (question_id text, entity_id text, n int)
language sql stable set search_path = public
as $$
  select g.question_id, g.entity_id, count(*)::int
    from admin_guesses g
   where g.result = 'wrong_entity' and g.created_at >= p_since
   group by g.question_id, g.entity_id
   order by count(*) desc
   limit p_limit
$$;

create function admin_question_stats(p_since timestamptz)
returns table (question_id text, answered int, misses int, avg_points numeric, distinct_answers int,
               wrong int, unknown int)
language sql stable set search_path = public
as $$
  with a as (
    select question_id,
           count(*)::int as answered,
           (count(*) filter (where entity_id is null))::int as misses,
           round(avg(points), 1) as avg_points,
           (count(distinct entity_id))::int as distinct_answers
      from admin_answers where answered_at >= p_since group by question_id
  ), g as (
    select question_id,
           (count(*) filter (where result = 'wrong_entity'))::int as wrong,
           (count(*) filter (where result = 'unknown'))::int as unknown
      from admin_guesses where created_at >= p_since group by question_id
  )
  select coalesce(a.question_id, g.question_id), coalesce(a.answered, 0), coalesce(a.misses, 0), a.avg_points,
         coalesce(a.distinct_answers, 0), coalesce(g.wrong, 0), coalesce(g.unknown, 0)
    from a full join g on g.question_id = a.question_id
$$;

create function admin_answer_distribution(p_question_id text, p_since timestamptz)
returns table (entity_id text, n int)
language sql stable set search_path = public
as $$
  select entity_id, count(*)::int
    from admin_answers
   where question_id = p_question_id and entity_id is not null and answered_at >= p_since
   group by entity_id
$$;

create function admin_daily(p_since timestamptz)
returns table (day date, plays int, finished int, avg_score numeric, endless_runs int, endless_answers int)
language sql stable set search_path = public
as $$
  with d as (
    select (started_at at time zone 'utc')::date as day, count(*)::int as plays,
           (count(*) filter (where finished_at is not null))::int as finished,
           round(avg(total_score) filter (where finished_at is not null), 1) as avg_score
      from plays where started_at >= p_since group by 1
  ), e as (
    select (r.started_at at time zone 'utc')::date as day, count(distinct r.id)::int as endless_runs,
           count(eq.answered_at)::int as endless_answers
      from endless_runs r left join endless_questions eq on eq.run_id = r.id
     where r.started_at >= p_since group by 1
  )
  select coalesce(d.day, e.day), coalesce(d.plays, 0), coalesce(d.finished, 0), d.avg_score,
         coalesce(e.endless_runs, 0), coalesce(e.endless_answers, 0)
    from d full join e on e.day = d.day
   order by 1 desc
$$;

revoke execute on function admin_unknown_inputs(timestamptz, int) from public, anon, authenticated;
revoke execute on function admin_disputed(timestamptz, int) from public, anon, authenticated;
revoke execute on function admin_question_stats(timestamptz) from public, anon, authenticated;
revoke execute on function admin_answer_distribution(text, timestamptz) from public, anon, authenticated;
revoke execute on function admin_daily(timestamptz) from public, anon, authenticated;
revoke all on admin_guesses, admin_answers from anon, authenticated;

-- Explicit, so it doesn't depend on default privileges (see 20261024000000_service_role_grants.sql).
grant execute on function admin_unknown_inputs(timestamptz, int) to service_role;
grant execute on function admin_disputed(timestamptz, int) to service_role;
grant execute on function admin_question_stats(timestamptz) to service_role;
grant execute on function admin_answer_distribution(text, timestamptz) to service_role;
grant execute on function admin_daily(timestamptz) to service_role;
grant select on admin_guesses, admin_answers to service_role;
