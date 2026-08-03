# Design Refresh — Scope & Build Plan

**Status:** Phases 1, 2, and the quick items in 3/4 are done (see git log —
"Design refresh: token cleanup, SharePage, feature grid, step language").
Remaining: the "spot-check Gallery/Projects/AccountSettings" line in Phase 3
and the broader hover/transition verification pass in Phase 4 haven't been
done — those were always framed as lower-priority re-checks, not confirmed
problems. Check `git log` before assuming anything below is still open.

**Why this exists:** Users have described CardCraft's UI as "too
AI-generated/generic," "not professional," and asked for something that feels
classy, premium, human-designed, and SaaS-like (Linear / Stripe / Notion
calibration, not a stock shadcn/Bootstrap template). This doc is the concrete
audit behind that feedback — file:line evidence, not vibes — plus a phased
plan a future session can execute without re-deriving the analysis.

**Headline finding, read this first:** CardCraft is *not* starting from zero.
`client/src/components/marketing/homeTokens.ts` + the `.hp-*` classes in
`client/src/index.css` are a real, deliberate design system: a warm dark
theme with a single gold accent (`--gold: 43 90% 54%`), a serif display face
(`Boska`) paired with a humanist sans body (`Plus Jakarta Sans`), a restrained
surface/elevation scale (`hp-surface` / `raised` / `inset` / `ghost`), and
**zero** purple-to-blue gradient blobs or glassmorphism on the marketing
pages. The Landing page, Pricing page, and most marketing components
(`HomeHero.tsx`, `HomeProcess.tsx`, `HomeCta.tsx`, `HomeFooter.tsx`,
`PricingCard.tsx`) already clear the "generic AI SaaS template" bar by a
reasonable margin.

**The actual problem is inconsistent application, not absence of a system.**
The token system exists but roughly a third of the app never adopted it, and
several spots reach for raw Tailwind defaults (`amber-500`, `yellow-500`,
`green-500`) right next to the intentional gold accent, undermining the
"restrained palette" the rest of the app worked to establish. See "Current
state" below for the specific instances.

---

## Current state (generic-design smells, by page/file)

### 1. `client/src/pages/SharePage.tsx` — the whole page skipped the design system

This is the page a card **recipient** opens (public share link) — arguably
the single highest-visibility, most "first impression" surface in the
product, since it's seen by people who've never heard of CardCraft. It does
not import `hp`, `SurfaceCard`, `MarketingPageShell`, or the serif display
font at all:
- Line 129: `<div className="min-h-screen bg-background flex flex-col">` —
  raw Tailwind, no `hp.page`.
- Line 130: plain `<header className="border-b border-border bg-card px-4
  h-12 ...">` — no brand mark beyond a text "CardCraft" wordmark (line 131),
  no logo SVG (contrast with `BrandLogo.tsx` / `Navbar.tsx` which do have
  one).
- Line 162: `<h1 className="text-lg font-bold">{card.title}</h1>` — generic
  Tailwind `font-bold`/`text-lg`, not `hp.display`/`font-serif` used
  everywhere else for headings.
- No eyebrow, no gold accent, no `SurfaceCard` — it looks like a different,
  more generic app bolted onto CardCraft. This is the most consequential
  single fix on the list because of who sees it.

### 2. Raw Tailwind status colors break the restrained-palette rule

The rest of the app deliberately uses one accent (`--gold` / `--primary`)
plus semantic tokens (`--destructive`, etc.). But several files reach for
default Tailwind palette colors instead of theme tokens, which is exactly
the "every other Tailwind template" look the design system was built to
avoid:
- `client/src/pages/Editor.tsx:1190` — save button:
  `` `gap-1.5 text-xs h-8 ${isDirty ? "bg-amber-500 hover:bg-amber-600
  text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}` ``
  — unsaved state uses raw amber instead of a themed "dirty/pending" token.
