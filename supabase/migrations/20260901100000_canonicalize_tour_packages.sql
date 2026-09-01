-- ─────────────────────────────────────────────────────────────
-- Canonicalize tour_packages as the single travel-package table.
--
-- Background: `travel_packages` was a booking-only mirror created at
-- confirm time from `tour_packages` rows (staff-booking.ts /
-- booking-confirm.ts `ensureLegacyTravelPackage`), needed only because
-- `travel_bookings.package_id` had a foreign key to it. The data was
-- duplicated at the moment of confirmation and the two tables drifted.
--
-- This migration:
--   1. Adds `travel_bookings.tour_package_id` referencing `tour_packages`.
--   2. Backfills it from the old `package_id` (via travel_packages.name →
--      tour_packages.name per account). Production had 0 rows on both
--      tables at the time of writing, so this is a no-op there but keeps
--      the migration correct for any self-hosted install with data.
--   3. Drops the old `package_id` column and the `travel_packages` table.
--
-- Code counterpart (same PR): staff-booking.ts and booking-confirm.ts
-- now write `tour_package_id` directly — no mirror, no drift.
-- Idempotent guards are used throughout.
-- ─────────────────────────────────────────────────────────────

-- 1. New canonical column.
alter table public.travel_bookings
  add column if not exists tour_package_id uuid;

-- 2. Backfill from the legacy mirror where the new column is empty and the
--    old column still exists (guard for repeat-runs after the drop).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'travel_bookings'
      and column_name = 'package_id'
  ) then
    update public.travel_bookings b
    set tour_package_id = tp.id
    from public.travel_packages lp
    join public.tour_packages t
      on t.account_id = lp.account_id
     and lower(t.name) = lower(lp.name)
    where b.package_id = lp.id
      and b.tour_package_id is null;

    -- Rows whose mirror had no name match keep null tour_package_id; they
    -- stay untouched rather than being deleted.

    -- 3. Drop the old FK column (removes the FK to travel_packages).
    alter table public.travel_bookings
      drop column if exists package_id;
  end if;
end
$$;

-- 4. Drop the mirror table (0 rows on production; policies go with it).
drop table if exists public.travel_packages;

-- 5. Keep the new column honest: required for every future booking.
--    (Existing rows keep NULL for history; new inserts must set it.)
alter table public.travel_bookings
  alter column tour_package_id set not null;
