# New page requirements

Use this checklist whenever a new page or HTML template is added to the site. The Safari browser chrome and safe areas must never fall back to white.

## Required document head

Every page must include all of the following entries, using the current site navy `#172a46`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#172a46" />
<meta name="theme-color" content="#172a46" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#172a46" media="(prefers-color-scheme: dark)" />
<meta name="color-scheme" content="dark" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="msapplication-navbutton-color" content="#172a46" />
<link rel="manifest" href="./manifest.webmanifest" />
```

## Required page foundations

- Load the shared `style.css` file.
- Keep both `html` and `body` backgrounds set to `var(--navy)`.
- Any page-specific class placed on `<body>` must also keep `background: var(--navy)`. Safari samples the body canvas behind its browser chrome; a light page-level background will create a light top or bottom area even when the first visible section is navy.
- Keep `html` and `body` at a minimum height of `100%`/`100dvh`.
- Do not introduce a white or light-grey root background, loading screen, overscroll area or safe-area filler.
- Use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` where fixed elements touch viewport edges.
- Use `100vh`, `100svh` and `100dvh` fallbacks for full-screen sections.
- Keep `manifest.webmanifest` `background_color` and `theme_color` synchronized with `--navy`.

## Before publishing

- Compare the new page head with `index.html`; do not use a shortened version.
- Inspect every selector targeting the page's `<body>` class and confirm none overrides the navy canvas.
- Test normal and private Safari tabs on a current iPhone.
- Check the top status area, overscroll at the top, and the area behind the bottom toolbar.
- Test both light and dark device appearance settings.
- Test the page while opened directly, not only after navigating from the homepage.
- Bump the stylesheet cache query after shared CSS changes.
- Run the production build before pushing.