- `client/src/pages/Editor.tsx:1268` — unsaved-dot indicator:
  `bg-amber-400` (same issue, different raw shade than line 1190's
  `amber-500`).
- `client/src/pages/AdminPage.tsx:114` — Pro badge:
  `bg-amber-500/15 text-amber-400` and line 282 `accent-amber-500` checkbox —
  ad hoc amber rather than the existing `--gold` token used for "Pro" styling
  everywhere else (e.g. `PricingCard.tsx`, `text-gold`).
- `client/src/pages/BulkGenerate.tsx:326` — `text-green-500` for "rows
  loaded"; line 358 `text-yellow-500` for "Generating"; line 359
  `text-green-500` for "Done" — three more raw status colors with no
  relationship to the theme's `--gold`/`--destructive` tokens.
- Net effect: at least 4 different ad hoc "amber/yellow" shades
  (`amber-400`, `amber-500`, `yellow-500`, plus the real `--gold`) are all
  doing the job of "this needs attention" in different files, with no shared
  token.

### 3. Classic "icon-in-a-box × 4" feature grid on the homepage

`client/src/components/marketing/HomeFeatures.tsx` (lines 6–27) renders four
`FeatureCard`s (`client/src/components/marketing/FeatureCard.tsx`) — each is
literally `lucide-react icon in a rounded square + bold title + one-sentence
description`, no variation in size, weight, or layout across the four. This
is the single most recognizable "AI-generated SaaS landing page" pattern
(compare to any Framer/v0/Bolt template output). The styling (gold-tinted
icon well, `hp-surface`) is more restrained than a typical template, but the
*structure* — 4 identical cards in a `sm:grid-cols-2` grid, one icon, one
heading, one sentence, repeat — is exactly the pattern users are reacting to
even when the visual polish is above average. `FeatureCard.tsx` does define
a `featured`/`compact` variant system (lines 16–32) but `HomeFeatures.tsx`
never uses anything but `variant="default"` for all four — the hierarchy
variation the component supports is unused.

### 4. Two different visual languages for "step N" in the same app

- `client/src/components/marketing/HomeProcess.tsx` (line 46) — process
  steps use a tasteful serif numeral: `<span className={hpCn(hp.display,
  "text-lg text-gold/80 tabular-nums")}>{step.n}</span>` (`"01"`, `"02"` …).
- `client/src/pages/BulkGenerate.tsx` (lines 283, 309, 334) — bulk-generate's
  3-step flow instead uses `<div className="w-6 h-6 rounded-full bg-primary
  text-primary-foreground flex items-center justify-center text-xs
  font-bold">1</div>` — a plain filled-circle numbered badge, the generic
  "onboarding wizard" pattern found in almost every dashboard template.
  Two different products' worth of "step indicator" language exist in one
  app; a user going from the homepage into Bulk Generate sees the visual
  system change.

### 5. Duplicate near-identical header components

`client/src/components/marketing/PageHeader.tsx` and
`client/src/components/marketing/SectionHeading.tsx` are structurally
identical (same props, same `hp.eyebrow`/`hp.display`/`hp.lead` composition,
same `mb-10 sm:mb-12` wrapper) — the only real difference is `<h1>` vs
`<h2>` and a different default `align`. This isn't a "generic AI" smell by
itself, but it's a sign the design system was applied piecemeal rather than
having one canonical header primitive with a `level` prop — worth
consolidating before adding more pages, so future pages don't create a
*third* near-duplicate.

### 6. Buttons that bypass the design system's own primitives

- `client/src/components/Navbar.tsx:142` — the signed-out "Sign In" control
  is a raw `<button className="inline-flex items-center justify-center
  rounded-md text-sm font-medium ...">` with hand-copied Tailwind classes
  duplicating `buttonVariants` from `client/src/components/ui/button.tsx`,
  instead of `<Button variant="ghost">`. Same file, line 145, "Get Started"
  is also a raw `<button>` (with `btn-gold` class) rather than `<Button
  className={hp.btnPrimary}>` as used everywhere else (e.g.
  `HomeHero.tsx:47`). Low-risk drift today, but it's exactly how "10 slightly
  different button styles" accumulates over time.

