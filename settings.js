(function () {
  "use strict";

  const PRICING = window.SENTRY_ERROR_PRICING;
  const $ = (id) => document.getElementById(id);

  const planSel = $("plan");
  const billingSel = $("billingType");
  const tierSel = $("tier");
  const preview = $("preview");
  const savedTag = $("saved");
  const themeColorChk = $("themeColor");
  const labelColorInp = $("labelColor");
  const labelSizeSel = $("labelSize");
  const resetBtn = $("reset");

  const THEME_PREVIEW_COLOR = "#6a6772"; // shown in the swatch while in "theme" mode

  const SAMPLE = 100000; // events used in the live preview

  // Leading+trailing throttle — keeps live color drags under chrome.storage.sync's
  // write-rate limit while still updating the open Sentry tab a few times a second.
  function throttle(fn, ms) {
    let last = 0, timer = null, pending;
    return function () {
      pending = arguments;
      const wait = ms - (Date.now() - last);
      if (wait <= 0) {
        last = Date.now();
        fn.apply(null, pending);
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(null, pending);
        }, wait);
      }
    };
  }

  function fill(sel, items) {
    sel.innerHTML = "";
    items.forEach((it) => {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.label;
      sel.appendChild(o);
    });
  }

  fill(planSel, PRICING.plans);
  fill(billingSel, PRICING.billingTypes);
  fill(tierSel, PRICING.tiers);

  function current() {
    return {
      plan: planSel.value,
      billingType: billingSel.value,
      tier: tierSel.value,
      labelColor: themeColorChk.checked ? "auto" : labelColorInp.value,
      labelSize: labelSizeSel.value
    };
  }

  function fmt(cost) {
    if (cost >= 1) return "$" + cost.toFixed(2);
    if (cost >= 0.01) return "$" + cost.toFixed(3);
    return "$" + cost.toFixed(4);
  }

  function updatePreview() {
    const s = current();
    const rate = PRICING.getRate(s);
    const cost = SAMPLE * rate;
    // Always render the sample legibly (theme foreground, bold) rather than in the
    // chosen label colour — a fixed colour can be invisible on the preview surface.
    const style =
      "color:var(--fg);font-weight:600;" +
      (s.labelSize !== "auto" ? "font-size:" + s.labelSize + "px;" : "");
    preview.innerHTML =
      "Per-event rate: <b>$" + rate + "</b><br>" +
      "Example: <b>" + SAMPLE.toLocaleString() + "</b> events → " +
      '<span class="sample" style="' + style + '">≈' + fmt(cost) + "</span>/mo";
  }

  function syncColorEnabled() {
    labelColorInp.disabled = themeColorChk.checked;
  }

  let savedTimer;
  function flashSaved() {
    savedTag.classList.add("show");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => savedTag.classList.remove("show"), 1200);
  }

  function save() {
    syncColorEnabled();
    chrome.storage.sync.set(current(), flashSaved);
    updatePreview();
  }

  [planSel, billingSel, tierSel, labelSizeSel, labelColorInp].forEach((el) =>
    el.addEventListener("change", save)
  );
  // unchecking "match theme" should immediately adopt the swatch colour
  themeColorChk.addEventListener("change", save);

  // Live colour: `input` fires continuously while dragging the picker (unlike
  // `change`, which only fires on close). Update the popup preview instantly and
  // persist on a throttle so the open Sentry tab recolours live, within rate limits.
  const persistThrottled = throttle(() =>
    chrome.storage.sync.set(current(), flashSaved), 250
  );
  labelColorInp.addEventListener("input", function () {
    updatePreview();
    persistThrottled();
  });

  resetBtn.addEventListener("click", function () {
    themeColorChk.checked = true;
    labelColorInp.value = THEME_PREVIEW_COLOR;
    labelSizeSel.value = "auto";
    save();
  });

  chrome.storage.sync.get(PRICING.DEFAULTS, function (stored) {
    const s = Object.assign({}, PRICING.DEFAULTS, stored);
    planSel.value = s.plan;
    billingSel.value = s.billingType;
    tierSel.value = s.tier;

    const themeColor = s.labelColor === "auto";
    themeColorChk.checked = themeColor;
    labelColorInp.value = themeColor ? THEME_PREVIEW_COLOR : s.labelColor;
    labelSizeSel.value = s.labelSize || "auto";
    syncColorEnabled();
    updatePreview();
  });

  /* ---------- shareable cost card ---------- */

  const cardSizeSel = $("cardSize");
  const generateCardBtn = $("generateCard");
  const downloadCardBtn = $("downloadCard");
  const cardStatus = $("cardStatus");
  const cardPreviewWrap = $("cardPreviewWrap");
  const cardCanvas = $("cardCanvas");

  const TOP_N = 5;

  function showCardStatus(msg) {
    cardStatus.textContent = msg || "";
  }

  // Prefer the active Sentry tab; fall back to any open Sentry tab (covers the
  // case where this page is open as a full options tab, not the toolbar popup).
  function findSentryTab(cb) {
    const pattern = "https://*.sentry.io/*";
    chrome.tabs.query({ active: true, currentWindow: true, url: pattern }, function (activeTabs) {
      if (activeTabs && activeTabs[0]) return cb(activeTabs[0]);
      chrome.tabs.query({ url: pattern }, function (anyTabs) {
        cb(anyTabs && anyTabs[0]);
      });
    });
  }

  function generateCard() {
    showCardStatus("");
    cardPreviewWrap.style.display = "none";

    findSentryTab(function (tab) {
      if (!tab || !tab.id) {
        showCardStatus("Open a Sentry issues page, then try again.");
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "SEC_COLLECT_ISSUES" }, function (response) {
        if (chrome.runtime.lastError || !response) {
          showCardStatus("Couldn't read issues from that tab — reload the Sentry page and try again.");
          return;
        }
        const issues = response.issues || [];
        if (!issues.length) {
          showCardStatus("No issues found on that page yet.");
          return;
        }

        const top = issues.slice().sort((a, b) => b.cost - a.cost).slice(0, TOP_N);
        const total = issues.reduce((sum, it) => sum + it.cost, 0);
        const size = cardSizeSel.value === "square" ? "square" : "landscape";
        const dims = SEC_CARD.SIZES[size];

        cardCanvas.width = dims.w;
        cardCanvas.height = dims.h;

        SEC_CARD.render(cardCanvas, {
          issues: top,
          total: total,
          count: issues.length,
          size: size
        }).then(function () {
          cardPreviewWrap.style.display = "block";
        });
      });
    });
  }

  function downloadCard() {
    cardCanvas.toBlob(function (blob) {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sentry-cost-card.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  }

  generateCardBtn.addEventListener("click", generateCard);
  downloadCardBtn.addEventListener("click", downloadCard);

  // Staleness, made visible.
  (function showVerified() {
    const el = $("verified");
    const link = $("source");
    if (PRICING.source) link.href = PRICING.source;
    if (!PRICING.verified) return;
    const d = new Date(PRICING.verified + "T00:00:00");
    const pretty = isNaN(d)
      ? PRICING.verified
      : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    el.textContent = "Rates last verified: " + pretty;
  })();
})();