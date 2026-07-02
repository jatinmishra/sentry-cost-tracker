# Sentry Error Cost Tracker

A Chrome / Edge (MV3) extension that shows an **estimated monthly cost** next to the
event count of each issue in the Sentry issue stream (and on the issue detail header),
computed from the issue's event volume and a rate you pick in settings.

The same package loads unmodified in Chrome, Edge, and other Chromium browsers.

## Screenshots

**Issue stream with estimated cost**

<img width="745" height="377" alt="image" src="https://github.com/user-attachments/assets/ddc15d0e-bfc3-4f36-91de-05157470079e" />

**Settings**

<img width="337" height="589" alt="image" src="https://github.com/user-attachments/assets/d4a9c7f7-068c-46ff-929e-c34f70f81597" />


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

## Security & privacy

This extension is a **local, UI-only tool**. It reads the numbers already visible on the
Sentry page you're looking at, does the math in your browser, and draws a label next to
them. That's it.

- **No data is sent anywhere.** There is no backend, no analytics, no telemetry, and no
  network requests of any kind — nothing about your issues, events, or org ever leaves
  your machine.
- **Nothing is saved except your own settings.** The only thing stored is the plan / tier
  configuration you pick, kept in `chrome.storage.sync` so it follows your browser
  profile. No issue data, event counts, or cost figures are ever persisted.
- **Scoped to Sentry only.** The extension can only run on `https://*.sentry.io/*` (see
  `host_permissions`); it has no access to any other site.
- **Fully inspectable.** It's a small, unpacked, unminified extension — every line it runs
  is in this folder for you to read.

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