### 7. `client/src/components/ui/button.tsx` / `card.tsx` — lightly customized, not stock

For context: these are **not** untouched shadcn defaults — `button.tsx` adds
project-specific `hover-elevate active-elevate-2` utilities and a
`--button-outline` CSS var indirection (lines 8–20), and `card.tsx` uses a
custom `card-border` token instead of shadcn's default `border`. This is a
reasonable base layer; it is not itself a generic-design problem. Flagging
this mainly so a future session doesn't waste time "fixing" shadcn defaults
that were already adapted.

### 8. Admin pages — lower priority, but same raw-color drift

`client/src/pages/AdminPage.tsx` is internal-facing so it's a lower priority
for "premium consumer feel," but it inherits the same amber-color drift
(§2) and its own bespoke `tabTriggerClass` (line 59-60) rather than reusing
any shared tab styling token — one more place a "5th accent color" could
quietly creep in as the admin surface grows.

### 9. Copy check — no cliché SaaS language found

For completeness: headline copy ("Cards worth sending. Built in minutes.",
`HomeHero.tsx:36-38`; "From blank to downloadable in four moves",
`HomeProcess.tsx:34`) does **not** exhibit the "Supercharge your..."/"Unlock
the power of..."/emoji-in-headings pattern typically flagged as AI-generated
copy. This is not a copy problem. Don't spend phase time here.

### 10. Dark mode — already close to the Linear/Vercel calibration point

`client/src/index.css:7-58` defines a warm near-black
(`--background: 224 16% 10%`) rather than a flat `gray-800`/`gray-900`
Tailwind-default dark mode, with a single warm gold accent carried through
consistently (`--primary`, `--gold`, `--ring` all `43 90% 54%`). This is
already a considered choice, not a "muddy default dark mode" problem —
don't re-theme dark mode from scratch; extend what's there.

---

## Design principles to aim for

These are the opinionated rules the phases below should be checked against.
Calibration points are named real products, not vague adjectives.

1. **One accent color, used everywhere it currently isn't.** `--gold` is
   already good — extend it to replace every raw `amber-*`/`yellow-*`/
   `green-*` status color (§2). Stripe and Linear both run on essentially one
   accent + neutral grays; CardCraft already chose gold, so finish the job
   rather than reaching for Tailwind defaults under time pressure.
2. **Every page uses the existing shell, not a bespoke one.**
   `MarketingPageShell` + `hp.*` + `SurfaceCard` should be the only way pages
   are built. `SharePage.tsx` is the one page that needs to be brought in
   line (§1) — no new pages should ship outside this system again.
3. **Typography already does hierarchy work — stop letting pages opt out of
   it.** `hp.display`/`font-serif` (Boska) vs. body `Plus Jakarta Sans` is a
   good pairing already in place (`index.css:108-119`); the fix is
   consistency (§1), not a font change.
4. **Repeated content needs at least one point of visual difference, not
   four identical cards.** Where `HomeFeatures.tsx` renders 4 identical
   `FeatureCard`s, use the `featured` variant (already built,
   `FeatureCard.tsx:22-26`) on at least one card, or break the 2×2 grid
   rhythm some other way — Stripe's feature sections almost never repeat the
   same card 4 times unchanged.
5. **One step-indicator language, not two.** Standardize on the serif
   `hp-display` numeral treatment from `HomeProcess.tsx` and remove the
   generic filled-circle badge from `BulkGenerate.tsx` (§4).
6. **No new raw `<button>` tags with hand-copied Tailwind classes.** Every
   clickable action goes through `Button` (`ui/button.tsx`) with
   `hp.btnPrimary`/`hp.btnSecondary`, full stop (§6).
7. **Don't add gradient blobs, glassmorphism, or icon-circle grids the app
   doesn't already have.** The absence of these is a strength versus a
   typical AI-generated template — the plan below is about consistency, not
   about adding "premium" decoration on top.

