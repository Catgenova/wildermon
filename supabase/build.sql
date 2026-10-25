-- The builds the site serves now, handed to the island by the deploy.
--
-- The migrate job in .github/workflows/island.yml runs this after the push as
--
--   psql -X -q -t -A -v ON_ERROR_STOP=1 -v builds="$BUILDS" -f supabase/build.sql
--
-- where BUILDS is a JSON array of `{"build": "<16 hex>", "deploy": <n>}`: the
-- build committed in assets/version.json, and the one the job builds itself
-- from the same commit, which is what the "Build site" workflow serves if it
-- rebuilds. supabase/test/build.ts runs it the same way.
--
-- The list reaches the server as a quoted literal (`:'builds'`), so nothing in
-- it can become SQL. What comes back is how many builds are current.
-- Every other build is retired as of now and still taken for an hour
-- (20261026130900).
\set ON_ERROR_STOP on
\set VERBOSITY terse
select private.builds_deployed(:'builds'::jsonb);
