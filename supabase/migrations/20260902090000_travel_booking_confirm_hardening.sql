-- Travel WhatsApp booking confirmation hardening.
--
-- The WhatsApp confirm path previously read the pending booking from contact
-- metadata and issued three independent inserts (travel_bookings, appointments,
-- contact_notes) with no idempotency gate: a double-tapped Confirm Booking
-- button created duplicate bookings, and a mid-path failure left partial rows.
--
-- These functions make the claim and the multi-table write atomic:
--   * claim_travel_pending_booking — test-and-clear gate; concurrent confirms
--     are serialized by the FOR UPDATE row lock and only the first caller wins.
--   * create_travel_booking — final server-side guards (package active, travel
--     date in the future, departure seats) and an all-or-nothing insert of the
--     booking, its calendar placeholder, and the contact timeline note.
--
-- Both are service-role only: they run inside the verified webhook pipeline
-- and must never be reachable from anon or authenticated clients.

begin;

create or replace function public.claim_travel_pending_booking(
  p_account_id uuid,
  p_contact_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb;
  v_pending jsonb;
begin
  select metadata
    into v_meta
    from public.contacts
   where id = p_contact_id
     and account_id = p_account_id
   for update;

  if not found
     or v_meta is null
     or jsonb_typeof(v_meta -> 'travel_pending_booking') is distinct from 'object' then
    return jsonb_build_object('status', 'no_pending');
  end if;

  v_pending := v_meta -> 'travel_pending_booking';
  if not (v_pending ? 'package_id') and not (v_pending ? 'package_name') then
    return jsonb_build_object('status', 'no_pending');
  end if;

  update public.contacts
     set metadata = jsonb_set(v_meta, '{travel_pending_booking}', 'null'::jsonb, true),
         updated_at = now()
   where id = p_contact_id
     and account_id = p_account_id;

  return jsonb_build_object('status', 'claimed', 'pending', v_pending);
end;
$$;

revoke all on function public.claim_travel_pending_booking(uuid, uuid) from public;
grant execute on function public.claim_travel_pending_booking(uuid, uuid) to service_role;

create or replace function public.create_travel_booking(
  p_account_id uuid,
  p_tour_package_id uuid,
  p_contact_id uuid,
  p_travel_date date,
  p_guests_count integer,
  p_total_price numeric,
  p_currency text,
  p_package_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg public.tour_packages%rowtype;
  v_departure public.tour_package_departures%rowtype;
  v_booking_id uuid;
begin
  if p_guests_count is null or p_guests_count < 1 or p_guests_count > 50 then
    return jsonb_build_object('status', 'rejected', 'reason', 'invalid_guests');
  end if;

  if p_travel_date is null or p_travel_date < current_date then
    return jsonb_build_object('status', 'rejected', 'reason', 'travel_date_past');
  end if;

  select *
    into v_pkg
    from public.tour_packages
   where id = p_tour_package_id
     and account_id = p_account_id;
  if not found then
    return jsonb_build_object('status', 'rejected', 'reason', 'package_not_found');
  end if;

  if v_pkg.status <> 'active'
     or (v_pkg.valid_from is not null and v_pkg.valid_from > current_date)
     or (v_pkg.valid_until is not null and v_pkg.valid_until < current_date) then
    return jsonb_build_object('status', 'rejected', 'reason', 'package_inactive');
  end if;

  -- Seat guard applies only when a concrete departure exists for the date;
  -- open-dated packages have no inventory to check.
  select *
    into v_departure
    from public.tour_package_departures
   where account_id = p_account_id
     and package_id = p_tour_package_id
     and departure_date = p_travel_date
   limit 1;
  if found and (
       v_departure.status <> 'open'
       or (v_departure.available_seats is not null
           and v_departure.available_seats < p_guests_count)
     ) then
    return jsonb_build_object('status', 'rejected', 'reason', 'departure_unavailable');
  end if;

  insert into public.travel_bookings
    (account_id, tour_package_id, contact_id, travel_date, guests_count, total_price, status)
  values
    (p_account_id, p_tour_package_id, p_contact_id, p_travel_date, p_guests_count, p_total_price, 'Confirmed')
  returning id into v_booking_id;

  -- Placeholder calendar row so the booking stays visible on the appointments
  -- surface the travel module exposes; department marks it travel, not OPD.
  insert into public.appointments
    (account_id, patient_id, appointment_date, appointment_time, department, status, notes)
  values
    (p_account_id, p_contact_id, p_travel_date, '10:00', 'Travel', 'Confirmed',
     'Travel Booking | Package: ' || coalesce(p_package_name, '')
       || ' | Guests: ' || p_guests_count
       || ' | Total: ' || coalesce(p_currency, 'INR') || ' ' || p_total_price);

  insert into public.contact_notes
    (account_id, contact_id, note_text)
  values
    (p_account_id, p_contact_id,
     '[Timeline] Travel Booking confirmed via WhatsApp for '
       || coalesce(p_package_name, 'the selected package')
       || ' on ' || p_travel_date
       || ' (' || p_guests_count || ' guests).');

  return jsonb_build_object('status', 'created', 'booking_id', v_booking_id);
end;
$$;

revoke all on function public.create_travel_booking(uuid, uuid, uuid, date, integer, numeric, text, text) from public;
grant execute on function public.create_travel_booking(uuid, uuid, uuid, date, integer, numeric, text, text) to service_role;

commit;
