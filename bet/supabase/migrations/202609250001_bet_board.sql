begin;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('zac', 'adrian', 'dylan', 'sam')),
  display_name text not null,
  user_id uuid unique references auth.users(id) on delete set null
);

insert into public.profiles (id, slug, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'zac', 'Zac'),
  ('00000000-0000-4000-8000-000000000002', 'adrian', 'Adrian'),
  ('00000000-0000-4000-8000-000000000003', 'dylan', 'Dylan'),
  ('00000000-0000-4000-8000-000000000004', 'sam', 'Sam');

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  description text not null check (length(btrim(description)) between 1 and 240),
  stake_pence bigint not null check (stake_pence between 1 and 100000000),
  odds_format text not null check (odds_format in ('fractional', 'decimal')),
  odds_text text not null check (length(odds_text) between 1 and 32),
  odds_numerator numeric not null check (odds_numerator > 0),
  odds_denominator numeric not null check (odds_denominator > 0),
  odds_decimal numeric not null check (odds_decimal > 1 and odds_decimal <= 1000000),
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  placed_at timestamptz not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  profit_pence bigint,
  constraint settlement_consistent check (
    (status = 'pending' and settled_at is null and profit_pence is null)
    or (status <> 'pending' and settled_at is not null and settled_at >= placed_at
      and profit_pence is not null and (
        (status = 'won' and profit_pence >= 0)
        or (status = 'lost' and profit_pence = -stake_pence)
        or (status = 'void' and profit_pence = 0)
      ))
  )
);
create index bets_profile_placed on public.bets (profile_id, placed_at desc, id);
create index bets_settled on public.bets (settled_at) where settled_at is not null;

alter table public.profiles enable row level security;
alter table public.bets enable row level security;
revoke all on public.profiles, public.bets from public, anon, authenticated;
grant select (id, slug, display_name) on public.profiles to authenticated;
grant select (id, profile_id, description, stake_pence, odds_format, odds_text, status, placed_at, settled_at, profit_pence) on public.bets to authenticated;

create policy own_profile on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_bets on public.bets for select to authenticated
  using (profile_id in (select id from public.profiles));

-- Only these two functions may write. The caller cannot choose an owner or a profit.
create function public.create_bet(
  p_id uuid, p_description text, p_stake_pence bigint,
  p_odds_format text, p_odds_text text, p_placed_at timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_num numeric;
  v_den numeric;
  v_decimal numeric;
  v_text text := btrim(p_odds_text);
  v_row public.bets;
begin
  select id into v_profile from public.profiles where user_id = auth.uid();
  if v_profile is null then raise exception 'This account is not invited to the board.'; end if;
  if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 240 then
    raise exception 'Enter a bet description of 1 to 240 characters.';
  end if;
  if p_stake_pence is null or p_stake_pence not between 1 and 100000000 then
    raise exception 'Enter a stake between £0.01 and £1,000,000.';
  end if;
  if p_placed_at is null or not isfinite(p_placed_at) or p_placed_at > now() or p_placed_at < '2000-01-01'::timestamptz then
    raise exception 'Choose a date from 2000 up to the current time.';
  end if;
  if v_text is null or length(v_text) not between 1 and 32 then raise exception 'Enter valid odds.'; end if;
  if p_odds_format = 'fractional' then
    if v_text !~ '^[0-9]+[[:space:]]*/[[:space:]]*[0-9]+$' then raise exception 'Use fractional odds like 5/2.'; end if;
    v_num := btrim(split_part(v_text, '/', 1))::numeric;
    v_den := btrim(split_part(v_text, '/', 2))::numeric;
    if v_num not between 1 and 1000000 or v_den not between 1 and 1000000 then raise exception 'Both parts of fractional odds must be between 1 and 1,000,000.'; end if;
    v_text := v_num::bigint::text || '/' || v_den::bigint::text;
    v_decimal := 1 + v_num / v_den;
  elsif p_odds_format = 'decimal' then
    if v_text !~ '^[0-9]+([.][0-9]{1,6})?$' then raise exception 'Use decimal odds like 2.50, with up to six decimal places.'; end if;
    v_decimal := v_text::numeric;
    v_den := power(10::numeric, length(split_part(v_text, '.', 2)));
    v_num := (v_decimal - 1) * v_den;
  else raise exception 'Choose fractional or decimal odds.';
  end if;
  if v_decimal <= 1 or v_decimal > 1000000 then raise exception 'Decimal odds must be greater than 1 and at most 1,000,000.'; end if;

  insert into public.bets (id, profile_id, description, stake_pence, odds_format, odds_text, odds_numerator, odds_denominator, odds_decimal, placed_at)
    values (p_id, v_profile, btrim(p_description), p_stake_pence, p_odds_format, v_text, v_num, v_den, v_decimal, p_placed_at)
    on conflict (id) do nothing returning * into v_row;
  if v_row.id is null then
    select * into v_row from public.bets where id = p_id and profile_id = v_profile;
    if v_row.id is null then raise exception 'This bet could not be saved. Please try again.'; end if;
    if v_row.description <> btrim(p_description) or v_row.stake_pence <> p_stake_pence
      or v_row.odds_format <> p_odds_format or v_row.odds_text <> v_text or v_row.placed_at <> p_placed_at then
      raise exception 'This bet was already saved with different details. Close the form and check your active bets.';
    end if;
  end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status);
