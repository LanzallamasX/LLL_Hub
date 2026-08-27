-- Optional address details completed by each user from /profile.

alter table public.profiles
  add column if not exists address text,
  add column if not exists locality text,
  add column if not exists province text,
  add column if not exists postal_code text,
  add column if not exists country text;

comment on column public.profiles.address is
  'Street address, including number, floor or apartment when applicable.';
comment on column public.profiles.locality is
  'Locality or city of residence.';
comment on column public.profiles.province is
  'Province, state or first-level administrative area.';
comment on column public.profiles.postal_code is
  'Postal code as text to preserve letters and leading zeroes.';
comment on column public.profiles.country is
  'Country of residence.';
