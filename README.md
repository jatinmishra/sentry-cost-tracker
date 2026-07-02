# Sentry Error Cost Tracker

A Chrome / Edge (MV3) extension that shows an **estimated monthly cost** under the event
count of every row in the Sentry issue stream, computed from each issue's event
volume and a rate you choose in settings. It's a Chromium extension — the same package
loads unmodified in both Chrome and Microsoft Edge (and other Chromium browsers).

> **Layout note:** the cost renders as a small line *inside the Events cell*, not as
> a separate column. The issue stream is a flex layout where the header and rows share
> per-cell widths, so adding a row-level cell the header lacks shifts every column after
> it. Nesting under Events adds zero columns — nothing shifts, and the existing "Events"
> header already labels it. A standalone titled column is possible but brittle (it must
> track the header DOM and rebreaks on any Sentry layout change); see "Known limits".

## Install (unpacked)

**Chrome**
1. `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select this folder
4. Open a Sentry issues page (`https://*.sentry.io/.../issues/`)

**Microsoft Edge** (identical flow, different address)
1. `edge://extensions`
2. Toggle **Developer mode** (bottom left)
3. **Load unpacked** → select this folder
4. Open a Sentry issues page (`https://*.sentry.io/.../issues/`)

No build step or separate package — the same folder works in both. `chrome.storage.sync`
genuinely syncs when you're signed into the browser (Chrome or Edge profile).

A `≈ $X.XX` line appears under the event count — on each row of the issue **stream**,
and under "Events (total)" on the issue **detail** header. Click the toolbar icon
(or the extension's *Details → Extension options*) to pick your plan.

## Settings

Three controls drive the rate (stored in `chrome.storage.sync`, so they follow your
profile):

- **Plan** — Team / Business
- **Billing type** — Pay-as-you-go / Reserved
- **Volume tier** — your org's *total* monthly error volume bracket

**Label appearance** is theme-adaptive by default: the cost inherits the surrounding text
colour at reduced opacity, so it reads correctly in both light and dark Sentry. You can
override colour and font size, and **Reset to theme** snaps both back to adaptive. `"auto"`
is the stored value for either field when it's following the theme.

## How the number is computed

```
estimated cost = issue_events × marginal_rate(plan, billingType, tier)
```

Rates come from Sentry's published errors pricing
(<https://docs.sentry.io/pricing/#errors-pricing>).

### The honest caveat (read this)

This is a **marginal-cost estimate, not a bill.** Two facts make exact per-issue
attribution impossible from the issue stream:

1. **The first 50k errors/month are included** in the base plan. The extension can't
   know how much of that quota a given issue consumed, so it prices every event at the
   marginal rate.
2. **The tier is set by your org's total monthly volume**, not by one issue. A single
   row's count can't tell us which tier you're in — hence the manual selector.

So the figure answers *"what does this issue's volume cost at the margin?"* — useful for
ranking noisy issues by spend, not for reconciling an invoice.

## How it stays attached

- Rows are matched by the stable `data-test-id="group"` attribute; the detail header by
  `data-sentry-element="HeaderGrid"`. In both, the event count is `data-sentry-component="Count"`
  (first = Events, second = Users) — not the volatile emotion-hashed class names.
- The exact count is read from the `title` attribute (e.g. `title="737164"`), falling back
  to parsing `69K` / `1.2M`.
- The cost is nested into the element that holds the number — the Events column cell in the
  stream (set to `flex-wrap: wrap`), and the Events `Count` span itself on the detail header
  (a grid item). Neither adds a column/grid cell, so nothing shifts.
- A `MutationObserver` (debounced) re-scans on stream changes. Each line stores the event
  count it was rendered for, so virtualized rows whose content swaps get re-priced instead
  of going stale.
- Changing settings recomputes existing lines in place — no reload needed.

## Known limits / things to tweak

- **Host scope** is `https://*.sentry.io/*`. For self-hosted Sentry on a custom domain,
  add it to `host_permissions` and the content-script `matches` in `manifest.json`.
- **Not a standalone column — by choice.** Rendering under Events avoids a column-count
  mismatch with the header (the original cause of the shifted-header bug). A true titled
  column would require injecting a matching header cell and keeping widths in lockstep with
  the rows; it rebreaks whenever Sentry changes the stream layout. If you want that anyway,
  paste the header row's HTML and align there instead.
- **Icons** live in `icons/` (16/48/128 px, plus a 512 px master for store listings) and are
  wired into `manifest.json` (`"icons"` + `action.default_icon`).
- Rates are hardcoded from the pricing page; if Sentry changes pricing, edit `pricing.js`.
  Bump the `verified` date there when you re-check — settings shows "Rates last verified:
  <date>" so staleness is visible rather than silent. Settings also states plainly that
  figures are indicative, not an actual bill.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config |
| `pricing.js` | Rate table + lookup helpers (shared by content script and settings) |
| `content.js` | Finds rows, computes cost, injects/updates the cell |
| `settings.html` / `settings.js` | Plan/type/tier selector (popup + options page) |
| `icons/` | Toolbar/store icons (16/48/128 px + 512 px master) |