---

## Prioritized action plan

### Phase 1 — Design-token cleanup (foundation, do first) ✅ Done
Everything else builds on this being finished; skipping it means Phase 2-3
work has to be redone once tokens change.
- ✅ Added `--pending`/`--pending-foreground` (index.css, both dark and
  `.light` themes) — a distinct warm-orange hue, not a reuse of `--gold`, per
  the "new distinct hue" decision — and wired it into `tailwind.config.ts` as
  the `pending` color. Replaced the raw amber instances: `Editor.tsx` (save
  button + dirty-dot, now `bg-pending`/`text-pending`) and `AdminPage.tsx`'s
  Pro badge/toggle/checkbox (now `text-gold`/`bg-gold`/`accent-gold` — these
  were "Pro" indicators, not "pending" ones, so they got the *other* existing
  token instead; see the code, not §1, for why).
- ✅ `BulkGenerate.tsx`'s `text-green-500`/`text-yellow-500` → `text-primary`
  (success/loaded/done) and `text-pending` (in-progress).
- ✅ Triaged every file the wider grep hit: `SharePanel.tsx` (kept the
  WhatsApp icon's literal brand green, fixed the "delivered" message to
  `text-primary`), `PaymentsPage.tsx` (status config → `pending`/`primary`),
  `AuthProvider.tsx` (warning icon → `pending`), `admin/UserDetailSheet.tsx`,
  `admin/AdminShell.tsx`, `admin/AdminAnalyticsLiveFeed.tsx`,
  `admin/AdminHealthStrip.tsx`, `admin/AdminOpsWidgets.tsx`,
  `ImpersonationBanner.tsx`, `admin/types.ts` (all → `pending`/`primary`
  tokens). `TemplateThumbnail.tsx` turned out to have no raw-color hits on
  re-check — false positive in the original grep. Left `admin/AdminShell.tsx`'s
  `success`/`info` KPI tones (emerald/blue) alone — legitimate multi-color
  dashboard semantics for a data-dense internal tool, a different case from
  customer-facing status colors.
- ✅ Consolidated `SectionHeading.tsx` into `PageHeader.tsx` via a
  `level: "h1" | "h2"` prop (default `align` follows level, matching each
  component's old default); updated `HomeFeatures.tsx`/`HomeProcess.tsx`,
  deleted `SectionHeading.tsx`. Left `AppPageHeader.tsx` alone — on closer
  read it's a genuinely different component (has an `action` slot, different
  density for logged-in app pages), not a third duplicate of the same thing.

### Phase 2 — Bring `SharePage.tsx` into the design system ✅ Done
Highest-visibility fix, isolated to one file plus its header, so it's safe
to do independently of Phase 1/3.
- ✅ Went with the leaner, re-skinned header per the "SharePage header weight"
  decision — kept the minimal (non-`Navbar`) structure, replaced its content
  with `BrandLogo` and `hp.page`/token-based background.
- ✅ Title now uses `hp.display` (serif) with an "Sent with CardCraft" eyebrow
  above it, replacing the plain `text-lg font-bold`.
- ✅ Loading and error states re-skinned with the same tokens
  (`hp.display`/`hp.lead`, `hp.btnSecondary`).
- ✅ "Download PNG" / "Create Your Own" buttons now use
  `hp.btnPrimary`/`hp.btnSecondary` instead of bare `Button` defaults.
- **Effort spent: ~1 hour.**

### Phase 3 — Core app pages: reduce template-grid feel, unify step language 🔄 Mostly done
- ✅ `HomeFeatures.tsx`: first card now uses `FeatureCard`'s `featured`
  variant instead of all four identical (§3, principle 4).
- ✅ `BulkGenerate.tsx`: the 3 filled-circle step badges are replaced with the
  `hp-display` serif numeral pattern from `HomeProcess.tsx` (§4, principle 5).
