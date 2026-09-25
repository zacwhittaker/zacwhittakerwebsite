import "./styles.css";
import * as api from "./api.js";
import {
  PLAYERS,
  escapeHtml as esc,
  money,
  parseStake,
  parseOdds,
  profitPence,
  resultPence,
} from "./domain.js";
import { chartMarkup, bindCharts, dataTable } from "./charts.js";

const $ = (selector) => document.querySelector(selector);
const state = {
  period: "all",
  showStakes: true,
  players: [],
  activePlayer: PLAYERS[0].slug,
  profile: null,
  bets: [],
  betFilter: "pending",
  pending: false,
  request: 0,
  betsRequest: 0,
};
const dialog = $("#app-dialog");
const originalUrl = new URL(location.href);
let passwordIntent =
  originalUrl.searchParams.get("auth") === "recovery" ||
  /type=(invite|recovery)/.test(originalUrl.hash);
let toastTimer;

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function openDialog(content) {
  $("#dialog-content").innerHTML = content;
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    dialog.querySelector("[autofocus]")?.focus();
  });
}

function closeDialog() {
  if (!state.pending) dialog.close();
}
$("#close-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => {
  if (
    event.target === dialog &&
    !dialog.querySelector(".dialog-inner").contains(event.target)
  )
    closeDialog();
});
dialog.addEventListener("cancel", (event) => {
  if (state.pending) event.preventDefault();
});

function errorMessage(error) {
  if (error?.message === "Invalid login credentials")
    return "That email and password don’t match. Please try again.";
  if (error?.status === 429)
    return "Too many attempts. Please wait a little before trying again.";
  if (/fetch|network/i.test(error?.message || ""))
    return "We couldn’t connect. Check your connection and try again.";
  if (
    error?.code &&
    ![
      "P0001",
      "invalid_credentials",
      "weak_password",
      "validation_failed",
    ].includes(error.code)
  )
    return "That didn’t go through. Please try again.";
  return error?.message || "Something went wrong. Please try again.";
}

async function submit(form, action) {
  if (state.pending) return;
  const button = form.querySelector('[type="submit"]');
  const original = button.innerHTML;
  state.pending = true;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> One moment';
  $("#close-dialog").disabled = true;
  form.querySelector(".form-error").textContent = "";
  try {
    await action();
  } catch (error) {
    form.querySelector(".form-error").textContent = errorMessage(error);
  } finally {
    state.pending = false;
    button.disabled = false;
    button.innerHTML = original;
    $("#close-dialog").disabled = false;
  }
}

