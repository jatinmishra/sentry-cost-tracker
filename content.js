/* Sentry Error Cost Tracker — content script
 * Shows an estimated cost under the event count on:
 *   - the issue STREAM (each row), and
 *   - the issue DETAIL header.
 *
 * In both cases the cost is nested into the element that already holds the event
 * number, so no new column/grid-cell is created and nothing else shifts. The cost
 * uses whatever time window the Events count reflects (Sentry's duration filter).
 */
(function () {
  "use strict";

  const PRICING = window.SENTRY_ERROR_PRICING;
  const LINE_CLASS = "sec-cost-line";
  const STREAM_ROW = '[data-test-id="group"]';
  const DETAIL_HEADER = '[data-sentry-element="HeaderGrid"]';

  let settings = Object.assign({}, PRICING.DEFAULTS);

  /* ---------- utilities ---------- */

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // Parse "69604", "22,019", "69K", "1.2M", "486" -> Number
  function parseHumanNumber(str) {
    if (!str) return NaN;
    const s = String(str).trim().replace(/,/g, "");
    const m = s.match(/^([\d.]+)\s*([kKmMbB]?)$/);
    if (!m) {
      const n = parseInt(s.replace(/[^\d]/g, ""), 10);
      return isNaN(n) ? NaN : n;
    }
    let n = parseFloat(m[1]);
    const suffix = m[2].toLowerCase();
    if (suffix === "k") n *= 1e3;
    else if (suffix === "m") n *= 1e6;
    else if (suffix === "b") n *= 1e9;
    return Math.round(n);
  }

  // Count component carries the exact value in its title attribute.
  function readCount(el) {
    if (!el) return NaN;
    const fromTitle = parseHumanNumber(el.getAttribute("title"));
    if (!isNaN(fromTitle)) return fromTitle;
    // Fall back to text, but ignore any cost line we may have nested inside.
    const clone = el.cloneNode(true);
    clone.querySelectorAll("." + LINE_CLASS).forEach((n) => n.remove());
    return parseHumanNumber(clone.textContent);
  }

  function formatCost(cost) {
    if (!isFinite(cost)) return "—";
    if (cost >= 1) return "$" + cost.toFixed(2);
    if (cost >= 0.01) return "$" + cost.toFixed(3);
    return "$" + cost.toFixed(4);
  }

  // Walk up until we reach the direct child of `container` (the column cell).
  function cellOf(container, node) {
    let n = node;
    while (n && n.parentElement && n.parentElement !== container) n = n.parentElement;
    return n && n.parentElement === container ? n : null;
  }

  // Best-effort title extraction: every stream row links to its own issue detail
  // page, so we key off the href pattern rather than a specific component name —
  // that's more stable across Sentry frontend refactors than a class/attribute guess.
  function readTitle(row) {
    const link = row.querySelector('a[href*="/issues/"]');
    const raw = (link && link.textContent) || "";
    return raw.replace(/\s+/g, " ").trim() || "Untitled issue";
  }

  /* ---------- styling ---------- */

  function injectStyleOnce() {
    if (document.getElementById("sec-style")) return;
    const style = document.createElement("style");
    style.id = "sec-style";
    style.textContent = `
      .${LINE_CLASS} {
        flex: 0 0 100%;
        width: 100%;
        margin-top: 2px;
        font-family: Rubik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: inherit;   /* follow surrounding text colour (light/dark) ... */
        opacity: 0.62;    /* ... muted via opacity so it adapts to the theme */
        text-align: inherit;
        white-space: nowrap;
        cursor: default;
        letter-spacing: normal;
        text-transform: none;
      }
      .${LINE_CLASS}.sec-detail {
        display: block;
        font-size: 13px;
        font-weight: 400;
        margin-top: 4px;
        text-align: left;
      }
      .${LINE_CLASS} .sec-approx { font-weight: 400; margin-right: 1px; }
    `;
    document.head.appendChild(style);
  }

  /* ---------- core ---------- */

  function buildTooltip(events, rate) {
    const lbl = PRICING.labelFor(settings);
    return (
      events.toLocaleString() +
      " events × $" + rate +
      " (" + lbl.plan + " · " + lbl.billingType + " · " + lbl.tier + " tier)\n" +
      "Indicative estimate, not your actual bill. First 50k errors/mo are included in the base plan."
    );
  }

  function renderLine(line, events) {
    const rate = PRICING.getRate(settings);
    const cost = events * rate;
    line.dataset.events = String(events);
    line.title = buildTooltip(events, rate);
    line.innerHTML = '<span class="sec-approx">≈</span>' + formatCost(cost);

    // Appearance: "auto" clears inline styles so the theme-adaptive CSS governs;
    // an explicit value overrides it (and we drop the opacity so the colour is exact).
    if (settings.labelColor && settings.labelColor !== "auto") {
      line.style.color = settings.labelColor;
      line.style.opacity = "1";
    } else {
      line.style.color = "";
      line.style.opacity = "";
    }
    line.style.fontSize =
      settings.labelSize && settings.labelSize !== "auto"
        ? settings.labelSize + "px"
        : "";
  }

  // host = element to nest the cost line inside (the thing that holds the number).
  function inject(host, events, opts) {
    if (!host) return;
    let line = host.querySelector(":scope > ." + LINE_CLASS);
    if (line && line.dataset.events === String(events)) return; // up to date

    if (!line) {
      if (opts.flexWrap) host.style.flexWrap = "wrap";
      line = document.createElement("div");
      line.className = LINE_CLASS + (opts.detail ? " sec-detail" : "");
      host.appendChild(line);
    }

    if (isNaN(events)) {
      line.dataset.events = "NaN";
      line.textContent = "—";
      line.title = "Event count unavailable";
      return;
    }
    renderLine(line, events);
  }

  function scan() {
    injectStyleOnce();

    // Issue stream rows: nest inside the Events column cell.
    document.querySelectorAll(STREAM_ROW).forEach(function (row) {
      const counts = row.querySelectorAll('[data-sentry-component="Count"]');
      if (!counts.length) return;
      inject(cellOf(row, counts[0]), readCount(counts[0]), { flexWrap: true });
    });

    // Issue detail header: nest inside the Events count span (a grid item).
    document.querySelectorAll(DETAIL_HEADER).forEach(function (grid) {
      const counts = grid.querySelectorAll('[data-sentry-component="Count"]');
      if (!counts.length) return;
      inject(counts[0], readCount(counts[0]), { detail: true });
    });
  }

  function recomputeAll() {
    document.querySelectorAll("." + LINE_CLASS).forEach(function (line) {
      const events = parseInt(line.dataset.events, 10);
      if (!isNaN(events)) renderLine(line, events);
    });
  }

  // Gathers {title, events, cost} for every stream row currently in the DOM, using
  // the exact same rate lookup as the on-page labels (no separate cost formula).
  // Used by the shareable cost card in the popup — never sent anywhere over the
  // network, just returned to the extension's own popup via chrome.runtime messaging.
  function collectIssueData() {
    const rate = PRICING.getRate(settings);
    const issues = [];
    document.querySelectorAll(STREAM_ROW).forEach(function (row) {
      const counts = row.querySelectorAll('[data-sentry-component="Count"]');
      if (!counts.length) return;
      const events = readCount(counts[0]);
      if (isNaN(events)) return;
      issues.push({ title: readTitle(row), events: events, cost: events * rate });
    });
    return issues;
  }

  /* ---------- wiring ---------- */

  const debouncedScan = debounce(scan, 150);

  function start() {
    scan();
    new MutationObserver(debouncedScan).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  chrome.storage.sync.get(PRICING.DEFAULTS, function (stored) {
    settings = Object.assign({}, PRICING.DEFAULTS, stored);
    start();
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "sync") return;
    let changed = false;
    Object.keys(PRICING.DEFAULTS).forEach(function (k) {
      if (changes[k]) {
        settings[k] = changes[k].newValue;
        changed = true;
      }
    });
    if (changed) recomputeAll();
  });

  // Only the extension's own popup/options page can reach this (page scripts can't
  // trigger chrome.runtime.onMessage on a content script) — no new permission needed.
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== "SEC_COLLECT_ISSUES") return;
    sendResponse({ issues: collectIssueData() });
  });
})();