/**
 * Sentry Errors pricing — marginal per-event rates.
 * Source: https://docs.sentry.io/pricing/#errors-pricing
 *
 * NOTE: The first 50k errors/month are included in the base plan. These rates
 * are the *marginal* cost of events above 50k, and which tier applies depends on
 * your org's TOTAL monthly error volume — not a single issue's count. Since this
 * extension only sees per-issue counts, it estimates cost = events * (selected rate).
 */
(function (root) {
  const SENTRY_ERROR_PRICING = {
    tiers: [
      { id: "50k-100k", label: ">50k – 100k", rates: { team_reserved: 0.00029,  team_payg: 0.0003625, business_reserved: 0.00089, business_payg: 0.0011125 } },
      { id: "100k-500k", label: ">100k – 500k", rates: { team_reserved: 0.000175, team_payg: 0.0002188, business_reserved: 0.0005,  business_payg: 0.000625  } },
      { id: "500k-10M", label: ">500k – 10M",   rates: { team_reserved: 0.00015,  team_payg: 0.0001875, business_reserved: 0.0003,  business_payg: 0.000375  } },
      { id: "10M-20M",  label: ">10M – 20M",    rates: { team_reserved: 0.00013,  team_payg: 0.0001625, business_reserved: 0.00026, business_payg: 0.000325  } },
      { id: "20M+",     label: ">20M",          rates: { team_reserved: 0.00012,  team_payg: 0.00015,    business_reserved: 0.00024, business_payg: 0.0003    } }
    ],

    plans: [
      { id: "team", label: "Team" },
      { id: "business", label: "Business" }
    ],

    billingTypes: [
      { id: "payg", label: "Pay-as-you-go" },
      { id: "reserved", label: "Reserved" }
    ],

    // Rates transcribed by hand from the source below. Bump this date whenever
    // you re-check the pricing page so staleness is visible, not silent.
    verified: "2026-06-28",
    source: "https://docs.sentry.io/pricing/#errors-pricing",

    // "auto" => follow the surrounding Sentry theme (adapts to light/dark).
    // Any other value is an explicit user override.
    DEFAULTS: {
      plan: "business",
      billingType: "payg",
      tier: "50k-100k",
      labelColor: "auto",
      labelSize: "auto"
    },

    getRate(settings) {
      const s = Object.assign({}, this.DEFAULTS, settings || {});
      const tier = this.tiers.find(t => t.id === s.tier) || this.tiers[0];
      const key = `${s.plan}_${s.billingType}`;
      return tier.rates[key];
    },

    labelFor(settings) {
      const s = Object.assign({}, this.DEFAULTS, settings || {});
      const plan = (this.plans.find(p => p.id === s.plan) || {}).label || s.plan;
      const bt = (this.billingTypes.find(b => b.id === s.billingType) || {}).label || s.billingType;
      const tier = (this.tiers.find(t => t.id === s.tier) || {}).label || s.tier;
      return { plan, billingType: bt, tier };
    }
  };

  root.SENTRY_ERROR_PRICING = SENTRY_ERROR_PRICING;
})(typeof window !== "undefined" ? window : this);