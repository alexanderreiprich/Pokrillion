-- Rate limit for /guess, see docs/KONZEPT.md §10. Fixed window per key (`pid:…`, `ip:…`).
-- Lives in Postgres because serverless instances share no memory.

create table rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          int not null
);

alter table rate_limits enable row level security;

-- Counts one hit for every key and returns false if any of them is over its limit.
create function hit_rate_limits(p_keys text[], p_max int[], p_window_s int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_ok boolean := true;
  v_hits int;
begin
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    insert into rate_limits as r (key, window_start, hits)
    values (p_keys[i], now(), 1)
    on conflict (key) do update
       set window_start = case when r.window_start <= now() - make_interval(secs => p_window_s)
                               then now() else r.window_start end,
           hits = case when r.window_start <= now() - make_interval(secs => p_window_s)
                       then 1 else r.hits + 1 end
    returning hits into v_hits;
    if v_hits > p_max[i] then
      v_ok := false;
    end if;
  end loop;
  return v_ok;
end;
$$;

-- Called by the daily cron.
create function prune_rate_limits()
returns int
language sql
set search_path = public
as $$
  with deleted as (
    delete from rate_limits where window_start < now() - interval '1 hour' returning 1
  )
  select count(*)::int from deleted
$$;

revoke execute on function hit_rate_limits(text[], int[], int) from public, anon, authenticated;
revoke execute on function prune_rate_limits() from public, anon, authenticated;
grant execute on function hit_rate_limits(text[], int[], int) to service_role;
grant execute on function prune_rate_limits() to service_role;
grant all on rate_limits to service_role;
