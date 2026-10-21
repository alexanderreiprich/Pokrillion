-- Answer distribution per question of a puzzle, for the end-of-round summary.
-- entity_id is null for timeouts; sum(n) per pos = players who finished that question.
create function puzzle_position_stats(p_date date)
returns table (pos smallint, entity_id text, n int)
language sql
stable
set search_path = public
as $$
  select pq.position, pq.entity_id, count(*)::int
    from play_questions pq
    join plays p on p.id = pq.play_id
   where p.puzzle_date = p_date
     and pq.answered_at is not null
   group by pq.position, pq.entity_id
$$;

-- Closes a play once all questions are answered. Idempotent; returns the total or null if unfinished.
create function finish_play(p_play_id uuid, p_question_count int)
returns smallint
language plpgsql
set search_path = public
as $$
declare
  v_answered int;
  v_total smallint;
begin
  select count(*), coalesce(sum(points), 0)
    into v_answered, v_total
    from play_questions
   where play_id = p_play_id and answered_at is not null;

  if v_answered < p_question_count then
    return null;
  end if;

  update plays
     set finished_at = coalesce(finished_at, now()), total_score = v_total
   where id = p_play_id;
  return v_total;
end;
$$;

revoke execute on function puzzle_position_stats(date) from public, anon, authenticated;
revoke execute on function finish_play(uuid, int) from public, anon, authenticated;
