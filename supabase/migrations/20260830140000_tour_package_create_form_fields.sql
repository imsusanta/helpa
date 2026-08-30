begin;

alter table public.tour_packages
  add column if not exists image_url text,
  add column if not exists min_people integer,
  add column if not exists max_people integer,
  add column if not exists price_for text not null default 'Per Person';

alter table public.tour_packages drop constraint if exists tour_packages_people_range;
alter table public.tour_packages add constraint tour_packages_people_range check (
  (min_people is null or min_people >= 1)
  and (max_people is null or max_people >= 1)
  and (min_people is null or max_people is null or max_people >= min_people)
);
create index if not exists idx_tour_packages_people on public.tour_packages (account_id, min_people, max_people);

commit;
