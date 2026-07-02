# Sentry Error Cost Tracker

A Chrome / Edge (MV3) extension that shows an **estimated monthly cost** next to the
event count of each issue in the Sentry issue stream (and on the issue detail header),
computed from the issue's event volume and a rate you pick in settings.

The same package loads unmodified in Chrome, Edge, and other Chromium browsers.

## Install (unpacked)

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Open a Sentry issues page (`https://*.sentry.io/.../issues/`)

No build step. A `≈ $X.XX` line then appears under the event count. Click the toolbar
icon to pick your plan.

## Settings

Stored in `chrome.storage.sync`, so they follow your browser profile:

- **Plan** — Team / Business
- **Billing type** — Pay-as-you-go / Reserved
- **Volume tier** — your org's *total* monthly error volume bracket
- **Label appearance** — theme-adaptive by default; you can override colour and font
  size, or **Reset to theme**

## How the number is computed

```
estimated cost = issue_events × marginal_rate(plan, billingType, tier)
```

Rates come from Sentry's [published errors pricing](https://docs.sentry.io/pricing/#errors-pricing).

**This is a marginal-cost estimate, not a bill.** The first 50k errors/month are
included in the base plan, and the tier depends on your org's *total* volume (not one
issue) — so exact per-issue attribution isn't possible from the stream. The figure is
useful for ranking noisy issues by spend, not for reconciling an invoice.

## Notes

- **Host scope** is `https://*.sentry.io/*`. For self-hosted Sentry, add your domain to
  `host_permissions` and the content-script `matches` in `manifest.json`.
- **Rates** are hardcoded in `pricing.js` — edit it (and bump the `verified` date) if
  Sentry changes pricing.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config |
| `pricing.js` | Rate table + lookup helpers |
| `content.js` | Finds rows, computes cost, injects the cost line |
| `settings.html` / `settings.js` | Plan/type/tier selector (popup + options page) |
| `icons/` | Toolbar/store icons |
