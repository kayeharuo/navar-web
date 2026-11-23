# NavAR Onboarding Fee and Subscription Tier Design

Version 4.1: the onboarding fee is calculated per mall from its floors, stores, connector points and rent. The subscription is one fixed annual price per tier: Basic ₱25,000, Standard ₱33,000, Premium ₱47,000. Only the ₱740 beacon price is confirmed; every other rate is a placeholder (rate card v4.1-draft-2026-11-21).

## 1. Current rates and changes from version 4

- **Beacon plus installation is ₱815 per installed beacon** (₱740 beacon + ₱75 installation), up from ₱800. Spare beacons stay at ₱740 because they are not installed yet.
- **Onboarding margin is 20%**, restored from 10%, so the margin price is cost ÷ 0.80. This is a margin on the selling price, not a 20% markup on cost.
- **Contingency is 10%**, restored from 5%.
- **Spares remain 5% of installed beacons**, rounded up.
- **Beacon replacement is ₱815. Extra stall prices stay unchanged:** Basic ₱1,100, Standard ₱1,000, and Premium's first 10 per year free, then ₱1,000. No new tier-specific labor surcharge is introduced.
- **Map updates keep their fixed prices per floor:** ₱28,000 Basic and ₱25,000 Standard and Premium, subject to Premium's free allowance.
- **The subscription prices are unchanged**, because they depend on how many malls share the platform cost.

Carried over from version 3: stores and tenants are separate inputs, connector points replace the fixed 4 beacons per floor, floor calibration is part of mapping, and rent sets an affordability ceiling. The beacon is a programmable nRF52810 iBeacon configured through its app, and the 60 sqm of hallway per beacon is an assumption that must be tested with real units.

## 2. Inputs the mall provides

Six inputs drive the estimate, and stores beyond the tenant count are treated as mall-owned.

| Input | Required | Used for |
| --- | --- | --- |
| Floors, with floor area in sqm for each | Yes | Mapping, testing, hallway default |
| Hallway and common area per floor, in sqm | No, defaults to 30% of the floor area | Hallway beacons |
| Connector points per floor (entrances and exits, escalator, elevator and stair landings) | No, defaults to 4 per floor | Connector beacons |
| Number of stores S (all units, tenant or mall-owned) | Yes | Store beacons, store mapping and beacon pairing |
| Number of tenants T (rent-paying, at most S) | Yes | Mall-owned count, rent revenue |
| Average monthly rent per tenant R (PHP) | Yes | Affordability ceiling |

Mall-owned stores M = S − T is calculated and shown read-only. Hallway area is read off the floor plan; when it is left blank the form shows the assumed value as a hint. The super admin corrects any estimate after the site survey. A very large anchor store may need more than one beacon, which is also handled at the site survey.

## 3. Onboarding fee

The onboarding fee targets a 20% margin, held to a ceiling of 1% of the mall's annual tenant rent, and never below cost. It does not depend on the subscription tier. The ceiling can reduce the realized margin.

**Beacon count**

- Store beacons = S, one per store unit.
- Hallway beacons = Σ ⌈hallway area of the floor ÷ 60 sqm⌉, about one beacon per 10 m of a 6 m wide hallway (untested assumption).
- Connector beacons = one per connector point, summed over all floors.
- Installed beacons N = store + hallway + connector. Spare beacons = ⌈5% × N⌉, bought now and installed only when needed.

**Cost lines**

| Line | Calculation | Why |
| --- | --- | --- |
| Installed beacons | N × ₱815 | ₱740 beacon + ₱75 installation |
| Spare beacons | spares × ₱740 | Bought now, installed later |
| Mapping | total sqm × ₱4 | 0.008 h per sqm at ₱500 per hour, including calibration in the mapping tool |
| Testing | total sqm × ₱1.50 | 0.003 h per sqm at ₱500 per hour |
| Store mapping and beacon pairing | S × ₱125 | 15 minutes per store to create it, place its node and pair its beacon |
| Training and travel | ₱10,000 | Same for any mall |
| Contingency | 10% of the lines above | Buffer for surprises |

**Fee formula**

```latex
\text{Cost} = 1.10 \times (815N + 740\,\text{spares} + 5.50\,\text{sqm} + 125S + 10000)
```

```latex
\text{MarginPrice} = 1000 \times \left\lceil \frac{\text{Cost}}{0.80 \times 1000} \right\rceil
\text{Ceiling} = 1000 \times \left\lfloor \frac{0.01 \times 12 \times T \times R}{1000} \right\rfloor
\text{Fee} = \max(\text{Cost},\ \min(\text{MarginPrice},\ \text{Ceiling}))
```

