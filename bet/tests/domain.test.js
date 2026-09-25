import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOdds,
  parseStake,
  profitPence,
  resultPence,
  aggregateBets,
  periodStart,
  cumulativeSeries,
  ukDay,
} from "../src/domain.js";

test("fractional and decimal odds produce equal, penny-accurate returns", () => {
  for (const [fraction, decimal, expected] of [
    ["3/2", "2.50", 1500],
    ["10/11", "1.909091", 909],
    ["4/5", "1.8", 800],
  ]) {
    assert.equal(
      profitPence(1000, parseOdds("fractional", fraction)),
      expected,
    );
    assert.equal(profitPence(1000, parseOdds("decimal", decimal)), expected);
  }
  assert.equal(
    profitPence(3, parseOdds("fractional", "1/6")),
    1,
    "half a penny rounds up without floating-point drift",
  );
  assert.equal(profitPence(1, parseOdds("fractional", "1/3")), 0);
  assert.equal(
    profitPence(100000000, parseOdds("decimal", "1000000")),
    99999900000000,
  );
});

test("invalid odds and stakes cannot produce valid bets", () => {
  for (const value of ["0", "-1", "1.001", "NaN", "1e3", "", "1000000.01"])
    assert.throws(() => parseStake(value));
  assert.equal(parseStake("10.05"), 1005);
  assert.equal(parseStake("0.01"), 1);
  for (const value of ["1/0", "0/1", "-1/2", "2/3/4", "1.5/2", "1000001/1"])
    assert.throws(() => parseOdds("fractional", value));
  for (const value of [
    "1",
    "0.5",
    "NaN",
    "Infinity",
    "2.1234567",
    "1e3",
    "1000001",
  ])
    assert.throws(() => parseOdds("decimal", value));
});

test("pending, lost, won and void results count correctly", () => {
  const bet = {
    stake_pence: 1000,
    odds_format: "fractional",
    odds_text: "3/2",
  };
  assert.equal(resultPence(bet, "pending"), 0);
  assert.equal(resultPence(bet, "won"), 1500);
  assert.equal(resultPence(bet, "lost"), -1000);
  assert.equal(resultPence(bet, "void"), 0);
});

test("UK date boundaries and periods follow London daylight saving time", () => {
  assert.equal(ukDay("2026-07-01T23:30:00Z"), "2026-07-02");
  assert.equal(ukDay("2026-01-01T23:30:00Z"), "2026-01-01");
  assert.equal(periodStart("7", "2026-07-01T23:30:00Z"), "2026-06-26");
  assert.equal(periodStart("all"), null);
});

test("period metrics separate placement, settlement and all-date open exposure", () => {
  const profiles = [
    { id: "p1", slug: "zac", display_name: "Zac" },
    { id: "p2", slug: "sam", display_name: "Sam" },
  ];
  const base = {
    profile_id: "p1",
    stake_pence: 1000,
    odds_format: "fractional",
    odds_text: "3/2",
    placed_at: "2026-05-01T12:00:00Z",
    settled_at: null,
  };
  const bets = [
    { ...base, status: "pending" },
    { ...base, status: "won", settled_at: "2026-06-05T12:00:00Z" },
    { ...base, status: "lost", settled_at: "2026-05-02T12:00:00Z" },
    {
      ...base,
      status: "void",
      placed_at: "2026-06-01T12:00:00Z",
      settled_at: "2026-06-03T12:00:00Z",
    },
  ];
  const [zac, sam] = aggregateBets(profiles, bets, "2026-06-01");
  assert.equal(zac.staked_pence, 1000);
  assert.equal(zac.profit_pence, 1500);
  assert.equal(zac.pending_pence, 1000);
  assert.equal(zac.wins, 1);
  assert.equal(zac.losses, 0);
  assert.equal(zac.voids, 1);
  assert.equal(sam.days.length, 0);
  assert.equal(sam.profit_pence, 0);
  const points = cumulativeSeries(zac.days, "2026-06-01", "2026-06-10");
  assert.equal(points[0].profit, 0);
  assert.equal(points.at(-1).profit, 1500);
  assert.equal(points.at(-1).stake, 1000);
  assert.equal(points.at(-1).day, "2026-06-10");
});
