-- Optional cover image and a simple price type for the Tour Package form.

begin;

alter table public.tour_packages
  add column if not exists cover_image_url text,
  add column if not exists price_type text;

commit;
