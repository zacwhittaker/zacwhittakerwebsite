import { createClient } from "@supabase/supabase-js";
import { PLAYERS, aggregateBets, periodStart } from "./domain.js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isDemo = !url && !key;
export const configurationError =
  !isDemo && (!url || !key || !/^https:\/\//.test(url))
    ? "The live board is not ready yet. Please try again later."
    : null;
export const client =
  !isDemo && !configurationError ? createClient(url, key) : null;

const demoProfiles = PLAYERS.map((player, i) => ({
  id: `demo-${i}`,
  slug: player.slug,
  display_name: player.name,
}));
const descriptions = [
  "Arsenal to win",
  "Over 2.5 goals · Saturday fixtures",
  "Both teams to score",
  "Home win · Premier League",
  "Weekend accumulator",
  "Away team to win",
  "Draw at full time",
  "First-half over 1.5 goals",
];
const records = [];
const history = [
  [
    "won",
    "lost",
    "won",
    "lost",
    "won",
    "won",
    "lost",
    "won",
    "lost",
    "won",
    "lost",
    "won",
  ],
  [
    "lost",
    "won",
    "lost",
    "lost",
    "won",
    "lost",
    "won",
    "lost",
    "lost",
    "won",
    "won",
    "lost",
  ],
  [
    "won",
    "lost",
    "lost",
    "won",
    "lost",
    "won",
    "lost",
    "lost",
    "won",
    "lost",
    "lost",
    "won",
  ],
  [
    "lost",
    "lost",
    "won",
    "lost",
    "won",
    "lost",
    "lost",
    "void",
    "won",
    "lost",
    "lost",
    "lost",
  ],
];
for (const [index, profile] of demoProfiles.entries()) {
  history[index].forEach((status, i) => {
    const placed = new Date();
    placed.setDate(placed.getDate() - 34 + i * 3);
    placed.setHours(11, 0, 0, 0);
    const settled = new Date(placed);
    settled.setHours(19, 0, 0, 0);
    records.push({
      id: `sample-${index}-${i}`,
      profile_id: profile.id,
      description: descriptions[(i + index) % descriptions.length],
      stake_pence: [1000, 500, 1500, 1000][(i + index) % 4],
      odds_format: "fractional",
      odds_text: ["3/2", "2/1", "5/2", "4/5"][(i + index) % 4],
      status,
      placed_at: placed.toISOString(),
      settled_at: settled.toISOString(),
    });
  });
  records.push({
    id: `sample-open-${index}`,
    profile_id: profile.id,
    description: [
      "Saturday match · Home win",
      "Weekend double",
      "Both teams to score · Sunday",
      "Over 2.5 goals · Evening fixture",
    ][index],
    stake_pence: [1500, 1000, 500, 1000][index],
    odds_format: "decimal",
    odds_text: "2.5",
    status: "pending",
    placed_at: new Date().toISOString(),
    settled_at: null,
  });
}
let demoProfile = null;
const wait = () => new Promise((resolve) => setTimeout(resolve, 180));

function ensureReady() {
  if (configurationError) throw new Error(configurationError);
}

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function dashboard(period) {
  ensureReady();
  const since = periodStart(period);
  if (isDemo) {
    await wait();
    return aggregateBets(demoProfiles, records, since);
  }
  return unwrap(await client.rpc("get_public_dashboard", { p_since: since }));
}

export async function currentProfile() {
  ensureReady();
  if (isDemo) return demoProfile;
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) throw error;
  if (!session) return null;
  const profile = unwrap(
    await client.from("profiles").select("id,slug,display_name").maybeSingle(),
  );
  if (!profile)
    throw new Error(
      "This account has not been linked to the board. Ask Zac to finish your invitation.",
    );
  return profile;
}

export async function signIn(email, password) {
  ensureReady();
  if (!client)
    throw new Error(
      "Live accounts are not available in this preview. Use Try the demo.",
    );
  unwrap(await client.auth.signInWithPassword({ email, password }));
  return currentProfile();
}

export async function signOut() {
  if (isDemo) {
    demoProfile = null;
    return;
  }
  if (client) unwrap(await client.auth.signOut());
}

export function selectDemoProfile(slug) {
  if (!isDemo) return null;
  demoProfile = demoProfiles.find((profile) => profile.slug === slug) || null;
  return demoProfile;
}

export async function loadBets(profileId) {
  ensureReady();
  if (isDemo) {
    await wait();
    return records
      .filter((bet) => bet.profile_id === profileId)
      .sort((a, b) => b.placed_at.localeCompare(a.placed_at));
  }
  // Page through the ledger rather than silently losing bets at the API's row limit.
  const result = [];
  for (let from = 0; ; from += 500) {
    const batch = unwrap(
      await client
        .from("bets")
        .select(
          "id,profile_id,description,stake_pence,odds_format,odds_text,status,placed_at,settled_at,profit_pence,cashout_odds_format,cashout_odds_text",
        )
        .eq("profile_id", profileId)
        .order("placed_at", { ascending: false })
        .order("id")
        .range(from, from + 499),
    );
    result.push(...batch);
    if (batch.length < 500) return result;
  }
}

export async function addBet(profileId, values) {
  ensureReady();
  if (isDemo) {
    await wait();
    if (profileId !== demoProfile?.id)
      throw new Error("Choose a demo profile first.");
    const existing = records.find((bet) => bet.id === values.id);
    if (existing) return existing;
    const bet = {
      ...values,
      profile_id: profileId,
      status: "pending",
      settled_at: null,
    };
    records.push(bet);
    return bet;
  }
  return unwrap(
    await client.rpc("create_bet", {
      p_id: values.id,
      p_description: values.description,
      p_stake_pence: values.stake_pence,
      p_odds_format: values.odds_format,
      p_odds_text: values.odds_text,
      p_placed_at: values.placed_at,
    }),
  );
}

export async function settleBet(id, status, cashoutOdds = null) {
  ensureReady();
  if (isDemo) {
    await wait();
    const bet = records.find(
      (row) => row.id === id && row.profile_id === demoProfile?.id,
    );
    if (!bet || bet.status !== "pending")
      throw new Error(
        "This bet is no longer active. Refresh your bets and try again.",
      );
    if (!["won", "lost", "void", "cashed_out"].includes(status))
      throw new Error("Choose a result.");
    if (status === "cashed_out") {
      if (!cashoutOdds) throw new Error("Enter your cash-out odds.");
      bet.cashout_odds_format = cashoutOdds.format;
      bet.cashout_odds_text = cashoutOdds.text;
    }
    bet.status = status;
    bet.settled_at = new Date().toISOString();
    return bet;
  }
  return unwrap(await client.rpc("settle_bet", {
    p_id: id,
    p_status: status,
    p_cashout_odds_format: cashoutOdds?.format ?? null,
    p_cashout_odds_text: cashoutOdds?.text ?? null,
  }));
}

export async function resetPassword(email) {
  if (!client)
    throw new Error("Password resets are not available in the preview.");
  unwrap(
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/?auth=recovery`,
    }),
  );
}

export async function updatePassword(password) {
  if (!client)
    throw new Error("Live accounts are not available in this preview.");
  unwrap(await client.auth.updateUser({ password }));
}