The margin price is rounded up to ₱1,000 and the ceiling is rounded down to ₱1,000. If the ceiling is below cost, the fee equals cost and the quote is flagged for super admin review.

**Example Mall, step by step**

Example Mall has 150 stores, 120 tenants (so 30 are mall-owned) and ₱50,000 average rent. Its floors:

| Floor | Floor area | Hallway and common area | Connector points |
| --- | --- | --- | --- |
| Ground | 4,000 sqm | 1,200 sqm | 8 (3 entrances, 2 escalator, 2 elevator, 1 stair) |
| 2nd | 4,000 sqm | 1,200 sqm | 6 |
| 3rd | 2,000 sqm | 600 sqm | 5 |
| Total | 10,000 sqm | 3,000 sqm | 19 |

1. **Beacons:** 150 store + 50 hallway (20 + 20 + 10) + 19 connector = 219 installed, plus 11 spares (5% of 219, rounded up).
2. **Cost:** 219 × ₱815 = ₱178,485; 11 × ₱740 = ₱8,140; mapping ₱40,000; testing ₱15,000; store pairing 150 × ₱125 = ₱18,750; training and travel ₱10,000. The subtotal is ₱270,375, and 10% contingency adds ₱27,037.50, so the cost is ₱297,412.50.
3. **Margin price:** ₱297,412.50 ÷ 0.80 = ₱371,765.625, rounded up to ₱372,000.
4. **Ceiling:** yearly tenant rent is 120 × ₱50,000 × 12 = ₱72,000,000, and 1% of that is ₱720,000.
5. **Fee:** the smaller of ₱372,000 and ₱720,000 is **₱372,000**, which is above cost.

**Three malls compared**

| Line | Small mall | Example Mall | Large mall |
| --- | --- | --- | --- |
| Floors (total sqm) | 1 (1,500) | 3 (10,000) | 5 (25,000) |
| Stores / tenants | 25 / 20 | 150 / 120 | 300 / 250 |
| Average rent | ₱30,000 | ₱50,000 | ₱60,000 |
| Hallway / connector beacons | 8 / 4 | 50 / 19 | 125 / 44 |
| Installed N / spares | 37 / 2 | 219 / 11 | 469 / 24 |
| Installed beacons (× ₱815) | ₱30,155 | ₱178,485 | ₱382,235 |
| Spare beacons (× ₱740) | ₱1,480 | ₱8,140 | ₱17,760 |
| Mapping and testing (₱5.50 per sqm) | ₱8,250 | ₱55,000 | ₱137,500 |
| Store mapping and pairing (₱125 each) | ₱3,125 | ₱18,750 | ₱37,500 |
| Training and travel | ₱10,000 | ₱10,000 | ₱10,000 |
| Contingency (10%) | ₱5,301 | ₱27,037.50 | ₱58,499.50 |
| Cost | ₱58,311 | ₱297,412.50 | ₱643,494.50 |
| Cost ÷ 0.80, rounded up | ₱73,000 | ₱372,000 | ₱805,000 |
| Ceiling (1% of yearly rent) | ₱72,000 | ₱720,000 | ₱1,800,000 |
| **Onboarding fee** | **₱72,000** | **₱372,000** | **₱805,000** |

The small mall reaches its ₱72,000 ceiling, reducing its ₱73,000 margin price by ₱1,000. The other two malls remain below their ceilings. All three fees remain above cost.

**What the mall sees (Example Mall)**

| Group | Amount |
| --- | --- |
| Beacons and installation (including spares) | ₱186,625 |
| AR development (mapping and testing) | ₱55,000 |
| Store mapping and beacon pairing | ₱18,750 |
| Training and travel | ₱10,000 |
| Contingency | ₱27,037.50 |
| Service margin and rounding | ₱74,587.50 |
| **Total** | **₱372,000** |

When the ceiling applies, a line "Adjusted to your mall's rental income" shows the reduction. The fee is locked when the quote is finalized; any beacons needed beyond the purchased count are billed at ₱815 each.

## 4. Subscription

There are three tiers, each with one fixed annual price that is the same for every mall: Basic ₱25,000, Standard ₱33,000 and Premium ₱47,000 (about ₱2,083, ₱2,750 and ₱3,917 per month). Everything that grows with mall size is paid in the onboarding fee or per use, so the subscription only covers what is the same for every mall: the platform, support and analytics. Capacity (floors, stores, tenants, beacons) comes from the mall's quote and is snapshotted on the contract.

### How the prices are built