function renderAccount() {
  const player = PLAYERS.find((p) => p.slug === state.profile?.slug);
  renderPlayerNavigation();
  $("#account-controls").innerHTML = state.profile
    ? `<div class="profile-control"><button class="profile-button" id="profile-toggle" aria-label="Open ${esc(state.profile.display_name)} profile menu" aria-expanded="false" aria-controls="profile-menu"><span class="mini-avatar" style="--accent:${player.color}">${player.initials}</span><span>${esc(state.profile.display_name)}</span><span class="chevron">⌄</span></button><div class="profile-menu" id="profile-menu" hidden><span class="menu-label">${api.isDemo ? "DEMO PROFILE" : "YOUR ACCOUNT"}</span><button class="profile-add-bet" data-action="add-bet"><span>＋</span><span>Add a bet<small>Log a new pick</small></span><span class="menu-arrow">↗</span></button><a href="#bets">◫ My bets <span id="nav-count"></span></a>${api.isDemo ? '<button data-action="demo">⇄ Switch demo profile</button>' : ""}<button data-action="sign-out">${api.isDemo ? "Exit demo profile" : "Sign out"}</button></div></div>`
    : `<button class="button small sign-in-button" data-action="sign-in"><span class="person-icon" aria-hidden="true">♙</span> Sign in <span aria-hidden="true">↗</span></button>`;
  $("#profile-toggle")?.addEventListener("click", () => {
    const menu = $("#profile-menu");
    menu.hidden = !menu.hidden;
    $("#profile-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  });
  $("#demo-start").textContent = state.profile
    ? "Switch demo profile ↗"
    : "Try the demo ↗";
}

function renderPlayerNavigation() {
  $("#player-navigation").innerHTML = PLAYERS.map((player, index) => {
    const profile = state.players.find((item) => item.slug === player.slug);
    const active = player.slug === state.activePlayer;
    return `<a href="#${player.slug}" class="player-tab ${active ? "active" : ""}" data-player="${player.slug}" style="--accent:${player.color}" ${active ? 'aria-current="page"' : ""}><span class="tab-identity"><i></i>${player.name}</span><span class="tab-score">${profile ? money(profile.profit_pence, true) : "—"}</span><span class="sr-only">Player ${index + 1} of 4</span></a>`;
  }).join("");
}

function route() {
  if (location.hash === "#main") return;
  const bets = location.hash === "#bets" && !!state.profile;
  const requestedPlayer = location.hash.slice(1);
  if (!bets && PLAYERS.some((player) => player.slug === requestedPlayer)) state.activePlayer = requestedPlayer;
  else if (!bets && !PLAYERS.some((player) => player.slug === state.activePlayer)) state.activePlayer = PLAYERS[0].slug;
  $("#overview-page").hidden = bets;
  $("#bets-page").hidden = !bets;
  renderPlayerNavigation();
  if (!bets) renderCharts(false);
  if (bets) refreshBets();
}
window.addEventListener("hashchange", route);

function renderCharts(animate = true) {
  const existingFocus = document.activeElement?.closest(".player-main-card") != null;
  const profile = state.players.find((item) => item.slug === state.activePlayer);
  const player = PLAYERS.find((item) => item.slug === state.activePlayer) || PLAYERS[0];
  $("#period-note").textContent =
    `Cumulative results · ${state.period === "all" ? "All time" : `Last ${state.period} days, starting at £0`} · GBP`;
  $("#page-title").innerHTML = `${esc(player.name)} <span>· ${player.motif}</span>`;
  $("#player-subtitle").textContent = `${profile?.career?.bets_count || 0} settled bets. Every up, every down, all in one view.`;
  $("#profile-number").textContent = player.motif;
  if (!profile) {
    $("#player-grid").innerHTML = '<div class="empty-state loading-profile"><span class="empty-icon">↗</span><h3>Loading player profile…</h3></div>';
    return;
  }
  const career = profile.career || {};
  const settledCount = Number(career.bets_count || 0);
  const decisive = Number(career.wins || 0) + Number(career.losses || 0);
  const winRate = decisive ? Math.round((Number(career.wins) / decisive) * 100) : 0;
  const roi = career.staked_pence ? (Number(career.profit_pence) / Number(career.staked_pence)) * 100 : 0;
  const bestDay = Number(career.best_day_profit_pence || 0);
  const streak = Number(career.current_streak || 0);
  const runWord = career.current_streak_status === "won" ? "win" : career.current_streak_status === "lost" ? "loss" : "run";
  const results = (career.recent_results || []).map((status) => ({ won: ["W", "Won", "✓"], lost: ["L", "Lost", "↘"], void: ["V", "Void", "—"], cashed_out: ["CO", "Cashed out", "↗"] }[status] || ["?", "Unknown", "?"]));
  $("#player-grid").innerHTML = `<article class="player-main-card ${animate ? "animate-chart" : ""}" data-slug="${player.slug}" style="--accent:${player.color};--card-index:${Number(player.motif) - 1}">
    <div class="player-main-heading"><div class="player-identity"><span class="player-avatar">${player.initials}<span class="avatar-corner"></span></span><div><span class="player-number">CAREER PROFILE / ${player.motif}</span><h2>${esc(profile.display_name)}</h2></div></div><div class="headline-result"><span>NET PROFIT <i></i></span><strong class="${Number(profile.profit_pence) < 0 ? "negative" : "positive"}">${money(profile.profit_pence, true)}</strong><small>${state.period === "all" ? "LIFETIME" : `LAST ${state.period} DAYS`}</small></div></div>
    <div class="profile-chart-head"><div><h3>THE FULL RUN</h3><span>Cumulative profit vs. total stake · pounds sterling</span></div><button class="chart-data-button" data-action="chart-data" data-slug="${player.slug}" aria-label="View ${esc(profile.display_name)}’s chart data">View ledger ↗</button></div>
    ${chartMarkup(profile, state.period, state.showStakes)}
    <div class="career-stats-head"><div><h3>THE BODY OF WORK</h3><span>Personal record · all time</span></div><div class="form-run" aria-label="Recent results">${results.length ? results.map(([short, full, symbol]) => `<span class="result-chip status-${full === "Won" ? "won" : full === "Lost" ? "lost" : full === "Void" ? "void" : "cashed_out"}" title="${full}" aria-label="${full}">${symbol}</span>`).join("") : '<span class="muted">No results yet</span>'}</div></div>
    <div class="career-stat-grid">
      <div class="career-stat"><span>WIN RATE</span><strong>${decisive ? `${winRate}%` : "—"}</strong><small>${career.wins || 0} wins · ${career.losses || 0} losses</small><div class="mini-track"><i style="width:${winRate}%"></i></div></div>
      <div class="career-stat"><span>RETURN ON STAKE</span><strong class="${roi < 0 ? "negative" : "positive"}">${settledCount ? `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}</strong><small>${money(career.profit_pence || 0, true)} from ${money(career.staked_pence || 0)} staked</small></div>
      <div class="career-stat"><span>RECORD <i class="record-legend"><b>W</b> / <b>L</b> / <b>V</b></i></span><strong>${career.wins || 0} <i>/</i> ${career.losses || 0} <i>/</i> ${career.voids || 0}</strong><small>${settledCount} settled · ${profile.pending_count} still in play</small></div>
      <div class="career-stat"><span>AVERAGE ODDS</span><strong>${career.average_odds ? `${Number(career.average_odds).toFixed(2)}<i>×</i>` : "—"}</strong><small>Across ${settledCount} resolved bets</small></div>
      <div class="career-stat"><span>BIGGEST WIN</span><strong class="positive">${career.biggest_win_pence ? money(career.biggest_win_pence, true) : "—"}</strong><small>Single bet · net profit</small></div>
      <div class="career-stat"><span>LONGEST WIN STREAK</span><strong>${career.longest_win_streak || 0}<i> in a row</i></strong><small>${streak ? `${streak}-bet ${runWord} currently` : "Waiting for the next result"}</small></div>
      <div class="career-stat"><span>BEST DAY</span><strong class="${bestDay ? "positive" : ""}">${bestDay ? money(bestDay, true) : "—"}</strong><small>Most net profit in one day</small></div>
      <div class="career-stat exposure-stat"><span>OPEN EXPOSURE <i class="small-dot"></i></span><strong>${money(profile.pending_pence || 0)}</strong><small>${profile.pending_count} active ${profile.pending_count === 1 ? "bet" : "bets"}</small></div>
    </div>
  </article>`;
  $("#player-grid").setAttribute("aria-busy", "false");
  bindCharts($("#player-grid"));
  if (existingFocus) $(".player-main-card .chart-wrap")?.focus({ preventScroll: true });
}

let priorData = "";
async function refreshDashboard(animate = false) {
  const id = ++state.request;
  try {
    const players = await api.dashboard(state.period);
    if (id !== state.request) return;
    state.players = players;
    const data = JSON.stringify({ players, period: state.period });
    if (data !== priorData || animate) {
      renderCharts(animate || !priorData);
      priorData = data;
    }
    $("#connection-error").hidden = true;
    $("#data-status").textContent = api.isDemo
      ? "Sample results"
      : "Board connected";
    $("#updated-at").textContent = api.isDemo
      ? "Explore the preview"
      : `Updated ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
  } catch (error) {
    if (id !== state.request) return;
    $("#data-status").textContent = "Connection interrupted";
    $("#connection-error").hidden = false;
    $("#connection-error").innerHTML =
      `<span>${state.players.length ? "Showing the last available results. " : ""}${esc(errorMessage(error))}</span><button class="text-button" data-action="retry">Try again ↻</button>`;
    $("#player-grid").setAttribute("aria-busy", "false");
    if (!state.players.length)
      $("#player-grid").innerHTML =
            '<div class="empty-state"><span class="empty-icon">↗</span><h3>The board is taking a breather.</h3><p>Results will appear here when the connection is back.</p></div>';
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(date));
}

function renderBets() {
  const filtered = state.bets.filter(
    (bet) =>
      state.betFilter === "all" ||
      (state.betFilter === "pending"
        ? bet.status === "pending"
        : bet.status !== "pending"),
  );
  const count = state.bets.filter((bet) => bet.status === "pending").length;
  $("#active-count").textContent = count;
  if ($("#nav-count")) $("#nav-count").textContent = count || "";
  $("#bets-summary").textContent =
    `${filtered.length} ${filtered.length === 1 ? "bet" : "bets"}${api.isDemo ? " · Demo data" : ""}`;
  $("#bets-list").innerHTML = filtered.length
    ? filtered
        .map(
          (bet) =>
            `<article class="bet-row"><div class="bet-result-icon status-${bet.status}" aria-hidden="true">${{ pending: "↗", won: "✓", lost: "↘", void: "—", cashed_out: "⇢" }[bet.status]}</div><div class="bet-description"><span class="bet-date">${formatDate(bet.placed_at)} <span>·</span> ${esc(bet.odds_text)} ${bet.odds_format === "decimal" ? "decimal" : ""}</span><h3>${esc(bet.description)}</h3><span class="bet-status status-${bet.status}">${bet.status === "pending" ? "In play" : bet.status === "void" ? "Void · stake returned" : bet.status === "won" ? "Won" : bet.status === "cashed_out" ? `Cashed out early · ${esc(bet.cashout_odds_text)} ${bet.cashout_odds_format === "decimal" ? "decimal" : "fractional"}` : "Lost"}</span></div><div class="bet-stake"><span class="stat-label">STAKE</span><strong>${money(bet.stake_pence)}</strong></div><div class="bet-return"><span class="stat-label">${bet.status === "pending" ? "POTENTIAL PROFIT" : "NET RESULT"}</span><strong class="${["lost"].includes(bet.status) ? "negative" : ["won", "cashed_out"].includes(bet.status) ? "positive" : ""}">${money(resultPence(bet, bet.status === "pending" ? "won" : bet.status), true)}</strong></div><div class="bet-action">${bet.status === "pending" ? `<button class="button small" data-action="settle" data-id="${esc(bet.id)}">Settle bet ↗</button>` : `<span class="settled-date">Settled<br />${formatDate(bet.settled_at)}</span>`}</div></article>`,
        )
        .join("")
    : `<div class="empty-state"><span class="empty-icon">${state.betFilter === "settled" ? "✓" : "↗"}</span><h3>${state.betFilter === "settled" ? "No settled bets yet." : "Nothing on the line."}</h3><p>${state.betFilter === "settled" ? "Confirm the outcome of an active bet to see it here." : "Open the profile menu to add a bet and keep the full picture in one place."}</p></div>`;
}

async function refreshBets() {
  if (!state.profile) return;
  const id = ++state.betsRequest;
  const profileId = state.profile.id;
  try {
    const bets = await api.loadBets(profileId);
    if (id !== state.betsRequest || profileId !== state.profile?.id) return;
    state.bets = bets;
    renderBets();
  } catch (error) {
    if (id !== state.betsRequest || profileId !== state.profile?.id) return;
    $("#bets-list").innerHTML =
      `<div class="empty-state"><h3>We couldn’t load your bets.</h3><p>${esc(errorMessage(error))}</p><button class="button" data-action="retry-bets">Try again</button></div>`;
  }
}

function demoDialog() {
  openDialog(
    `<p class="eyebrow">TAKE IT FOR A SPIN</p><h2 id="dialog-title">Pick a demo profile.</h2><p class="dialog-subtitle">Try adding a bet, then settle the result. This is sample data; changes disappear when you reload.</p><div class="demo-players">${PLAYERS.map((p) => `<button data-action="choose-demo" data-slug="${p.slug}" style="--accent:${p.color}"><span class="player-avatar">${p.initials}</span><span>${p.name}</span><span>↗</span></button>`).join("")}</div>`,
  );
}

function signInDialog() {
  if (api.isDemo) {
    openDialog(
      '<p class="eyebrow">WELCOME TO BET BOARD</p><h2 id="dialog-title">Your place on the board.</h2><p class="dialog-subtitle">Live accounts aren’t available in this preview. You can explore all the features with a demo profile.</p><button class="button primary full-width" data-action="demo">Try the demo ↗</button>',
    );
    return;
  }
  openDialog(
    '<p class="eyebrow">WELCOME BACK</p><h2 id="dialog-title">Your place on the board.</h2><p class="dialog-subtitle">Sign in with your invited account.</p><form id="sign-in-form"><label>Email address<input name="email" type="email" autocomplete="username" required autofocus placeholder="you@example.com" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Sign in ↗</button><button type="button" class="text-button forgot-button" data-action="forgot-password">Forgot your password?</button></form>',
  );
  $("#sign-in-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      const values = new FormData(form);
      state.profile = await api.signIn(
        values.get("email"),
        values.get("password"),
      );
      renderAccount();
      await refreshBets();
      dialog.close();
      toast(`Welcome back, ${state.profile.display_name}.`);
      route();
    });
  });
}

