# AGENTS.md — Nikunj Pro Games

## Project overview

The home page is a single-file static website (`index.html`). Supporting static pages live at the repository root, and Firebase Cloud Functions are in `functions/`. The site has no front-end framework or build pipeline; browser libraries are loaded from CDNs.

## Key directories

```
/
└── index.html        # Entire application — structure, styles, and logic
└── README.md         # User-facing docs
└── AGENTS.md         # This file
```

## Architecture

Everything lives in `index.html` in three logical sections:

1. **`<style>` block** — all CSS, organized with comment banners:
   - CSS custom properties (color palette, shadows) at the top
   - Section-by-section rules matching the page layout
   - Animation keyframes co-located with the components that use them

2. **HTML body** — semantic sections: `header`, `#home` (hero), `#games`, `#trending`, `#leaderboard`, `#about`, `footer`, plus two modal overlays.

3. **`<script>` blocks** — plain JavaScript in named IIFE/function sections:
   - `SYNTHWAVE BACKGROUND` — cached canvas scene with a low-frequency animated grid and meteor shower
   - `GAME DATA` — static arrays (`GAMES`, `TRENDING`, `LEADERBOARD`)
   - `RENDER FUNCTIONS` — `renderGames()`, `renderTrending()`, `renderLeaderboard()`
   - `FILTER TABS` — event delegation on the tabs container
   - `MOBILE NAV` — hamburger toggle
   - `LOGIN MODAL` — open/close/validate helpers
   - `DIRECT GAME LAUNCH` — navigates to the selected game page
   - `INIT` — calls all three render functions on page load

## Coding conventions

- CSS custom properties (`--purple-1`, `--bg`, `--neon-purple`, etc.) for all brand colors — change the palette in one place.
- `clamp()` for all heading font sizes — no media-query font overrides needed.
- Glassmorphism cards use `backdrop-filter: blur()` + semi-transparent `background` + neon `border`.
- All animations use `transform` and `opacity` for GPU compositing (60 fps target).
- The background canvas is `position:fixed` with `pointer-events:none` so it never blocks clicks. Its static scene is redrawn only when the viewport changes.
- The cursor trail runs only on fine pointers and schedules animation frames only while catching up to pointer movement.

## Non-obvious decisions

- The animated background pauses when the page is hidden and honors `prefers-reduced-motion`.
- `IntersectionObserver` drives the active nav-link highlight rather than a scroll listener to avoid jank.
