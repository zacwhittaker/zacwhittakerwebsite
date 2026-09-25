export const PLAYERS = [
  { slug: "zac", name: "Zac", initials: "ZW", color: "#d5fc6e", motif: "01" },
  {
    slug: "adrian",
    name: "Adrian",
    initials: "A",
    color: "#85d9fa",
    motif: "02",
  },
  {
    slug: "dylan",
    name: "Dylan",
    initials: "D",
    color: "#baa6ff",
    motif: "03",
  },
  { slug: "sam", name: "Sam", initials: "S", color: "#ffb48b", motif: "04" },
];

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

export function money(pence, signed = false) {
  const value = Number(pence || 0);
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(Math.abs(value) / 100);
  return `${value < 0 ? "−" : signed && value > 0 ? "+" : ""}${formatted}`;
}

export function parseStake(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Enter a stake in pounds, with up to two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(pence) || pence < 1 || pence > 100000000)
    throw new Error("Enter a stake between £0.01 and £1,000,000.");
  return pence;
}

export function parseOdds(format, value) {
  const text = String(value).trim();
  let numerator;
  let denominator;
  let normalized;
  if (format === "fractional") {
    const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) throw new Error("Use fractional odds like 5/2 or 10/11.");
    numerator = Number(match[1]);
    denominator = Number(match[2]);
    if (
      !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator) ||
      numerator < 1 ||
      denominator < 1 ||
      numerator > 1000000 ||
      denominator > 1000000
    )
      throw new Error(
        "Both parts of fractional odds must be between 1 and 1,000,000.",
      );
    normalized = `${numerator}/${denominator}`;
  } else if (format === "decimal") {
    if (!/^\d+(\.\d{1,6})?$/.test(text))
      throw new Error(
        "Use decimal odds like 2.50, with up to six decimal places.",
      );
    const [whole, fraction = ""] = text.split(".");
    denominator = 10 ** fraction.length;
    numerator =
      Number(whole) * denominator + Number(fraction || 0) - denominator;
    normalized = String(Number(text));
  } else throw new Error("Choose fractional or decimal odds.");
  const decimal = 1 + numerator / denominator;
  if (!Number.isSafeInteger(numerator) || decimal <= 1 || decimal > 1000000)
    throw new Error(
      "Decimal odds must be greater than 1 and at most 1,000,000.",
    );
  return { format, text: normalized, decimal, numerator, denominator };
}