function passwordDialog() {
  openDialog(
    '<p class="eyebrow">YOUR ACCOUNT</p><h2 id="dialog-title">Set your password.</h2><p class="dialog-subtitle">Use at least 12 characters to keep your account secure.</p><form id="password-form"><label>New password<input name="password" type="password" minlength="12" autocomplete="new-password" required autofocus /></label><label>Confirm password<input name="confirm" type="password" minlength="12" autocomplete="new-password" required /></label><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Save password ↗</button></form>',
  );
  $("#password-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      const values = new FormData(form);
      if (values.get("password") !== values.get("confirm"))
        throw new Error("Your passwords don’t match.");
      await api.updatePassword(values.get("password"));
      passwordIntent = false;
      history.replaceState(null, "", `${location.pathname}#${state.activePlayer}`);
      dialog.close();
      toast("Password saved. You’re ready to go.");
      await syncProfile();
    });
  });
}

function forgotPasswordDialog() {
  openDialog(
    '<p class="eyebrow">BACK IN THE GAME</p><h2 id="dialog-title">Reset your password.</h2><p class="dialog-subtitle">Enter the email address on your invited account.</p><form id="reset-form"><label>Email address<input name="email" type="email" autocomplete="email" required autofocus /></label><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Send reset link ↗</button></form>',
  );
  $("#reset-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      await api.resetPassword(new FormData(form).get("email"));
      openDialog(
        '<p class="eyebrow">CHECK YOUR INBOX</p><h2 id="dialog-title">Link requested.</h2><p class="dialog-subtitle">If that address belongs to an account, you’ll receive a link to set a new password.</p>',
      );
    });
  });
}

function localDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function addBetDialog() {
  if (!state.profile) {
    signInDialog();
    return;
  }
  const id = crypto.randomUUID();
  openDialog(
    `<div class="bet-slip-top"><span class="slip-mark">↗</span><span class="eyebrow">${esc(state.profile.display_name.toUpperCase())}’S BET SLIP ${api.isDemo ? " / DEMO" : ""}</span></div><h2 id="dialog-title">New pick.</h2><p class="dialog-subtitle">Build your ticket. We’ll track the numbers from here.</p><form id="bet-form" class="bet-slip-form"><label class="slip-field">SELECTION<input name="description" required maxlength="240" placeholder="What are you backing?" autofocus /></label><div class="slip-two"><label class="slip-field">STAKE<input name="stake" required type="text" inputmode="decimal" placeholder="£10.00" /></label><label class="slip-field">ODDS FORMAT<select name="odds_format"><option value="fractional">Fractional</option><option value="decimal">Decimal</option></select></label></div><label class="slip-field">YOUR ODDS<input name="odds_text" required type="text" placeholder="5/2" /></label><div class="odds-hint">Your odds set the potential profit on this ticket.</div><details class="slip-timing"><summary>When did you place this?</summary><label>Placed on <span class="label-hint">Your local time</span><input name="placed_at" type="datetime-local" value="${localDateTime()}" max="${localDateTime()}" /></label></details><div class="potential-return"><span>IF IT LANDS <small>Profit · return including stake</small></span><strong id="return-preview">—</strong></div><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Add to active bets ↗</button><p class="form-note">You’ll confirm the result from My bets.</p></form>`,
  );
  const form = $("#bet-form");
  form.addEventListener("input", () => {
    try {
      const values = new FormData(form);
      const stake = parseStake(values.get("stake"));
      const odds = parseOdds(
        values.get("odds_format"),
        values.get("odds_text"),
      );
      $("#return-preview").textContent = money(
        stake + profitPence(stake, odds),
      );
    } catch {
      $("#return-preview").textContent = "—";
    }
  });
  form.elements.odds_format.addEventListener("change", () => {
    form.elements.odds_text.value = "";
    form.elements.odds_text.placeholder =
      form.elements.odds_format.value === "fractional" ? "5/2" : "3.50";
    $("#return-preview").textContent = "—";
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(form, async () => {
      const values = new FormData(form);
      const description = values.get("description").trim();
      if (!description) throw new Error("Tell us what you’re betting on.");
      const stake = parseStake(values.get("stake"));
      const odds = parseOdds(
        values.get("odds_format"),
        values.get("odds_text"),
      );
      const placed = new Date(values.get("placed_at"));
      if (
        !Number.isFinite(placed.getTime()) ||
        placed > new Date() ||
        placed < new Date("2000-01-01T00:00:00Z")
      )
        throw new Error("Choose a date from 2000 up to the current time.");
      await api.addBet(state.profile.id, {
        id,
        description,
        stake_pence: stake,
        odds_format: odds.format,
        odds_text: odds.text,
        placed_at: placed.toISOString(),
      });
      dialog.close();
      toast(
        api.isDemo
          ? "Demo bet added. Ready when you are."
          : "Bet added. It’s on the board.",
      );
      state.betFilter = "pending";
      setBetFilterButtons();
      await Promise.all([refreshDashboard(true), refreshBets()]);
      location.hash = "bets";
    });
  });
}

