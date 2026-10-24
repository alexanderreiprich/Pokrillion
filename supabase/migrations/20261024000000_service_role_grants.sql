-- Explicit grants for service_role. Newer Supabase cloud projects no longer expose new
-- tables to the API roles automatically, so without these the server gets 42501.
-- anon/authenticated stay without access (RLS on, no policies).

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Objects created by later migrations.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