| Yearly cost per mall | Basic | Standard | Premium |
| --- | --- | --- | --- |
| Shared platform | ₱7,200 | ₱7,200 | ₱7,200 |
| Software maintenance and updates | ₱6,000 | ₱6,000 | ₱6,000 |
| Remote support (12 / 24 / 48 hours) | ₱3,000 | ₱6,000 | ₱12,000 |
| Included on-site visits (1 / 2 / 4 at ₱2,250) | ₱2,250 | ₱4,500 | ₱9,000 |
| Data storage and analytics history | ₱1,000 | ₱2,000 | ₱3,000 |
| **NavAR's cost** | **₱19,450** | **₱25,700** | **₱37,200** |
| **Annual subscription** (cost ÷ 0.80, rounded up to ₱1,000) | **₱25,000** | **₱33,000** | **₱47,000** |

Assumptions behind the lines:

- **Shared platform:** about ₱6,000 per month for the whole system (backend, web hosting, email, domain and monitoring, app store accounts), split across an assumed 10 malls. Supabase Pro is listed at about $25 per month per organization, and the peso figures use about ₱58 per USD.
- **Software maintenance:** about 20 developer hours per month for the whole platform at ₱250 per hour, split across 10 malls.
- **Support:** ₱250 per hour, at 1, 2 or 4 hours per month by tier.
- **On-site visits:** about ₱2,250 each (5 hours at ₱250 plus ₱1,000 transport).
- **Data and analytics:** storage and reporting for 30 days, 12 months or full history.

Against income, Basic is about 0.35% of a small mall's yearly rent (20 tenants × ₱30,000 × 12 = ₱7,200,000), and Premium is about 0.07% of Example Mall's (₱72,000,000). The prices assume roughly 10 malls; with only 3, the shared platform line would be about ₱24,000 per mall instead of ₱7,200. The subscription keeps the 20% margin. At a 10% margin the prices would be about ₱22,000, ₱29,000 and ₱42,000.

### Tier features

| Feature | Basic | Standard | Premium |
| --- | --- | --- | --- |
| **Annual subscription fee** | **₱25,000** | **₱33,000** | **₱47,000** |
| Grace period after expiry | 15 days | 30 days | 45 days |
| Reinstatement fee | 20% | 15% | 10% |
| Mall admin accounts | 2 | 4 | 8 |
| Analytics history | 30 days | 12 months | Full |
| Analytics tools | Summary dashboard | + CSV export, date filters | + all chart tabs |
| Remote response | Within 5 business days | Within 2 business days | Next business day |
| On-site dispatch | Within 6 business days | Within 4 business days | Within 48 hrs |
| Included on-site visits per year | 1 | 2 | 4 |
| Extra on-site visit | ₱2,250 | ₱2,250 | ₱2,250 |
| Beacon replacement (beacon + installation) | ₱815 each | ₱815 each | ₱815 each |
| Fee per extra stall | ₱1,100 | ₱1,000 | First 10 per year free, then ₱1,000 |
| Paid map update (fixed price per floor) | ₱28,000 | ₱25,000 | First update each year free (up to one floor), then ₱25,000 per floor |
| Map update queue (after launch) | Standard | Priority | Dedicated slot |

### Charged per use

- **Beacon replacement and extra visits:** paid on-site and recorded by the super admin on the beacon ticket, with no online payment.
- **Extra stalls:** charged when the stall application is approved. An extra stall costs NavAR about ₱940 (₱740 beacon + ₱75 installation + ₱125 pairing). Prices remain fixed at ₱1,100 for Basic and ₱1,000 for Standard; Premium gets the first 10 per year free, then ₱1,000. The ₱125 pairing labor assumption is the same across tiers. These fixed prices are retained by choice and are not recalculated using the onboarding margin.
- **Map updates (layout changes):** a fixed price per floor updated: ₱28,000 on Basic, ₱25,000 on Standard, and ₱25,000 on Premium after its first free update each year. The mall only picks the floors it is changing and does not enter sqm or store counts. Under the revised 10% contingency, a typical 4,000 sqm floor with about 10 changed stores has an estimated cost of ₱25,575 (1.10 × (4,000 × ₱5.50 + 10 × ₱125)). The fixed map prices remain unchanged: Standard and Premium are ₱575 below this example cost, while Basic is ₱2,425 above it. They do not automatically target the onboarding margin. This is paid through a payment request, and the update then joins the tier's queue.
- **Free:** tenant details, hours and promos edited by the mall admin, and replacing a store in the same slot. A new wing or expansion is a new quote.

### Suggested tier

