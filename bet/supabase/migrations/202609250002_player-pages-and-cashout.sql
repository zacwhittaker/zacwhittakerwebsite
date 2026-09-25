begin;

alter table public.bets
  add column if not exists cashout_odds_format text,
  add column if not exists cashout_odds_text text,
  add column if not exists cashout_odds_numerator numeric,
  add column if not exists cashout_odds_denominator numeric,
  add column if not exists cashout_odds_decimal numeric;

alter table public.bets drop constraint if exists bets_status_check;
alter table public.bets add constraint bets_status_check
  check (status in ('pending', 'won', 'lost', 'void', 'cashed_out'));

alter table public.bets drop constraint if exists settlement_consistent;
alter table public.bets add constraint settlement_consistent check (
  (status = 'pending' and settled_at is null and profit_pence is null
    and cashout_odds_format is null and cashout_odds_text is null
    and cashout_odds_numerator is null and cashout_odds_denominator is null
    and cashout_odds_decimal is null)
  or (status in ('won', 'lost', 'void') and settled_at is not null and settled_at >= placed_at
    and profit_pence is not null and cashout_odds_format is null and cashout_odds_text is null
    and cashout_odds_numerator is null and cashout_odds_denominator is null
    and cashout_odds_decimal is null and (
      (status = 'won' and profit_pence >= 0)
      or (status = 'lost' and profit_pence = -stake_pence)
      or (status = 'void' and profit_pence = 0)
    ))
  or (status = 'cashed_out' and settled_at is not null and settled_at >= placed_at
    and profit_pence >= 0 and cashout_odds_format in ('fractional', 'decimal')
    and cashout_odds_text is not null and length(btrim(cashout_odds_text)) between 1 and 32
    and cashout_odds_numerator > 0 and cashout_odds_denominator > 0
    and cashout_odds_numerator is not null and cashout_odds_denominator is not null and cashout_odds_decimal is not null
    and cashout_odds_decimal > 1 and cashout_odds_decimal <= 1000000
    and profit_pence = round(stake_pence::numeric * cashout_odds_numerator / cashout_odds_denominator)::bigint)
);

drop function public.settle_bet(uuid, text);

create function public.settle_bet(
  p_id uuid,
  p_status text,
  p_cashout_odds_format text,
  p_cashout_odds_text text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_num numeric;
  v_den numeric;
  v_decimal numeric;
  v_text text := btrim(p_cashout_odds_text);
  v_row public.bets;
begin
  select id into v_profile from public.profiles where user_id = auth.uid();
  if v_profile is null then raise exception 'This account is not invited to the board.'; end if;
  if p_status is null or p_status not in ('won', 'lost', 'void', 'cashed_out') then
    raise exception 'Choose won, lost, void or cashed out.';
  end if;

  if p_status = 'cashed_out' then
    if v_text is null or length(v_text) not between 1 and 32 then raise exception 'Enter your cash-out odds.'; end if;
    if p_cashout_odds_format = 'fractional' then
      if v_text !~ '^[0-9]+[[:space:]]*/[[:space:]]*[0-9]+$' then raise exception 'Use fractional cash-out odds like 1/2.'; end if;
      v_num := btrim(split_part(v_text, '/', 1))::numeric;
      v_den := btrim(split_part(v_text, '/', 2))::numeric;
      if v_num not between 1 and 1000000 or v_den not between 1 and 1000000 then raise exception 'Both parts of cash-out odds must be between 1 and 1,000,000.'; end if;
      v_text := v_num::bigint::text || '/' || v_den::bigint::text;
      v_decimal := 1 + v_num / v_den;
    elsif p_cashout_odds_format = 'decimal' then
      if v_text !~ '^[0-9]+([.][0-9]{1,6})?$' then raise exception 'Use decimal cash-out odds like 1.50.'; end if;
      v_decimal := v_text::numeric;
      v_den := power(10::numeric, length(split_part(v_text, '.', 2)));
      v_num := (v_decimal - 1) * v_den;
    else raise exception 'Choose fractional or decimal cash-out odds.';
    end if;
    if v_decimal <= 1 or v_decimal > 1000000 then raise exception 'Cash-out odds must be greater than 1 and at most 1,000,000.'; end if;
  elsif p_cashout_odds_format is not null or p_cashout_odds_text is not null then
    raise exception 'Only enter cash-out odds when cashing out.';
  end if;

  update public.bets set
    status = p_status,
    settled_at = now(),
    profit_pence = case
      when p_status = 'won' then round(stake_pence::numeric * odds_numerator / odds_denominator)::bigint
      when p_status = 'lost' then -stake_pence
      when p_status = 'cashed_out' then round(stake_pence::numeric * v_num / v_den)::bigint
      else 0 end,
    cashout_odds_format = case when p_status = 'cashed_out' then p_cashout_odds_format end,
    cashout_odds_text = case when p_status = 'cashed_out' then v_text end,
    cashout_odds_numerator = case when p_status = 'cashed_out' then v_num end,
    cashout_odds_denominator = case when p_status = 'cashed_out' then v_den end,
    cashout_odds_decimal = case when p_status = 'cashed_out' then v_decimal end
    where id = p_id and profile_id = v_profile and status = 'pending'
    returning * into v_row;
  if v_row.id is null then raise exception 'This bet is no longer active or is not yours. Refresh your bets.'; end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'profit_pence', v_row.profit_pence);
end;
$$;

