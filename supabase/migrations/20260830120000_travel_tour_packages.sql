-- ============================================================
-- Migration: 20260830120000_travel_tour_packages.sql
-- Purpose: Normalized Tour Package catalog for Travel Workplace.
-- Tenant key follows the existing Helpa ownership field: account_id.
-- Does not alter travel_packages / travel_bookings (legacy entity page).
-- ============================================================

begin;

create table if not exists public.tour_packages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  destination text not null,
  description text,
  package_type text,
  category text,
  duration_days integer not null default 1 check (duration_days >= 1),
  duration_nights integer not null default 0 check (duration_nights >= 0),
  starting_price numeric,
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('active', 'inactive')),
  featured boolean not null default false,
  valid_from date,
  valid_until date,
  booking_notes text,
  terms_and_conditions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_packages_validity_range check (
    valid_from is null or valid_until is null or valid_until >= valid_from
  )
);

create table if not exists public.tour_package_itineraries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  title text,
  description text,
  activities text,
  meals text,
  hotel text,
  overnight_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, day_number)
);

create table if not exists public.tour_package_inclusions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  item text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_package_exclusions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  item text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tour_package_hotels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  city text,
  hotel_name text not null,
  star_category text,
  room_type text,
  meal_plan text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_package_pricing (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  pricing_name text,
  adults integer not null default 2 check (adults >= 1),
  children integer not null default 0 check (children >= 0),
  occupancy_type text,
  price numeric not null check (price >= 0),
  currency text not null default 'INR',
  extra_bed numeric,
  valid_from date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_package_departures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  package_id uuid not null references public.tour_packages(id) on delete cascade,
  departure_date date not null,
  return_date date,
  total_seats integer check (total_seats is null or total_seats >= 0),
  available_seats integer check (available_seats is null or available_seats >= 0),
  price numeric,
  currency text not null default 'INR',
  status text not null default 'open' check (status in ('open', 'sold_out', 'cancelled', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_package_departures_date_range check (
    return_date is null or return_date >= departure_date
  )
);

create index if not exists idx_tour_packages_account_id
  on public.tour_packages (account_id);
create index if not exists idx_tour_packages_destination
  on public.tour_packages (account_id, destination);
create index if not exists idx_tour_packages_status
  on public.tour_packages (account_id, status);
create index if not exists idx_tour_packages_duration
  on public.tour_packages (account_id, duration_days);
create index if not exists idx_tour_packages_valid_from
  on public.tour_packages (valid_from);
create index if not exists idx_tour_packages_valid_until
  on public.tour_packages (valid_until);
create index if not exists idx_tour_packages_featured
  on public.tour_packages (account_id, featured)
  where featured = true;

create index if not exists idx_tour_package_itineraries_package_id
  on public.tour_package_itineraries (package_id);
create index if not exists idx_tour_package_itineraries_account_id
  on public.tour_package_itineraries (account_id);

create index if not exists idx_tour_package_inclusions_package_id
  on public.tour_package_inclusions (package_id);
create index if not exists idx_tour_package_inclusions_account_id
  on public.tour_package_inclusions (account_id);

create index if not exists idx_tour_package_exclusions_package_id
  on public.tour_package_exclusions (package_id);
create index if not exists idx_tour_package_exclusions_account_id
  on public.tour_package_exclusions (account_id);

create index if not exists idx_tour_package_hotels_package_id
  on public.tour_package_hotels (package_id);
create index if not exists idx_tour_package_hotels_account_id
  on public.tour_package_hotels (account_id);

create index if not exists idx_tour_package_pricing_package_id
  on public.tour_package_pricing (package_id);
create index if not exists idx_tour_package_pricing_account_id
  on public.tour_package_pricing (account_id);
create index if not exists idx_tour_package_pricing_valid_from
  on public.tour_package_pricing (valid_from);
create index if not exists idx_tour_package_pricing_valid_until
  on public.tour_package_pricing (valid_until);

create index if not exists idx_tour_package_departures_package_id
  on public.tour_package_departures (package_id);
create index if not exists idx_tour_package_departures_account_id
  on public.tour_package_departures (account_id);
create index if not exists idx_tour_package_departures_date
  on public.tour_package_departures (departure_date);
create index if not exists idx_tour_package_departures_status
  on public.tour_package_departures (account_id, status);

create or replace function public.set_tour_package_child_account_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_account_id uuid;
begin
  select p.account_id
    into v_account_id
    from public.tour_packages p
   where p.id = new.package_id;

  if v_account_id is null then
    raise exception 'tour package not found';
  end if;

  new.account_id := v_account_id;
  return new;
end;
$$;

drop trigger if exists trg_tour_package_itineraries_account on public.tour_package_itineraries;
create trigger trg_tour_package_itineraries_account
  before insert or update of package_id on public.tour_package_itineraries
  for each row execute function public.set_tour_package_child_account_id();

drop trigger if exists trg_tour_package_inclusions_account on public.tour_package_inclusions;
create trigger trg_tour_package_inclusions_account
  before insert or update of package_id on public.tour_package_inclusions
  for each row execute function public.set_tour_package_child_account_id();

drop trigger if exists trg_tour_package_exclusions_account on public.tour_package_exclusions;
create trigger trg_tour_package_exclusions_account
  before insert or update of package_id on public.tour_package_exclusions
  for each row execute function public.set_tour_package_child_account_id();

drop trigger if exists trg_tour_package_hotels_account on public.tour_package_hotels;
create trigger trg_tour_package_hotels_account
  before insert or update of package_id on public.tour_package_hotels
  for each row execute function public.set_tour_package_child_account_id();

drop trigger if exists trg_tour_package_pricing_account on public.tour_package_pricing;
create trigger trg_tour_package_pricing_account
  before insert or update of package_id on public.tour_package_pricing
  for each row execute function public.set_tour_package_child_account_id();

drop trigger if exists trg_tour_package_departures_account on public.tour_package_departures;
create trigger trg_tour_package_departures_account
  before insert or update of package_id on public.tour_package_departures
  for each row execute function public.set_tour_package_child_account_id();

alter table public.tour_packages enable row level security;
alter table public.tour_package_itineraries enable row level security;
alter table public.tour_package_inclusions enable row level security;
alter table public.tour_package_exclusions enable row level security;
alter table public.tour_package_hotels enable row level security;
alter table public.tour_package_pricing enable row level security;
alter table public.tour_package_departures enable row level security;

drop policy if exists "tour_packages_select" on public.tour_packages;
create policy "tour_packages_select" on public.tour_packages
  for select to authenticated
  using (
    is_account_member(account_id, 'viewer'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "tour_packages_insert" on public.tour_packages;
create policy "tour_packages_insert" on public.tour_packages
  for insert to authenticated, service_role
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "tour_packages_update" on public.tour_packages;
create policy "tour_packages_update" on public.tour_packages
  for update to authenticated, service_role
  using (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  )
  with check (
    is_account_member(account_id, 'agent'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "tour_packages_delete" on public.tour_packages;
create policy "tour_packages_delete" on public.tour_packages
  for delete to authenticated, service_role
  using (
    is_account_member(account_id, 'admin'::account_role_enum)
    or (select auth.role()) = 'service_role'
  );

drop policy if exists "tour_packages_service" on public.tour_packages;
create policy "tour_packages_service" on public.tour_packages
  for all to service_role
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

-- Child-table policies: always scoped through account_id copied from the parent package.
do $$
declare
  child_table text;
begin
  foreach child_table in array array[
    'tour_package_itineraries',
    'tour_package_inclusions',
    'tour_package_exclusions',
    'tour_package_hotels',
    'tour_package_pricing',
    'tour_package_departures'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', child_table || '_select', child_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (is_account_member(account_id, ''viewer''::account_role_enum) or (select auth.role()) = ''service_role'')',
      child_table || '_select',
      child_table
    );

    execute format('drop policy if exists %I on public.%I', child_table || '_insert', child_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated, service_role with check (is_account_member(account_id, ''agent''::account_role_enum) or (select auth.role()) = ''service_role'')',
      child_table || '_insert',
      child_table
    );

    execute format('drop policy if exists %I on public.%I', child_table || '_update', child_table);
    execute format(
      'create policy %I on public.%I for update to authenticated, service_role using (is_account_member(account_id, ''agent''::account_role_enum) or (select auth.role()) = ''service_role'') with check (is_account_member(account_id, ''agent''::account_role_enum) or (select auth.role()) = ''service_role'')',
      child_table || '_update',
      child_table
    );

    execute format('drop policy if exists %I on public.%I', child_table || '_delete', child_table);
    execute format(
      'create policy %I on public.%I for delete to authenticated, service_role using (is_account_member(account_id, ''admin''::account_role_enum) or (select auth.role()) = ''service_role'')',
      child_table || '_delete',
      child_table
    );

    execute format('drop policy if exists %I on public.%I', child_table || '_service', child_table);
    execute format(
      'create policy %I on public.%I for all to service_role using ((select auth.role()) = ''service_role'') with check ((select auth.role()) = ''service_role'')',
      child_table || '_service',
      child_table
    );
  end loop;
end $$;

commit;
