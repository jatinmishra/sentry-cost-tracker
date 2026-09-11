/**
 * Shareable cost card — renders a PNG-ready summary onto a <canvas> using the
 * issue data + costs already computed by content.js (see collectIssueData()).
 * Pure rendering only: no DOM wiring, no messaging, no network. System fonts only.
 */
(function (root) {
  "use strict";

  const SIZES = {
    landscape: { w: 1200, h: 630 },
    square: { w: 1080, h: 1080 }
  };

  const ACCENT = "#b199e0";
  const BG_TOP = "#231c2e";
  const BG_BOTTOM = "#140f1c";
  const FG = "#f3f1f7";
  const MUTED = "rgba(243, 241, 247, 0.62)";
  const LINE = "rgba(243, 241, 247, 0.14)";
  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

  // Mirrors content.js's formatCost — kept local since content scripts and the
  // popup run in separate JS worlds and can't share a function reference.
  function formatCost(cost) {
    if (!isFinite(cost)) return "—";
    if (cost >= 1) return "$" + cost.toFixed(2);
    if (cost >= 0.01) return "$" + cost.toFixed(3);
    return "$" + cost.toFixed(4);
  }

  // Binary-search the longest prefix (+ ellipsis) that fits maxWidth, so titles
  // truncate by actual pixel width rather than a guessed character count.
  function truncateToWidth(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = text.slice(0, mid).trimEnd() + "…";
      if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + "…";
  }

  function loadIcon() {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = chrome.runtime.getURL("icons/icon128.png");
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Hand-tuned pixel layouts per format rather than one proportional formula —
  // easier to keep every element clear of overlap at either aspect ratio.
  function layoutFor(isSquare) {
    return isSquare
      ? {
          pad: 72, iconSize: 64,
          titleFont: 32, taglineFont: 17, sectionFont: 30,
          rowH: 88, rankR: 24, rankFont: 20, rowTitleFont: 26, metaFont: 19, costFont: 30,
          bannerH: 110, bannerLabelFont: 19, bannerValueFont: 40,
          footerFont: 17, rowGap: 40, bannerGap: 40, footerGap: 44, headerGap: 46
        }
      : {
          pad: 48, iconSize: 40,
          titleFont: 22, taglineFont: 12, sectionFont: 19,
          rowH: 52, rankR: 14, rankFont: 13, rowTitleFont: 17, metaFont: 12, costFont: 20,
          bannerH: 68, bannerLabelFont: 12, bannerValueFont: 26,
          footerFont: 12, rowGap: 18, bannerGap: 20, footerGap: 24, headerGap: 26
        };
  }

  async function render(canvas, data) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const isSquare = data.size === "square";
    const L = layoutFor(isSquare);
    const pad = L.pad;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const icon = await loadIcon();
    const iconY = pad;
    const iconCenterY = iconY + L.iconSize / 2;
    if (icon) ctx.drawImage(icon, pad, iconY, L.iconSize, L.iconSize);

    const textX = pad + L.iconSize + 16;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = FG;
    ctx.font = "600 " + L.titleFont + "px " + FONT;
    ctx.fillText("Sentry Error Cost Tracker", textX, iconCenterY - 4);
    ctx.fillStyle = MUTED;
    ctx.font = "400 " + L.taglineFont + "px " + FONT;
    const taglineBaseline = iconCenterY + L.taglineFont + 6;
    ctx.fillText("see what your logs really cost", textX, taglineBaseline);

    // The header's actual bottom edge is whichever is lower: the icon, or the
    // tagline text (which can overhang a short icon once its own line-height is
    // counted) — using the icon alone here is what caused the cramped heading.
    const iconBottom = iconY + L.iconSize;
    const taglineBottom = taglineBaseline + Math.round(L.taglineFont * 0.3);
    let y = Math.max(iconBottom, taglineBottom) + L.headerGap;

    ctx.fillStyle = FG;
    ctx.font = "600 " + L.sectionFont + "px " + FONT;
    ctx.fillText("Top costly issues", pad, y);
    y += Math.round(L.sectionFont * 0.7);

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    y += Math.round(L.rowGap * 1.4);

    const rowsStartY = y;
    const maxTitleWidth = w - pad * 2 - (isSquare ? 260 : 220) - L.rankR * 2;

    data.issues.forEach(function (issue, i) {
      const rowTop = rowsStartY + i * L.rowH;
      const midY = rowTop + L.rowH / 2;
      const rankCx = pad + L.rankR;

      ctx.beginPath();
      ctx.fillStyle = i === 0 ? ACCENT : "rgba(177, 153, 224, 0.35)";
      ctx.arc(rankCx, midY, L.rankR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i === 0 ? BG_BOTTOM : FG;
      ctx.font = "700 " + L.rankFont + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), rankCx, midY + 1);

      const titleX = pad + L.rankR * 2 + 16;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = FG;
      ctx.font = "600 " + L.rowTitleFont + "px " + FONT;
      ctx.fillText(truncateToWidth(ctx, issue.title, maxTitleWidth), titleX, midY - 4);

      ctx.fillStyle = MUTED;
      ctx.font = "400 " + L.metaFont + "px " + FONT;
      ctx.fillText(issue.events.toLocaleString() + " events", titleX, midY + L.metaFont + 6);

      ctx.fillStyle = ACCENT;
      ctx.font = "700 " + L.costFont + "px " + FONT;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(formatCost(issue.cost), w - pad, midY);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (i < data.issues.length - 1) {
        ctx.strokeStyle = LINE;
        ctx.beginPath();
        ctx.moveTo(pad, rowTop + L.rowH);
        ctx.lineTo(w - pad, rowTop + L.rowH);
        ctx.stroke();
      }
    });

    y = rowsStartY + data.issues.length * L.rowH + L.bannerGap;

    roundRect(ctx, pad, y, w - pad * 2, L.bannerH, 14);
    ctx.fillStyle = "rgba(177, 153, 224, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(177, 153, 224, 0.4)";
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = "500 " + L.bannerLabelFont + "px " + FONT;
    ctx.fillText(
      "Estimated cost across " + data.count + " visible issue" + (data.count === 1 ? "" : "s"),
      pad + 20,
      y + L.bannerH / 2 - 12
    );
    ctx.fillStyle = FG;
    ctx.font = "700 " + L.bannerValueFont + "px " + FONT;
    ctx.fillText(formatCost(data.total) + " / mo", pad + 20, y + L.bannerH / 2 + Math.round(L.bannerValueFont * 0.6));

    const footerDividerY = y + L.bannerH + L.footerGap;
    const footerBaselineY = footerDividerY + Math.round(L.footerGap * 0.9);
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(pad, footerDividerY);
    ctx.lineTo(w - pad, footerDividerY);
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = "400 " + L.footerFont + "px " + FONT;
    ctx.textAlign = "left";
    ctx.fillText("Indicative estimate, not an actual bill · Sentry Error Cost Tracker", pad, footerBaselineY);
    ctx.textAlign = "right";
    ctx.fillText("github.com/jatinmishra/sentry-cost-tracker", w - pad, footerBaselineY);
    ctx.textAlign = "left";
  }

  root.SEC_CARD = { SIZES: SIZES, render: render };
})(typeof window !== "undefined" ? window : this);