end;
$$;

create function public.settle_bet(p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_profile uuid; v_row public.bets;
begin
  select id into v_profile from public.profiles where user_id = auth.uid();
  if v_profile is null then raise exception 'This account is not invited to the board.'; end if;
  if p_status is null or p_status not in ('won', 'lost', 'void') then raise exception 'Choose won, lost or void.'; end if;
  update public.bets set status = p_status, settled_at = now(), profit_pence = case
    when p_status = 'won' then round(stake_pence::numeric * odds_numerator / odds_denominator)::bigint
    when p_status = 'lost' then -stake_pence else 0 end
    where id = p_id and profile_id = v_profile and status = 'pending'
    returning * into v_row;
  if v_row.id is null then raise exception 'This bet is no longer active or is not yours. Refresh your bets.'; end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'profit_pence', v_row.profit_pence);
end;
$$;

-- Intentionally public, but returns ONLY the four display identities and aggregate
-- results. Never expose auth IDs, email addresses, selections, or individual bet IDs.
create function public.get_public_dashboard(p_since date default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with events as (
    select profile_id, (placed_at at time zone 'Europe/London')::date as day,
      stake_pence as staked_pence, 0::bigint as profit_pence from public.bets
    union all
    select profile_id, (settled_at at time zone 'Europe/London')::date,
      0::bigint, profit_pence from public.bets where status <> 'pending'
  ), daily as (
    select profile_id, day, sum(staked_pence) as staked_pence, sum(profit_pence) as profit_pence
    from events where p_since is null or day >= p_since group by profile_id, day
  ), series as (
    select profile_id, jsonb_agg(jsonb_build_object('day', day, 'staked_pence', staked_pence, 'profit_pence', profit_pence) order by day) as days,
      sum(staked_pence) as staked_pence, sum(profit_pence) as profit_pence from daily group by profile_id
  ), counts as (
    select profile_id,
      count(*) filter (where status = 'pending') as pending_count,
      coalesce(sum(stake_pence) filter (where status = 'pending'), 0) as pending_pence,
      count(*) filter (where status = 'won' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as wins,
      count(*) filter (where status = 'lost' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as losses,
      count(*) filter (where status = 'void' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as voids
    from public.bets group by profile_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'display_name', p.display_name,
    'days', coalesce(s.days, '[]'::jsonb), 'staked_pence', coalesce(s.staked_pence, 0),
    'profit_pence', coalesce(s.profit_pence, 0), 'pending_count', coalesce(c.pending_count, 0),
    'pending_pence', coalesce(c.pending_pence, 0), 'wins', coalesce(c.wins, 0),
    'losses', coalesce(c.losses, 0), 'voids', coalesce(c.voids, 0)
  ) order by array_position(array['zac', 'adrian', 'dylan', 'sam'], p.slug)), '[]'::jsonb)
  from public.profiles p left join series s on s.profile_id = p.id left join counts c on c.profile_id = p.id;
$$;

revoke all on function public.create_bet(uuid, text, bigint, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.settle_bet(uuid, text) from public, anon, authenticated;
revoke all on function public.get_public_dashboard(date) from public, anon, authenticated;
grant execute on function public.create_bet(uuid, text, bigint, text, text, timestamptz) to authenticated;
grant execute on function public.settle_bet(uuid, text) to authenticated;
grant execute on function public.get_public_dashboard(date) to anon, authenticated;

commit;