The inquiry suggests Basic for up to 60 stores, Standard for 61 to 200 and Premium for 201 or more. The suggestion is optional and not final, and the thresholds are placeholders.

## 5. Onboarding and subscription flow

Steps 1 to 4 happen before any account exists, so they are a public inquiry; accounts are created at step 6.

1. **Prospect enters the inputs:** floors with sqm, optional hallway sqm, connector points per floor, stores, tenants and average rent. The page shows the live estimate with the full breakdown, the mall-owned stores derived, and an "adjusted to your mall's rental income" line whenever the ceiling applies.
2. **Prospect sees the three tiers** with their fixed annual prices. One is marked suggested by store count, with a note that the choice is optional, not final, and can change with budget. They may skip it.
3. **Prospect enters mall details:** name, address, contact person and email.
4. **Submitting creates an inquiry** that stores a quote snapshot (inputs, rate card version, breakdown, preferred tier, 30-day expiry) and emails a magic link to the inquiry page with the conversation thread.
5. **Super admin reviews and discusses** in the thread. After the site survey they may adjust the beacon count or inputs, with an audit entry. Finalize locks the onboarding fee, capacity and tier.
6. **Convert to mall** creates the mall, with floors prefilled from the quote, and the mall admin invite.
7. **Mall admin logs in,** reviews the mall info, pays the onboarding fee through PayMongo, and submits the application.
8. **Application and AR development** run as already specified up to Ready, with the first build queued first come, first served for every mall. The mall admin then confirms nodes, edges and calibration.
9. **Mall admin pays the first annual subscription fee** at the tier's fixed price, AR is published, and the contract row is created (start = publish date, end = one year later).
10. **After publish,** upgrades are immediate and downgrades take effect at renewal.

**Rules**

- Tier changes are free until the first publish, because nothing has been paid for the subscription yet.
- An upgrade charges (new price − old price) × days remaining ÷ 365 and keeps the original end date. For example, Basic to Standard with 214 days left costs (₱33,000 − ₱25,000) × 214 ÷ 365 = ₱4,690. It creates a new contract row, and a downgrade is a scheduled row that starts at renewal.
- Fees stay locked at finalization even if the rate card changes later.
- After publish, no new stores can be added. A tenant who leaves is replaced by deactivating the store and reusing its slot, which is free.
- Extra stalls go through the stall application and are charged on approval. Layout changes are a paid map update, which joins the tier's queue.
- Beacon replacements and extra visits are handled through customer care or a beacon ticket, paid on-site and recorded by the super admin.

## 6. Database mapping

The subscription entry is the existing `contract` table, and the quote uses one table pair. Preserve existing contracts and finalized quote snapshots. Add new columns first and drop old ones only after the app no longer reads them.

- **`contract` is the subscription entry.** One row per tier period, with a change type (initial, upgrade, downgrade, renewal) and a link to the previous contract. Tier history is those rows in order, and a scheduled downgrade is a future-dated row. Snapshot the tier, annual fee, onboarding fee, dates, grace days, reinstatement rate and the contracted capacity (floors, stores, tenants, beacons).
- **`subscription_tier`:** `s_tier_annual_fee` becomes the fixed price (₱25,000 / ₱33,000 / ₱47,000). Drop the max GFA, max floors, included tenants, beacon allocation, onboarding fee, diagnosis, spare units and replacement text columns. Add included visits per year (1 / 2 / 4) and free stalls per year (0 / 0 / 10). Repurpose the map updates column as free map updates per year (0 / 0 / 1) and relabel the AR development queue as the map update queue.
- **Payments:** extend `contract_payment_request` with the types onboarding, subscription, upgrade, renewal, reinstatement, stall\_addon and map\_update, plus the PayMongo payment ID so the webhook is idempotent. Payment history is then a query.
- **`beacon_ticket`:** add an on-site fee and a paid-at timestamp, filled in by the super admin for beacon replacements and extra visits.
- **`onboarding_quote` and `onboarding_quote_floor`:** store floors, floor area, hallway sqm and connector points per floor, stores, tenants, average rent, the beacon estimate, the cost breakdown, the rate card version, preferred tier, status, expiry and the finalized fee. `mall_onboarding.offer` can hold the finalized breakdown.
- **Rate card:** `rate-card-v4-1.json` is the current versioned config (`v4.1-draft-2026-11-21`), also stored in `navar_rate_card`. Each quote stores the version it used. Keep earlier rate cards and finalized quotes unchanged. Migration `41_pricing_v4_1.sql` applies the revised rates while preserving the stall prices.
- **Mall record:** keep store count and tenant count; mall-owned stores are derived as stores minus tenants.