export function profitPence(stake, odds) {
  const numerator = BigInt(stake) * BigInt(odds.numerator);
  const denominator = BigInt(odds.denominator);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

export function resultPence(bet, status = bet.status) {
  if (status === "lost") return -Number(bet.stake_pence);
  if (status === "cashed_out")
    return profitPence(
      Number(bet.stake_pence),
      parseOdds(bet.cashout_odds_format, bet.cashout_odds_text),
    );
  if (status === "won")
    return profitPence(
      Number(bet.stake_pence),
      parseOdds(bet.odds_format, bet.odds_text),
    );
  return 0;
}

export function ukDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function periodStart(period, now = new Date()) {
  if (period === "all") return null;
  const day = new Date(`${ukDay(now)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - Number(period) + 1);
  return day.toISOString().slice(0, 10);
}

export function aggregateBets(profiles, bets, since = null) {
  return profiles.map((profile) => {
    const own = bets.filter((bet) => bet.profile_id === profile.id);
    const days = new Map();
    const add = (date, stake, profit) => {
      const day = ukDay(date);
      if (since && day < since) return;
      const record = days.get(day) || { day, staked_pence: 0, profit_pence: 0 };
      record.staked_pence += stake;
      record.profit_pence += profit;
      days.set(day, record);
    };
    own.forEach((bet) => {
      add(bet.placed_at, bet.stake_pence, 0);
      if (bet.status !== "pending") add(bet.settled_at, 0, resultPence(bet));
    });
    const placed = own.filter((bet) => !since || ukDay(bet.placed_at) >= since);
    const settled = own.filter(
      (bet) =>
        bet.status !== "pending" && (!since || ukDay(bet.settled_at) >= since),
    );
    const pending = own.filter((bet) => bet.status === "pending");
    const careerPlaced = own;
    const careerSettled = careerPlaced.filter((bet) => bet.status !== "pending");
    const careerDayTotals = new Map();
    for (const bet of careerSettled) {
      const day = ukDay(bet.settled_at);
      careerDayTotals.set(day, (careerDayTotals.get(day) || 0) + resultPence(bet));
    }
    const runResults = [...careerSettled]
      .filter((bet) => bet.status === "won" || bet.status === "lost")
      .sort((a, b) => a.settled_at.localeCompare(b.settled_at));
    let longestWinStreak = 0;
    let runLength = 0;
    let previousStatus = null;
    for (const bet of runResults) {
      runLength = bet.status === "won" ? (previousStatus === "won" ? runLength + 1 : 1) : 0;
      longestWinStreak = Math.max(longestWinStreak, runLength);
      previousStatus = bet.status;
    }
    const latestResult = [...careerSettled].sort((a, b) => b.settled_at.localeCompare(a.settled_at));
    const recentResults = latestResult.slice(0, 5).map((bet) => bet.status);
    const latestDecisive = latestResult.find((bet) => bet.status === "won" || bet.status === "lost");
    let currentStreak = 0;
    if (latestDecisive) {
      for (const bet of [...runResults].reverse()) {
        if (bet.status !== latestDecisive.status) break;
        currentStreak += 1;
      }
    }
    const careerAverageOdds = careerSettled.length
      ? careerSettled.reduce((sum, bet) => sum + parseOdds(bet.odds_format, bet.odds_text).decimal, 0) / careerSettled.length
      : 0;
    return {
      ...profile,
      days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      staked_pence: placed.reduce((sum, bet) => sum + bet.stake_pence, 0),
      profit_pence: settled.reduce((sum, bet) => sum + resultPence(bet), 0),
      pending_pence: pending.reduce((sum, bet) => sum + bet.stake_pence, 0),
      pending_count: pending.length,
      wins: settled.filter((bet) => bet.status === "won").length,
      losses: settled.filter((bet) => bet.status === "lost").length,
      voids: settled.filter((bet) => bet.status === "void").length,
      cashed_out: settled.filter((bet) => bet.status === "cashed_out").length,
      career: {
        bets_count: careerSettled.length,
        staked_pence: careerSettled.reduce((sum, bet) => sum + bet.stake_pence, 0),
        profit_pence: careerSettled.reduce((sum, bet) => sum + resultPence(bet), 0),
        wins: careerSettled.filter((bet) => bet.status === "won").length,
        losses: careerSettled.filter((bet) => bet.status === "lost").length,
        voids: careerSettled.filter((bet) => bet.status === "void").length,
        cashed_out: careerSettled.filter((bet) => bet.status === "cashed_out").length,
        average_odds: careerAverageOdds,
        biggest_win_pence: careerSettled.reduce((best, bet) => bet.status === "won" ? Math.max(best, resultPence(bet)) : best, 0),
        best_day_profit_pence: Math.max(0, ...careerDayTotals.values()),
        longest_win_streak: longestWinStreak,
        current_streak: currentStreak,
        current_streak_status: latestDecisive?.status || null,
        recent_results: recentResults,
      },
    };
  });
}

export function cumulativeSeries(days, since = null, today = ukDay()) {
  const ordered = [...days].sort((a, b) => a.day.localeCompare(b.day));
  let stake = 0;
  let profit = 0;
  const start = since || ordered[0]?.day || today;
  const baseline = new Date(`${start}T12:00:00Z`);
  baseline.setUTCDate(baseline.getUTCDate() - 1);
  const points = [
    { day: baseline.toISOString().slice(0, 10), stake: 0, profit: 0 },
  ];
  for (const day of ordered) {
    stake += Number(day.staked_pence);
    profit += Number(day.profit_pence);
    points.push({ day: day.day, stake, profit });
  }
  if (points.at(-1).day < today) points.push({ day: today, stake, profit });
  return points;
}