function settleDialog(id) {
  const bet = state.bets.find((b) => b.id === id && b.status === "pending");
  if (!bet) {
    toast("This bet is no longer active. Refresh your bets.");
    return;
  }
  openDialog(
    `<p class="eyebrow">CLOSE OUT THE RESULT ${api.isDemo ? "/ DEMO" : ""}</p><h2 id="dialog-title">How did it finish?</h2><p class="settle-description">${esc(bet.description)}</p><p class="dialog-subtitle">${money(bet.stake_pence)} staked at ${esc(bet.odds_text)}</p><form id="settle-form"><fieldset class="result-choices"><legend class="sr-only">Bet result</legend><label class="outcome won"><input type="radio" name="status" value="won" required /><span class="outcome-icon">✓</span><strong>Won</strong><small>${money(resultPence(bet, "won"), true)}</small></label><label class="outcome lost"><input type="radio" name="status" value="lost" required /><span class="outcome-icon">↘</span><strong>Lost</strong><small>${money(-bet.stake_pence)}</small></label><label class="outcome void"><input type="radio" name="status" value="void" required /><span class="outcome-icon">—</span><strong>Void</strong><small>Stake returned</small></label><label class="outcome cashout"><input type="radio" name="status" value="cashed_out" required /><span class="outcome-icon">⇢</span><strong>Cashed out</strong><small>Reduced odds</small></label></fieldset><div class="cashout-fields" id="cashout-fields" hidden><p>Enter the reduced odds you accepted. The graph records your cash-out result.</p><div class="form-columns"><label>Cash-out format<select name="cashout_format"><option value="fractional">Fractional</option><option value="decimal">Decimal</option></select></label><label>Reduced odds<input name="cashout_odds" placeholder="1/2" /></label></div><div class="potential-return"><span>CASH-OUT PROFIT <small>Return includes original stake</small></span><strong id="cashout-preview">—</strong></div></div><p class="form-note">This result is final once confirmed. Double-check before settling.</p><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Confirm result ↗</button></form>`,
  );
  const form = $("#settle-form");
  const cashoutFields = $("#cashout-fields");
  const updateCashout = () => {
    const active = form.elements.status.value === "cashed_out";
    cashoutFields.hidden = !active;
    form.elements.cashout_odds.required = active;
    try {
      const odds = parseOdds(form.elements.cashout_format.value, form.elements.cashout_odds.value);
      $("#cashout-preview").textContent = money(Number(bet.stake_pence) + profitPence(Number(bet.stake_pence), odds));
    } catch { $("#cashout-preview").textContent = "—"; }
  };
  form.addEventListener("change", updateCashout);
  form.addEventListener("input", updateCashout);
  $("#settle-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    submit(form, async () => {
      const values = new FormData(form);
      const status = values.get("status");
      const cashoutOdds = status === "cashed_out" ? parseOdds(values.get("cashout_format"), values.get("cashout_odds")) : null;
      await api.settleBet(id, status, cashoutOdds);
      dialog.close();
      toast("Result recorded. The board is up to date.");
      await Promise.all([refreshDashboard(true), refreshBets()]);
    });
  });
}

