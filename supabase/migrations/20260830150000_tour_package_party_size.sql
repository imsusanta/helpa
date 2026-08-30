-- Optional party size for the Tour Package create form.

begin;

alter table public.tour_packages
  add column if not exists min_people integer,
  add column if not exists max_people integer;

alter table public.tour_packages
  drop constraint if exists tour_packages_min_people_check,
  drop constraint if exists tour_packages_max_people_check,
  drop constraint if exists tour_packages_party_size_range;

alter table public.tour_packages
  add constraint tour_packages_min_people_check
    check (min_people is null or min_people >= 1),
  add constraint tour_packages_max_people_check
    check (max_people is null or max_people >= 1),
  add constraint tour_packages_party_size_range
    check (
      min_people is null
      or max_people is null
      or max_people >= min_people
    );

commit;