revoke all on function public.settle_bet(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.settle_bet(uuid, text, text, text) to authenticated;

create or replace function public.get_public_dashboard(p_since date default null)
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
    select profile_id,
      jsonb_agg(jsonb_build_object('day', day, 'staked_pence', staked_pence, 'profit_pence', profit_pence) order by day) as days,
      sum(staked_pence) as staked_pence, sum(profit_pence) as profit_pence
    from daily group by profile_id
  ), counts as (
    select profile_id,
      count(*) filter (where status = 'pending') as pending_count,
      coalesce(sum(stake_pence) filter (where status = 'pending'), 0) as pending_pence,
      count(*) filter (where status = 'won' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as wins,
      count(*) filter (where status = 'lost' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as losses,
      count(*) filter (where status = 'void' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as voids,
      count(*) filter (where status = 'cashed_out' and (p_since is null or (settled_at at time zone 'Europe/London')::date >= p_since)) as cashed_out
    from public.bets group by profile_id
  ), career as (
    select profile_id,
      count(*) filter (where status <> 'pending') as bets_count,
      coalesce(sum(stake_pence) filter (where status <> 'pending'), 0) as staked_pence,
      coalesce(sum(profit_pence) filter (where status <> 'pending'), 0) as profit_pence,
      count(*) filter (where status = 'won') as wins,
      count(*) filter (where status = 'lost') as losses,
      count(*) filter (where status = 'void') as voids,
      count(*) filter (where status = 'cashed_out') as cashed_out,
      coalesce(avg(odds_decimal) filter (where status <> 'pending'), 0) as average_odds,
      coalesce(max(profit_pence) filter (where status = 'won'), 0) as biggest_win_pence
    from public.bets group by profile_id
  ), career_day as (
    select profile_id, (settled_at at time zone 'Europe/London')::date as day, sum(profit_pence) as profit_pence
    from public.bets where status <> 'pending' group by profile_id, (settled_at at time zone 'Europe/London')::date
  ), career_day_best as (
    select profile_id, greatest(0, max(profit_pence)) as best_day_profit_pence
    from career_day group by profile_id
  ), decisive AS (
    select profile_id, id, status, settled_at,
      lag(status) over (partition by profile_id order by settled_at, id) as previous_status,
      row_number() over (partition by profile_id order by settled_at desc, id desc) as newest
    from public.bets where status in ('won', 'lost')
  ), streak_members AS (
    select profile_id, id, status, settled_at, newest,
      sum(case when previous_status is distinct from status then 1 else 0 end)
        over (partition by profile_id order by settled_at, id rows between unbounded preceding and current row) as streak_group
    from decisive
  ), streak_groups AS (
    select profile_id, status, streak_group, count(*) as streak_count,
      max(settled_at) as last_settled, bool_or(newest = 1) as is_current
    from streak_members group by profile_id, status, streak_group
  ), streak_stats AS (
    select profile_id,
      coalesce(max(streak_count) filter (where status = 'won'), 0) as longest_win_streak,
      coalesce(max(streak_count) filter (where is_current), 0) as current_streak,
      max(status) filter (where is_current) as current_streak_status
    from streak_groups group by profile_id
  ), recent AS (
    select profile_id, (array_agg(status order by settled_at desc, id desc))[1:5] as recent_results
    from (select profile_id, id, status, settled_at, row_number() over (partition by profile_id order by settled_at desc, id desc) as rn
      from public.bets where status <> 'pending') r where rn <= 5 group by profile_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'display_name', p.display_name,
    'days', coalesce(s.days, '[]'::jsonb), 'staked_pence', coalesce(s.staked_pence, 0),
    'profit_pence', coalesce(s.profit_pence, 0), 'pending_count', coalesce(c.pending_count, 0),
    'pending_pence', coalesce(c.pending_pence, 0), 'wins', coalesce(c.wins, 0),
    'losses', coalesce(c.losses, 0), 'voids', coalesce(c.voids, 0), 'cashed_out', coalesce(c.cashed_out, 0),
    'career', jsonb_build_object(
      'bets_count', coalesce(k.bets_count, 0), 'staked_pence', coalesce(k.staked_pence, 0),
      'profit_pence', coalesce(k.profit_pence, 0), 'wins', coalesce(k.wins, 0),
      'losses', coalesce(k.losses, 0), 'voids', coalesce(k.voids, 0),
      'cashed_out', coalesce(k.cashed_out, 0), 'average_odds', coalesce(k.average_odds, 0),
      'biggest_win_pence', coalesce(k.biggest_win_pence, 0), 'best_day_profit_pence', coalesce(b.best_day_profit_pence, 0),
      'longest_win_streak', coalesce(x.longest_win_streak, 0),
      'current_streak', coalesce(x.current_streak, 0), 'current_streak_status', x.current_streak_status,
      'recent_results', to_jsonb(coalesce(r.recent_results, array[]::text[]))
    )
  ) order by array_position(array['zac', 'adrian', 'dylan', 'sam'], p.slug)), '[]'::jsonb)
  from public.profiles p
    left join series s on s.profile_id = p.id
    left join counts c on c.profile_id = p.id
    left join career k on k.profile_id = p.id
    left join career_day_best b on b.profile_id = p.id
    left join streak_stats x on x.profile_id = p.id
    left join recent r on r.profile_id = p.id;
$$;

revoke all on function public.get_public_dashboard(date) from public, anon, authenticated;
grant execute on function public.get_public_dashboard(date) to anon, authenticated;

commit;