function setBetFilterButtons() {
  document.querySelectorAll("[data-bet-filter]").forEach((button) => {
    const selected = button.dataset.betFilter === state.betFilter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (
    !event.target.closest(".profile-control") ||
    event.target.closest(".profile-menu a") ||
    action
  ) {
    if ($("#profile-menu")) $("#profile-menu").hidden = true;
    $("#profile-toggle")?.setAttribute("aria-expanded", "false");
  }
  if (!action || state.pending) return;
  switch (action.dataset.action) {
    case "sign-in":
      signInDialog();
      break;
    case "demo":
      demoDialog();
      break;
    case "choose-demo":
      state.profile = api.selectDemoProfile(action.dataset.slug);
      state.bets = [];
      renderAccount();
      dialog.close();
      await refreshBets();
      route();
      toast(`Exploring ${state.profile.display_name}’s demo profile.`);
      break;
    case "add-bet":
      addBetDialog();
      break;
    case "settle":
      settleDialog(action.dataset.id);
      break;
    case "forgot-password":
      forgotPasswordDialog();
      break;
    case "retry":
      refreshDashboard(true);
      break;
    case "retry-bets":
      refreshBets();
      break;
    case "chart-data": {
      const player = state.players.find((p) => p.slug === action.dataset.slug);
      if (player) openDialog(dataTable(player, state.period));
      break;
    }
    case "sign-out":
      try {
        await api.signOut();
        state.profile = null;
        state.bets = [];
        state.betsRequest++;
        $("#bets-list").innerHTML = "";
        renderAccount();
        location.hash = "zac";
        route();
        toast("Signed out.");
      } catch (error) {
        toast(errorMessage(error));
      }
      break;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#profile-menu")) {
    $("#profile-menu").hidden = true;
    $("#profile-toggle")?.setAttribute("aria-expanded", "false");
  }
});

$("#demo-start").addEventListener("click", demoDialog);
$("#show-stakes").addEventListener("change", (event) => {
  state.showStakes = event.target.checked;
  renderCharts(true);
});
document.querySelectorAll("[data-period]").forEach((button) => {
  button.setAttribute(
    "aria-pressed",
    String(button.dataset.period === state.period),
  );
  button.addEventListener("click", () => {
    if (state.period === button.dataset.period) return;
    state.period = button.dataset.period;
    document.querySelectorAll("[data-period]").forEach((b) => {
      b.classList.toggle("selected", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    refreshDashboard(true);
  });
});
document.querySelectorAll("[data-bet-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    state.betFilter = button.dataset.betFilter;
    setBetFilterButtons();
    renderBets();
  }),
);

let profileRequest = 0;
async function syncProfile() {
  const request = ++profileRequest;
  try {
    const profile = await api.currentProfile();
    if (request !== profileRequest) return;
    const changed = profile?.id !== state.profile?.id;
    state.profile = profile;
    if (changed) {
      state.bets = [];
      state.betsRequest++;
      $("#bets-list").innerHTML = "";
    }
    renderAccount();
    route();
    if (profile) await refreshBets();
  } catch (error) {
    if (request !== profileRequest) return;
    state.profile = null;
    state.bets = [];
    state.betsRequest++;
    $("#bets-list").innerHTML = "";
    renderAccount();
    route();
    toast(errorMessage(error));
  }
}

if (api.client) {
  api.client.auth.onAuthStateChange((event) => {
    // Auth callbacks must return before calling any other Supabase APIs.
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") passwordIntent = true;
      if (event === "SIGNED_OUT") {
        passwordIntent = false;
        if (dialog.open && !state.pending) dialog.close();
      }
      if (event !== "TOKEN_REFRESHED") syncProfile();
      if (
        passwordIntent &&
        ["SIGNED_IN", "PASSWORD_RECOVERY", "INITIAL_SESSION"].includes(event)
      ) {
        api.client.auth.getSession().then(({ data }) => {
          if (data.session && !$("#password-form")) passwordDialog();
        });
      }
    }, 0);
  });
}

$("#preview-banner").hidden = !api.isDemo;
$("#player-grid").innerHTML = PLAYERS.map(
  (p) =>
    `<div class="player-card loading-card" style="--accent:${p.color}"><span class="loading-bar"></span><span class="loading-bar short"></span><div class="loading-chart"></div></div>`,
).join("");
renderAccount();
setBetFilterButtons();
route();
await Promise.all([refreshDashboard(true), syncProfile()]);
if (originalUrl.hash.includes("error="))
  toast("That account link has expired or is invalid. Request a fresh link.");
setInterval(() => {
  if (!document.hidden && !api.isDemo) {
    refreshDashboard();
    if (location.hash === "#bets") refreshBets();
  }
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !api.isDemo) {
    refreshDashboard();
    syncProfile();
  }
});