- ⏳ Not yet done: spot-check `Gallery.tsx`, `Projects.tsx`,
  `AccountSettings.tsx` for the same "identical card × N" pattern now that
  Phase 1/2 have landed — still worth a look, but wasn't a confirmed problem
  in the original audit, just a re-check item.
- **Effort spent: ~1 hour** (the two concrete items were small once the
  tokens/components already existed).

### Phase 4 — Polish / micro-interactions / consistency sweep 🔄 Mostly done
- ✅ `Navbar.tsx`'s two raw `<button>` elements are now `Button` +
  `hp.btnPrimary`/`hp.btnSecondary`-equivalent styling (§6).
- ✅ Grepped the full `client/src` tree for other raw
  `<button className="inline-flex items-center justify-center rounded...">`
  duplicating `buttonVariants` — none found beyond the two in `Navbar.tsx`.
- ⏳ Not yet done: the hover/transition consistency re-verification across
  `template-card`, `premium-card`, `.action-btn`, `.layer-item`
  (`index.css:430-549`) — this was always framed as a verification pass on
  already-considered CSS, not a confirmed problem; still open if someone
  wants to double-check.
- **Effort spent: ~0.5 hour.**

**Total estimate: 10–15 hours** across all four phases — meaningfully less
than a full visual overhaul, because the foundation (Phase 1's target state)
already exists; this is a consistency/finishing pass, not a rebuild.

---

## Explicitly out of scope for now

- Rebuilding the marketing pages (`Landing.tsx` and its components) from
  scratch — they already clear the bar; only Phase 3's feature-grid variance
  fix applies there.
- A new brand identity (logo, color palette, typography) — `--gold` +
  Boska/Plus Jakarta Sans is a considered choice already; this plan extends
  it, it doesn't replace it.
- Illustration or custom iconography work — current `lucide-react` icon
  usage is functional and consistent; not flagged as a generic-design smell
  on its own.
- Editor canvas/toolbar interaction redesign — `Editor.tsx` was only skimmed
  for chrome/layout per the audit scope; its canvas editing UX is a separate
  concern from this visual-consistency pass.
- Full a11y audit — out of scope; flag separately if needed.
- The wider `amber-*`/`yellow-*`/`green-*` grep hits in files not read for
  this doc (`SharePanel.tsx`, `PaymentsPage.tsx`, `AuthProvider.tsx`, the
  `admin/*` components, `ImpersonationBanner.tsx`, `TemplateThumbnail.tsx`)
  are **not yet classified** — Phase 1 explicitly includes triaging them,
  but this doc does not assume they're all bugs (e.g. a literal color swatch
  picker legitimately needs raw color values).

## Open questions (need human input before building)

1. **Is there an existing brand guideline, logo file, or color the business
   wants preserved as-is?** This audit assumes the current `--gold` +
   Boska/Plus Jakarta Sans pairing is worth keeping and extending — confirm
   that's actually the intended brand direction and not itself something up
   for replacement.
2. **Full overhaul or incremental?** This plan assumes incremental
   consistency fixes on top of the existing system (cheaper, lower risk).
   If the user wants a from-scratch visual identity change instead, this
   plan doesn't apply and a different (larger) scoping pass is needed.
3. **`SharePage.tsx` header weight** — should the share/recipient view get
   the full `Navbar`, or does it intentionally want a leaner, checkout-page-
   style header (current behavior) just re-skinned? Affects Phase 2 scope.
4. **New "pending/dirty" status token naming and hue** — Phase 1 proposes a
   themed replacement for the ad hoc amber usages; confirm the exact hue
   (reuse `--gold` directly vs. a new distinct warning color) before
   building, since `--gold` currently also means "Pro/premium" elsewhere and
   overloading it with "unsaved changes" may be confusing.
5. **Priority of admin-facing pages** — this audit treated `AdminPage.tsx`
   as lower priority per the task brief; confirm that's still true before
   allocating Phase 1's token cleanup time away from it.
