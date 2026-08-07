const projects = {
  overpar: {
    name: "OverPar",
    eyebrow: "Native iOS startup · In progress",
    headline: "Designing a trustworthy all-in-one golf companion",
    introduction: "OverPar brings course discovery, satellite mapping, GPS rangefinding, scoring, club learning and shot-video tracing into one native iPhone experience. It is built around a simple principle: uncertain or inferred data should never masquerade as measurement.",
    hero: "./project-assets/overpar/hero-overpar-home.png",
    heroAlt: "OverPar iPhone application shown beside golf-course imagery",
    role: "I conceived OverPar and am its sole product owner, designer and developer—covering research, interaction design, SwiftUI engineering, GPS and mapping workflows, camera experiments and the initial data architecture.",
    audience: "Recreational and improving golfers, community course contributors, and groups looking for one reliable on-course companion.",
    problem: "Golfers often move between separate tools for course discovery, GPS yardages, scorekeeping, club-distance tracking and shot-video effects. OverPar explores how those jobs can live in one calm, course-first product without presenting uncertain GPS data or a visual tracer as precision telemetry.",
    features: [
      "Community course creation using satellite placement or stable multi-sample GPS capture",
      "Satellite course preview and active-round GPS workspace with honest accuracy handling",
      "Offline-first persistence for courses, rounds, shots, carries and private gallery metadata",
      "Club inventory, carry observations and confidence-aware recommendations",
      "Fixed-camera shot capture with correctable visual tracing and original-video preservation",
      "Versioned PostGIS community data with Row Level Security and private media policies"
    ],
    decisions: [
      "Keep measured, inferred and visualised data explicitly separate",
      "Use immutable course revisions so community corrections remain reversible",
      "Write active-round changes locally first and make eventual sync idempotent",
      "Constrain automatic tracing to a clearly stated happy path with manual correction"
    ],
    technologies: ["Swift", "SwiftUI", "Core Location", "MapKit", "AVFoundation", "Vision", "Supabase", "PostGIS"],
    outcomes: [
      "A complete Release 1 SwiftUI application builds successfully for the iOS simulator",
      "The repository includes a versioned production-oriented database migration and security model",
      "The startup remains pre-launch and has not yet been field-tested during real rounds"
    ],
    gallery: [
      ["./project-assets/overpar/overpar-home-iphone.png", "OverPar Home screen in an iPhone simulator"],
      ["./project-assets/overpar/course-morning-photography.png", "Morning golf-course artwork used by OverPar"],
      ["./project-assets/overpar/overpar-app-icon.png", "OverPar application icon"]
    ],
    links: [["View public repository", "https://github.com/zacwhittaker/OverPar"]]
  },
  "ldfc-bot": {
    name: "LDFC Bot",
    eyebrow: "Discord community product · Live",
    headline: "Building a full community platform inside Discord",
    introduction: "LDFC began as a personality-led Discord bot and grew into a connected platform for a football- and music-focused community. Profiles, reputation, an economy, collectibles, social games and moderation all share one coherent identity and data model.",
    hero: "./project-assets/ldfc-bot/hero-member-profile-card.png",
    heroAlt: "Generated LDFC member profile card showing reputation, activity and music identity",
    role: "Product, design and engineering are a shared effort with @willithius, identified here by his GitHub username. My repository-attributed work includes reliability improvements, Last.fm features and branch integration.",
    audience: "A Discord community centred on Liam Delap, football conversation, Last.fm and music culture, including members, moderators and administrators.",
    problem: "Discord communities often accumulate disconnected bots for music profiles, games, moderation, reputation and utilities. That fragments identity and progression across different interfaces. LDFC connects those needs inside the place where the community already interacts.",
    features: [
      "Last.fm linking, music profiles, listening charts, rankings and music games",
      "Persistent member profiles combining Aura, activity, badges, cosmetics and music identity",
      "Credits economy, transactional casino games, football betting and collectible cards",
      "Trivia, football and social games that create repeatable community moments",
      "Moderation, configuration, diagnostics, reminders, backups and guarded recovery",
      "A secure foundation for an embedded daily football guessing Activity"
    ],
    decisions: [
      "Connect new systems to shared profiles, Aura and the community economy",
      "Keep Last.fm culture while deliberately excluding voice music playback",
      "Use repeat-safe migrations and idempotent transactions for persistent state",
      "Allow optional providers to fail independently without taking down the core bot"
    ],
    technologies: ["Python", "discord.py", "SQLite", "aiohttp", "Pillow", "React", "TypeScript", "Railway"],
    outcomes: [
      "187 canonical prefix paths, 65 slash paths, 20 command groups and 20 listeners",
      "29 Discord extensions and 45 required SQLite tables across additive migrations",
      "621 tests passed in the latest recorded full offline verification",
      "Live use within an active football-focused Discord community"
    ],
    gallery: [
      ["./project-assets/ldfc-bot/discord-lastfm-response.jpg", "A real Last.fm command and generated now-playing response in Discord"],
      ["./project-assets/ldfc-bot/discord-bot-profile.png", "The public LDFC bot profile in Discord"],
      ["./project-assets/ldfc-bot/feature-aura-prestige-card.png", "Generated Aura and prestige identity card"],
      ["./project-assets/ldfc-bot/discord-coinflip-response.jpg", "A live coin-flip command response"]
    ],
    links: [
      ["Visit community website", "https://ldfc.co.uk/"],
      ["View public repository", "https://github.com/willithius/liam_delap_bot"]
    ]
  },
  "ldfc-website": {
    name: "LDFC Website",
    eyebrow: "Community platform · Live",
    headline: "Building a web home for a Discord-native football community",
    introduction: "The Liam Delap Fan Club website turns a Discord invite into a focused join journey and gives existing members a web profile connected to activity already held by the community bot.",
    hero: "./project-assets/ldfc-website/hero-home-desktop.png",
    heroAlt: "The Liam Delap Fan Club website homepage",
    role: "I designed the interface and built the front end, Supabase authentication, Edge Function and bot-profile integration. The project was created to market the existing Discord bot and community.",
    audience: "Liam Delap supporters interested in joining the fan club and existing Discord members viewing their community profile.",
    problem: "A Discord invite offers almost no context to a prospective member. The community needed a public identity, a clear application route and a way for authenticated members to carry their server profile into a purpose-built web experience.",
    features: [
      "Responsive landing page with a focused Discord application journey",
      "Discord OAuth through Supabase with guild-membership verification",
      "Member dashboard for identity, badges, activity, Aura and music data",
      "Authenticated Edge Function bridge to the private bot profile API",
      "Dedicated rules, privacy and terms routes",
      "Custom-domain static hosting with clean URL handling"
    ],
    decisions: [
      "Keep the public journey deliberately narrow: explain, build trust and invite",
      "Require verified guild membership rather than accepting any Discord account",
      "Keep private bot credentials server-side behind a JWT-validating Edge Function",
      "Reuse the bot's member model instead of creating a second profile store"
    ],
    technologies: ["Semantic HTML", "Responsive CSS", "JavaScript", "Supabase", "Deno Edge Functions", "Discord OAuth", "GitHub Pages"],
    outcomes: [
      "A fully operational public join journey and authenticated member-profile flow",
      "Live deployment on a custom domain",
      "A subtle increase in community membership after launch"
    ],
    gallery: [
      ["./project-assets/ldfc-website/home-mobile.png", "Full mobile homepage experience"],
      ["./project-assets/ldfc-website/profile-login-desktop.png", "Desktop member login route"],
      ["./project-assets/ldfc-website/profile-login-mobile.png", "Mobile member login route"],
      ["./project-assets/ldfc-website/brand-logo.png", "LDFC identity mark created in Photoshop"]
    ],
    links: [
      ["Visit live website", "https://ldfc.co.uk/"],
      ["View public repository", "https://github.com/zacwhittaker/liamdelapfanclub"]
    ]
  }
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

const projectId = new URLSearchParams(window.location.search).get("id");
const project = projects[projectId];
const root = document.querySelector("#project-content");

if (!project) {
  document.title = "Project not found — Zac Whittaker";
  root.innerHTML = `<section class="case-error"><p class="overline">Project not found</p><h1>Nothing here yet.</h1><a class="arrow-link" href="./index.html#work">Return to selected work</a></section>`;
} else {
  document.title = `${project.name} — Zac Whittaker`;
  root.innerHTML = `
    <section class="case-hero">
      <a class="case-back" href="./index.html#work">Back to selected work</a>
      <p class="overline">${escapeHtml(project.eyebrow)}</p>
      <h1>${escapeHtml(project.name)}</h1>
      <div class="case-hero-bottom">
        <h2>${escapeHtml(project.headline)}</h2>
        <p>${escapeHtml(project.introduction)}</p>
      </div>
    </section>
    <figure class="case-cover"><img src="${project.hero}" alt="${escapeHtml(project.heroAlt)}" /></figure>
    <section class="case-overview">
      <p class="case-section-label">Overview</p>
      <div class="case-overview-grid">
        <article><span>My role</span><p>${escapeHtml(project.role)}</p></article>
        <article><span>Audience</span><p>${escapeHtml(project.audience)}</p></article>
        <article class="case-problem"><span>The opportunity</span><p>${escapeHtml(project.problem)}</p></article>
      </div>
    </section>
    <section class="case-details">
      <div class="case-detail-block"><p class="case-section-label">What it does</p><ol>${project.features.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>
      <div class="case-detail-block case-detail-dark"><p class="case-section-label">Decisions</p><ol>${project.decisions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>
    </section>
    <section class="case-gallery"><p class="case-section-label">Selected views</p><div class="case-gallery-grid">${project.gallery.map(([src, alt], index) => `<figure class="${index === 0 ? "gallery-wide" : ""}"><img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${String(index + 1).padStart(2, "0")} · ${escapeHtml(alt)}</figcaption></figure>`).join("")}</div></section>
    <section class="case-results">
      <div><p class="case-section-label">Built with</p><p class="technology-list">${project.technologies.map(escapeHtml).join(" · ")}</p></div>
      <div><p class="case-section-label">Outcomes</p><ul>${project.outcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </section>
    <section class="case-cta"><p class="overline">Explore the project</p><h2>${escapeHtml(project.name)}</h2><div>${project.links.map(([label, href]) => `<a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(label)} <img src="./icons/up-right-light.png" alt="" /></a>`).join("")}</div></section>
  `;
}
