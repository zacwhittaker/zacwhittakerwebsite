import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const zac = "10000000-0000-4000-8000-000000000001";
const adrian = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000099";
const betId = "20000000-0000-4000-8000-000000000001";
const placed = new Date(Date.now() - 600000).toISOString();

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${zac}'), ('${adrian}'), ('${outsider}');`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609250001_bet_board.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("update public.profiles set user_id = $1 where slug = 'zac'", [
    zac,
  ]);
  await db.query(
    "update public.profiles set user_id = $1 where slug = 'adrian'",
    [adrian],
  );
});
beforeEach(async () => {
  await db.exec("reset role; truncate public.bets;");
});
after(async () => {
  await db?.close();
});

async function actAs(user) {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    user || "",
  ]);
  await db.exec(`set role ${user ? "authenticated" : "anon"};`);
}
async function create(overrides = {}) {
  const args = {
    id: betId,
    description: "Test selection",
    stake: 1000,
    format: "fractional",
    odds: "3/2",
    placed,
    ...overrides,
  };
  return db.query(
    "select public.create_bet($1,$2,$3,$4,$5,$6) as bet",
    Object.values(args),
  );
}
async function publicData() {
  return (await db.query("select public.get_public_dashboard() as data"))
    .rows[0].data;
}

test("anonymous viewers get four empty aggregates and no raw records or mutations", async () => {
  await actAs(null);
  const data = await publicData();
  assert.deepEqual(
    data.map((p) => p.slug),
    ["zac", "adrian", "dylan", "sam"],
  );
  assert.equal(data[0].profit_pence, 0);
  await assert.rejects(
    db.query("select description from public.bets"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select user_id from public.profiles"),
    /permission denied/,
  );
  await assert.rejects(create(), /permission denied/);
  await assert.rejects(
    db.query("select public.settle_bet($1,'won')", [betId]),
    /permission denied/,
  );
});

test("account mapping and RLS isolate players, including uninvited authenticated users", async () => {
  await actAs(zac);
  await create();
  assert.equal((await db.query("select id from public.bets")).rows.length, 1);
  await assert.rejects(
    db.query("select user_id from public.profiles"),
    /permission denied/,
  );
  await actAs(adrian);
  assert.equal((await db.query("select id from public.bets")).rows.length, 0);
  await assert.rejects(
    db.query("select public.settle_bet($1,'won')", [betId]),
    /not yours/,
  );
  await actAs(outsider);
  assert.equal(
    (await db.query("select id from public.profiles")).rows.length,
    0,
  );
  await assert.rejects(create(), /not invited/);
});

test("direct writes are denied and idempotent submission creates one bet", async () => {
  await actAs(zac);
  await create();
  await create();
  assert.equal((await db.query("select id from public.bets")).rows.length, 1);
  await assert.rejects(
    create({ stake: 2000 }),
    /already saved with different details/,
  );
  await assert.rejects(
    db.query("update public.bets set status='won' where id=$1", [betId]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("delete from public.bets where id=$1", [betId]),
    /permission denied/,
  );
  await assert.rejects(
    db.query("update public.profiles set display_name='Other'"),
    /permission denied/,
  );
});

test("server validates money, dates and odds independently of the browser", async () => {
  await actAs(zac);
  await assert.rejects(create({ stake: 0 }), /Enter a stake/);
  await assert.rejects(create({ odds: "1/0" }), /Both parts/);
  await assert.rejects(
    create({ format: "decimal", odds: "1" }),
    /greater than 1/,
  );
  await assert.rejects(
    create({ format: "decimal", odds: "2.1234567" }),
    /six decimal places/,
  );
  await assert.rejects(create({ placed: "2099-01-01" }), /Choose a date/);
  await assert.rejects(create({ description: " " }), /bet description/);
});

test("settlement computes accurate profit once and publishes only aggregates", async () => {
  await actAs(zac);
  await create({ stake: 3, odds: "1/6" });
  const result = await db.query("select public.settle_bet($1,'won') as bet", [
    betId,
  ]);
  assert.equal(result.rows[0].bet.profit_pence, 1);
  await assert.rejects(
    db.query("select public.settle_bet($1,'lost')", [betId]),
    /no longer active/,
  );
  await actAs(null);
  const data = await publicData();
  assert.equal(data[0].profit_pence, 1);
  assert.equal(data[0].wins, 1);
  assert.equal(data[0].pending_count, 0);
  assert.equal(data[0].staked_pence, 3);
  assert.equal(JSON.stringify(data).includes("Test selection"), false);
  assert.equal(JSON.stringify(data).includes(zac), false);
  assert.equal(JSON.stringify(data).includes(betId), false);
});

test("loss and void totals are correct and periods retain all-date open exposure", async () => {
  await actAs(zac);
  await create({ placed: "2020-01-01T12:00:00Z" });
  await create({ id: "20000000-0000-4000-8000-000000000002" });
  await create({
    id: "20000000-0000-4000-8000-000000000003",
    format: "decimal",
    odds: "2.50",
  });
  await db.query("select public.settle_bet($1,'lost')", [
    "20000000-0000-4000-8000-000000000002",
  ]);
  await db.query("select public.settle_bet($1,'void')", [
    "20000000-0000-4000-8000-000000000003",
  ]);
  const data = (
    await db.query("select public.get_public_dashboard('2021-01-01') as data")
  ).rows[0].data;
  assert.equal(data[0].profit_pence, -1000);
  assert.equal(data[0].staked_pence, 2000);
  assert.equal(data[0].pending_pence, 1000);
  assert.equal(data[0].losses, 1);
  assert.equal(data[0].voids, 1);
});
