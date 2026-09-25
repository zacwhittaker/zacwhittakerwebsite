import {
  cumulativeSeries,
  escapeHtml,
  money,
  periodStart,
  ukDay,
} from "./domain.js";

export function chartMarkup(player, period, showStakes) {
  const points = cumulativeSeries(player.days, periodStart(period));
  const W = 600;
  const H = 180;
  const left = 52;
  const right = 10;
  const top = 18;
  const bottom = 26;
  const values = points.flatMap((p) =>
    showStakes ? [p.profit, p.stake] : [p.profit],
  );
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    min = -1000;
    max = 1000;
  }
  const pad = (max - min) * 0.16;
  min -= pad;
  max += pad;
  const firstDate = Date.parse(points[0].day);
  const lastDate = Date.parse(points.at(-1).day);
  const x = (p) =>
    left +
    ((Date.parse(p.day) - firstDate) /
      Math.max(86400000, lastDate - firstDate)) *
      (W - left - right);
  const y = (value) =>
    top + (1 - (value - min) / (max - min)) * (H - top - bottom);
  const path = (key) =>
    points
      .map(
        (p, i) => `${i ? "L" : "M"}${x(p).toFixed(2)},${y(p[key]).toFixed(2)}`,
      )
      .join(" ");
  const profitPath = path("profit");
  const areaPath = `${profitPath} L${x(points.at(-1))},${y(0)} L${x(points[0])},${y(0)} Z`;
  const ticks = [max - pad / 2, (max + min) / 2, min + pad / 2];
  const axisAmount = (pence) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      notation: Math.abs(pence) >= 100000 ? "compact" : "standard",
      maximumFractionDigits: 0,
    }).format(pence / 100);
  const dateLabel = (day) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00Z`));
  return `<div class="chart-wrap" tabindex="0" role="group" aria-label="${escapeHtml(player.display_name)} cumulative results chart. Use left and right arrow keys to inspect dates." data-slug="${player.slug}" data-points='${JSON.stringify(points)}' data-min="${min}" data-max="${max}">
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net profit ${money(player.profit_pence, true)}${showStakes ? `; total staked ${money(player.staked_pence)}` : ""}">
      <defs><linearGradient id="fill-${player.slug}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".16"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" class="grid-line"/><text x="${left - 10}" y="${y(t) + 4}" text-anchor="end" class="axis-label">${axisAmount(t)}</text>`).join("")}
      <line x1="${left}" x2="${W - right}" y1="${y(0)}" y2="${y(0)}" class="zero-line" />
      <path d="${areaPath}" fill="url(#fill-${player.slug})"/>
      ${showStakes ? `<path d="${path("stake")}" class="stake-path"/>` : ""}
      <path d="${profitPath}" class="profit-path" pathLength="1"/>
      <circle cx="${x(points.at(-1))}" cy="${y(points.at(-1).profit)}" r="4.5" class="last-dot"/>
      <line class="crosshair" y1="${top}" y2="${H - bottom}" x1="0" x2="0" visibility="hidden"/>
      <text x="${left}" y="${H - 3}" class="axis-label">${dateLabel(points[0].day)}</text><text x="${W - right}" y="${H - 3}" text-anchor="end" class="axis-label">${dateLabel(points.at(-1).day)}</text>
    </svg><div class="chart-tooltip" hidden></div><span class="sr-only chart-announcement" aria-live="polite"></span>
    ${!player.days.length ? '<span class="empty-chart-label">A clean slate. Your story starts here.</span>' : ""}
  </div>`;
}

export function bindCharts(container) {
  container.querySelectorAll(".chart-wrap").forEach((wrap) => {
    const points = JSON.parse(wrap.dataset.points);
    const tooltip = wrap.querySelector(".chart-tooltip");
    const crosshair = wrap.querySelector(".crosshair");
    let index = points.length - 1;
    const show = (i, announce = false) => {
      index = Math.max(0, Math.min(i, points.length - 1));
      const point = points[index];
      const proportion =
        (Date.parse(point.day) - Date.parse(points[0].day)) /
        Math.max(
          86400000,
          Date.parse(points.at(-1).day) - Date.parse(points[0].day),
        );
      const x = 52 + proportion * 538;
      const date = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${point.day}T12:00:00Z`));
      tooltip.innerHTML = `<strong>${date}</strong><span>Net <b>${money(point.profit, true)}</b></span><span>Staked <b>${money(point.stake)}</b></span>`;
      tooltip.style.left = `${Math.min(72, Math.max(12, (x / 600) * 100))}%`;
      tooltip.hidden = false;
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.setAttribute("visibility", "visible");
      if (announce)
        wrap.querySelector(".chart-announcement").textContent =
          `${date}: net profit ${money(point.profit, true)}, staked ${money(point.stake)}.`;
    };
    const hide = () => {
      tooltip.hidden = true;
      crosshair.setAttribute("visibility", "hidden");
    };
    wrap.addEventListener("pointermove", (event) => {
      const rect = wrap.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (((event.clientX - rect.left) / rect.width) * 600 - 52) / 538,
        ),
      );
      const timestamp =
        Date.parse(points[0].day) +
        ratio * (Date.parse(points.at(-1).day) - Date.parse(points[0].day));
      const closest = points.reduce(
        (best, point, idx) =>
          Math.abs(Date.parse(point.day) - timestamp) <
          Math.abs(Date.parse(points[best].day) - timestamp)
            ? idx
            : best,
        0,
      );
      show(closest);
    });
    wrap.addEventListener("pointerleave", hide);
    wrap.addEventListener("blur", hide);
    wrap.addEventListener("focus", () => show(index, true));
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        show(index + (event.key === "ArrowLeft" ? -1 : 1), true);
      }
      if (event.key === "Escape") hide();
    });
  });
}

export function dataTable(player, period) {
  const points = cumulativeSeries(player.days, periodStart(period), ukDay());
  return `<p class="eyebrow">THE NUMBERS BEHIND THE LINE</p><h2 id="dialog-title">${escapeHtml(player.display_name)}’s results</h2><p class="dialog-subtitle">Cumulative totals for the selected period.</p><div class="data-table-wrap"><table><thead><tr><th>Date</th><th>Staked</th><th>Net profit</th></tr></thead><tbody>${points.map((p) => `<tr><td>${escapeHtml(p.day)}</td><td>${money(p.stake)}</td><td>${money(p.profit, true)}</td></tr>`).join("")}</tbody></table></div>`;
}
