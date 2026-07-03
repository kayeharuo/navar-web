# NavAR Subscription Tiers — Restructured

*Scoped for a 4-person capstone team: three tiers (Basic, Standard, Premium), no Enterprise, no automated battery tracking, one analytics refresh rate. Complexity that doesn't need to be built for the capstone has been cut.*

## 1. Why floors alone don't work as a sizing metric

SM Seaside City Cebu has 3 floors but an enormous footprint. A mall in Metro Manila can have 6 floors on a much smaller lot. Pricing and beacon allocation based on floor count alone would either overcharge a tall-but-compact mall or undercharge a short-but-sprawling one.

**Fix:** the primary sizing input becomes **total Gross Floor Area (GFA, in sqm)**. Floor count and tenant/store count remain inputs the chatbot collects (they still affect AR development effort — each floor needs its own Unity scene, calibration pass, and node graph), but tier qualification is driven by GFA first, with floors and store count as secondary caps.

## 2. Beacon counts — not every node needs one

Since 1 beacon = 1 physical BLE device, beacon count needs to track **path complexity** (corridor junctions, entrances, decision points), not raw floor area — a 3-floor, 15,000 sqm mall easily has 150+ real decision points once actual corridors are mapped.

**Formula:** `Estimated beacons = ceil(GFA in sqm ÷ 150) + number of tenant nodes (stores + stalls combined)`, with a floor-based minimum of **18 beacons/floor** for junction redundancy. This counts corridor junctions plus one beacon per tenant node — fixed store or mobile stall, both need their own entrance beacon.

**Not every node in the map editor is a beacon.** The node editor supports many node types (Walkway, Junction, Store Entrance, Stall/Kiosk, Floor Transitions, plus Emergency, Facilities, and Landmark markers like fire extinguishers, restrooms, ATMs, seating areas). Only positioning-critical types get dedicated hardware:
- **Beacon-bearing:** Store Entrance, Stall/Kiosk, Mall Exit, Floor Transitions, and corridor Junction nodes spaced for trilateration accuracy.
- **Map-only, no beacon:** Emergency/Facilities/Landmark markers and plain Walkway waypoints — positioned relative to the nearest actual beacon.

So **total node count** (map complexity) and **beacon count** (hardware cost) are two different numbers — the formula above only counts beacon-bearing nodes. Stall nodes are counted separately in Section 9.

**Hardware note:** the beacon hardware is a bare nRF52810 module + CR2477 coin cell (generic/bulk-sourced, not a commercial product like Kontakt.io or Estimote). It does not self-report battery level — see Section 8. The coin cell housing is a simple pop-open design, swappable by non-technical staff, but diagnosing a dead beacon, sourcing a replacement, and recalibrating it into the node graph is not something mall staff can do — that stays with NavAR at every tier.

## 3. Cost structure: fixed Annual Subscription Fee + fixed-per-tier Onboarding Fee

Two different things, kept separate:

- **Annual Subscription Fee** — the actual subscription. One fixed number per tier (₱60,000 / ₱150,000 / ₱350,000), same for every mall in that tier. Covers hosting, platform maintenance, admin accounts, analytics, AR dev queue priority, customer success.
- **Onboarding & AR Dev Fee** — a separate one-time implementation fee (standard SaaS practice: fixed recurring license + one-time setup cost). Pays for floor plan digitization, node mapping, beacon hardware, installation, and calibration.

### Sequence — price is fixed before any real work happens
Mapping only makes sense to do *after* payment is committed, so pricing comes from **self-reported mall size** (GFA, floor count, store count via the chatbot), not from mapping the mall first:

1. Mall reports size → tier assigned → **fixed price quoted immediately**.
2. Client signs, pays 50% of the fixed Onboarding Fee.
3. Digital node mapping happens (software only, using the submitted floor plan) — the tier's included beacon allocation is the working budget.
4. Physical beacon installation follows the finalized digital map, beacon-by-beacon.
5. QA walkthrough, then go-live: remaining 50% + full Year 1 Subscription Fee.

### If the real layout needs more beacons than the tier's included allocation
`Add-on Beacon Fee = ₱900 × beacons beyond the tier's included allocation`

On-site flow: technician finds the gap during install → submits the add-on count → mall admin approves → wallet is deducted **before** those beacons are installed. If the wallet can't cover it, those specific nodes are marked pending and installed once topped up — no work happens ahead of confirmed payment.

### Payment schedule

| Milestone | Payment |
|---|---|
| Tier quote (before signing) | — price locked before any mapping work begins |
| Contract signing | 50% of the fixed Onboarding Fee |
| Mid-install (if needed) | Add-on Beacon Fee, per instance |
| Go-live | Remaining 50% of Onboarding Fee + full Year 1 Annual Subscription Fee |
| Annual renewal | Full Annual Subscription Fee, billed on the anniversary of go-live |

**Why the subscription year starts at go-live, not signing:** a mall isn't using the platform while it's still being built, so charging "live service" time during the build phase would be unfair.

**Worked example (Standard tier, 5 floors, 180 beacons quoted, 10 extra needed on-site):**
- Onboarding fee = (₱10,000 × 5) + (₱900 × 180) = ₱212,000
- At signing: ₱106,000 (50%)
- Mid-install add-on: 10 × ₱900 = ₱9,000, deducted from wallet before install
- At go-live: ₱106,000 (50%) + ₱150,000 (Year 1 subscription) = ₱256,000
- Year 2 renewal: ₱150,000

## 4. Travel/distance — handled outside the tier price

A flat **logistics zone surcharge** applies only when an actual on-site visit happens (install, hardware fault dispatch), billed per visit, same across all tiers:

| Zone | Coverage | Surcharge |
|---|---|---|
| Zone A | Cebu City | None |
| Zone B | Rest of Visayas | ₱5,000/visit + actual transport |

Service area is scoped to **Cebu City + rest of Visayas** for now — a more credible position for a capstone-scale team than pricing Luzon/overseas travel with no real data.

## 5. Analytics — one refresh rate for all tiers

Keeping this simple: daily snapshot tables are written for every mall regardless of tier (needed for trend reporting, cheap to maintain). Dashboard refresh is **daily for every tier** — no real-time or hourly variation to build or defend. History depth is the only thing that varies:

| Tier | Analytics History |
|---|---|
| Basic | Last 30 days |
| Standard | Full history |
| Premium | Full history |

## 6. Data export — included in every tier

CSV export, on-demand, full history, identical across all tiers. No tiering logic to build or explain.

---

## 7. Full Tier Table

| Feature | Basic | Standard | Premium |
|---|---|---|---|
| **Max Coverage Area (GFA)** | up to 15,000 sqm | up to 50,000 sqm | up to 150,000 sqm |
| **Max Floors** | 2 | 4 | 6 |
| **Included Tenant Nodes (Stores + Stalls combined)**‡ | 75  | 260  | 650  |
| **Beacon Allocation (included)**†† | 200 | 570 | 1,650 |
| **Annual Subscription Fee** | ₱60,000 | ₱150,000 | ₱350,000 |
| **Onboarding & AR Dev Fee**†† | ₱187,500 | ₱594,600 | ₱1,585,000 |
| **Grace Period (after expiry)** | 15 days | 30 days | 45 days |
| **Reinstatement Fee** | 20% | 15% | 10% |
| **Map Updates / Year** | 2 | 4 | 8 |
| **Mall Admin Accounts** | 2 | 4 | 8 |
| **Additional Stall Fee (beyond included)** | ₱3,500/stall | ₱3,500/stall | ₱3,500/stall |
| **Analytics History** | 30 days | Full | Full |
| **AR Development Queue** | Standard | Priority | Dedicated slot |
| **Maintenance — Remote Response** | Within 5 business days | Within 2 business days | Next business day |
| **Maintenance — On-site Dispatch**§ | within 6 business days | within 4 business days | within 48 hrs |
| **Diagnosis, Full Unit Replacement & Recalibration** | Yes | Yes | Yes |
| **Replacement Unit Cost** | Mall pays cost price | Included, no charge | Included, no charge |
| **Spare Units On-Site** | No | No | Yes — pre-stocked, cuts replacement delay |
| **Battery (Coin Cell) Swap** | Mall self-swaps (simple pop-open housing) | Mall self-swaps, or bundled into next scheduled maintenance visit at no charge | Bundled into next scheduled maintenance visit — no separate trip |

†† Beacon counts only include node types that need dedicated hardware — corridor junctions, store entrances, floor transitions, included stall nodes — not purely informational markers (Section 2). The ₱900/beacon rate is worth sanity-checking against actual bulk cost (~₱450/unit landed) plus labor before locking in — at ₱500/beacon, onboarding fees would instead be ₱117,500 / ₱357,000 / ₱925,000.
‡ Each tier includes a combined pool of tenant nodes (fixed stores + mobile stalls together, Section 9). Fixed stores don't change this count when tenants swap. Mobile stalls are installed as vendors actually claim a spot, not pre-wired speculatively; beyond the included pool, additional stall nodes are billed per-unit.
§ On-site dispatch applies within Cebu City and the rest of Visayas (Section 4). Logistics surcharge applies to every visit outside Cebu City regardless of tier.

Data export is identical across all tiers — CSV, on-demand, full history — so it's not repeated as a row.

Battery status reporting is also identical across all tiers: a mall admin manually flags "low battery" on a beacon from the dashboard when noticed (a dead zone, a shopper complaint) — no automated tracking, same mechanism regardless of tier.

---

## 8. Hardware ownership & maintenance — kept simple

Beacons stay NavAR-owned for the life of the contract, bundled into the subscription, not sold to the mall. Two reasons: one bill for the client (no separate capex approval), and consistent hardware protects positioning accuracy (mixed off-brand beacons would degrade the SMA → path-loss → WCL pipeline).

**Battery handling, simplified:** the hardware doesn't self-report battery level, and building an automated countdown/estimate system isn't worth the added complexity for this scope. Instead: **a mall admin manually flags "low battery" on a beacon from the dashboard** when they notice a dead zone or a shopper complaint — same as any other maintenance ticket, no separate tracking logic needed. Physical coin-cell swaps stay with mall staff (genuinely simple, pop-open housing) or get folded into a maintenance visit that's already happening for another reason — never a dedicated NavAR trip just for a battery.

**Hardware faults (beacon fully dead), by contrast, always need NavAR** — diagnosing the cause and recalibrating a replacement into the node graph requires positioning expertise a mall admin doesn't have. What differs by tier is who pays for the replacement unit (Basic pays cost price, Standard/Premium included) and how fast it happens (Premium has spares pre-stocked on-site).

**Is maintenance on a fixed schedule (every 2-3 months) or manually triggered?** Manually triggered, not calendar-automated — kept simple on purpose. There's no recurring "every X months, visit every mall" cycle to build or staff for. A visit happens only when: (a) a mall admin submits a maintenance ticket (fault report or a manually-flagged low battery), or (b) NavAR's own monitoring notices a positioning accuracy problem worth investigating. What varies by tier is how fast NavAR responds *after* a ticket comes in (Section 7's Remote Response / On-site Dispatch rows), not how often NavAR shows up on a calendar.

---

## 9. Structural changes & stall node handling

Two different kinds of "the mall changed" need two different mechanisms.

### A graph-design point that shapes this whole section
Inserting, removing, or moving a single node in a well-structured indoor nav graph is a **local operation** — it only affects the edges directly connected to that node, not the mall's entire graph. A single stall relocating doesn't require "redoing the map."

### Fixed leased units (e.g. H&M → Uniqlo, same unit)
No graph change at all. The node/beacon stays; only the tenant label changes. Free, instant, unlimited — covered by ordinary Map Updates.

### One combined pool: Fixed Tenant Nodes vs. Mobile Tenant Nodes
Stores and stalls are both "tenant nodes" now counted together in one included allocation per tier (Section 7) — the distinction that matters isn't store-vs-stall, it's **fixed vs. mobile**:

- **Fixed tenant node** (a leased unit, e.g. H&M → Uniqlo, same unit) — occupies a specific room, doesn't move. Swapping the occupant is zero graph change, just relabel. Free, instant, unlimited.
- **Mobile tenant node** (a stall in a hallway) — occupies hallway/common-area space, can move or disappear, but still needs its own beacon and entrance node. Installed only as vendors actually claim a spot, not pre-wired speculatively.
  - **A vendor takes over an existing mobile node** → zero graph change, just relabel. Free and instant.
  - **A stall closes and nothing replaces it right away** → the node is **deactivated**, not deleted. Instantly reusable when a new stall claims it.
  - **A new mobile node beyond the tier's included allocation** → one new node inserted, connected only to its immediate neighbors. Billed as a flat **Additional Stall Node Fee** (₱3,500/stall).

### Structural change requests (real rebuilds)
For actual physical changes — a new wing, an added floor, a corridor redesign — the mall submits a **Structural Change Request**, reusing the existing node graph and only charging for what changed:

`Change Request Fee = (₱10,000 × new/added floors) + (₱900 × new beacons added) + (₱300 × existing beacons requiring recalibration)`

Untouched floors and beacons carry over at no cost. Billed as a one-time fee, separate from the annual subscription.

### Change history
Individual node edits (a new stall, a relabeled unit) just need `created_at` / `deactivated_at` / `last_modified_by` fields — not a duplicated snapshot of the whole map. No full-versioning system needed for routine edits.

---

## 10. Chatbot tier-recommendation logic

Inputs: total GFA (sqm), number of floors, number of tenant nodes (stores + stalls combined), mall location/city.

```
estimated_beacons = ceil(GFA / 150) + num_tenant_nodes  [floor minimum: 18 × num_floors]

for tier in [Basic, Standard, Premium]:
    if GFA <= tier.max_GFA
       and floors <= tier.max_floors
       and num_tenant_nodes <= tier.max_tenant_nodes
       and estimated_beacons <= tier.max_beacons:
        recommend tier
        break

display:
  - recommended tier
  - estimated onboarding fee = (10,000 × floors) + (900 × estimated_beacons)
  - annual subscription fee for that tier
  - logistics zone (Cebu City / rest of Visayas) with surcharge note
```

Gives the prospect a real, itemized number on the marketing site instead of a vague "contact us."

---

## 11. Platform features required to support this model

Functional checklist for your dev team, not final UI.

### Super Admin platform (NavAR-internal)
- **Tier & pricing configuration** — edit tier brackets (GFA, floors, stores, included beacons/stalls), per-beacon rate, per-stall-node rate.
- **Mall account lifecycle management** — track status (quoted → signed → mapping → live → renewal).
- **Wallet administration** — view balances, confirm top-ups, trigger deductions (signing, go-live, renewal, add-on fees), view transaction history.
- **Chatbot tier-recommendation config** — edit the sizing formula/thresholds without a code deploy.
- **Node editor** — place/edit/deactivate nodes by type, assign beacon IDs to positioning-critical nodes, manage floor-by-floor maps, track versioning status (Pending/Node Mapping/Nav Testing/Ready/Live).
- **Beacon inventory tracking** — which physical beacon ID maps to which node, fault/replacement history, spare-unit stock (Premium).
- **Add-on & change request approval queue** — review/approve Add-on Beacon Fee requests, Additional Stall Node requests, Structural Change Requests.
- **Maintenance ticket dashboard** — incoming tickets (including manually-flagged low-battery reports), SLA countdown per tier, assign to technician, log resolution.
- **Logistics zone & surcharge management** — configure Zone A/B coverage and amounts.

### Mall Admin platform (client-facing)
- **Dashboard** — daily analytics refresh, history depth per tier (Section 5).
- **Wallet view & top-up** — balance, top-up, transaction history, upcoming payment notices.
- **Tenant node management** — one combined view for fixed stores (instant relabel, no map change on tenant swap) and mobile stalls (add/reassign within the included pool; request additional stall nodes beyond it, triggering the ₱3,500 fee flow; view active vs. deactivated stall nodes).
- **Map Updates request form** — submit routine non-structural edits within the tier's included updates/year.
- **Structural Change Request form** — submit a scoped request for real layout changes, see calculated fee before confirming.
- **Maintenance ticket submission** — report a faulty/dark beacon or manually flag a low battery.
- **Data export** — CSV, on-demand, full history — same for every tier.
- **Admin account management** — add/remove mall-side admin users, up to the tier's limit.
- **Subscription & billing summary** — current tier, renewal date, fees, payment status, invoice history.

---

## Resolved decisions (this revision)

1. **Terminology clarified:** "subscription" refers only to the fixed Annual Subscription Fee (₱60,000/₱150,000/₱350,000). The Onboarding & AR Dev Fee is a separate one-time implementation fee, quoted before signing from self-reported mall size.
2. **Payment schedule:** 50% at signing / 50% at go-live, fixed amounts locked at quote time. Subscription year starts at go-live.
3. **Mapping sequence:** digital mapping happens after signing (software only), physical install happens last. Real-time add-on beacon fees (wallet-deducted before install) cover any gap beyond the included allocation.
4. **Data export:** uniform across all tiers.
5. **Hardware ownership:** NavAR-owned, bundled into the subscription.
6. **Service area:** scoped to Cebu City + rest of Visayas.
7. **Hardware fault fairness:** diagnosis/replacement/recalibration always stays with NavAR; Basic pays cost price for the unit, Standard/Premium included.
8. **Battery handling simplified:** no automated tracking or countdown — mall manually flags low battery from the dashboard. Physical swap stays with mall staff or rides along on an already-scheduled visit, never a dedicated NavAR trip.
9. **Beacon density corrected** to junction/path-density counting, excluding non-positioning node types.
10. **Stalls reframed as included-nodes + pay-per-addon**, not pre-wired slots.
11. **Node-graph locality:** single node edits only affect directly-connected edges — no full "version redo" needed for routine changes.
12. **Change history via audit fields**, not full versioning. Full versioning reserved for real Structural Change Requests.
13. **Enterprise tier removed from capstone scope** — three tiers only (Basic, Standard, Premium). Malls too large for Premium's bracket are a future business consideration, not something the capstone system needs to price or build for.
14. **Analytics simplified to one refresh rate** (daily) across all tiers — only history depth varies. Removes the need to build/defend real-time or hourly dashboard infrastructure.
15. **Platform feature checklist added (Section 11)** for what Super Admin and Mall Admin actually need to build.
16. **Stores and stalls combined into one tenant node pool:** the distinction that matters is fixed vs. mobile, not store vs. stall. One combined included allocation per tier (75/260/650) replaces the previous two separate rows/caps — same underlying beacon math, simpler to present and track.
17. **Removed vague "Same" cells:** identical-across-tiers rows (battery status flagging) pulled out of the table into a standalone statement instead of repeating "Same" or duplicate text three times.
18. **Maintenance scheduling clarified as reactive, not calendar-automated:** no fixed every-2/3-months visit cycle. A technician only comes out when a ticket is filed (fault report or manually-flagged low battery) — tier only affects how fast NavAR responds after that, not how often it shows up unprompted.

## Still worth checking before your defense

- The ₱5,000 Zone B surcharge is a placeholder — sanity-check it against actual transport cost to a realistic pilot mall (Iloilo, Bacolod) within the Visayas-only scope.
- Confirm with your panel/adviser whether a capstone business plan is expected to name an actual first pilot mall — if so, check the GFA/floor numbers in Section 7 against that mall's real specs.
- **Decide the per-beacon onboarding rate.** At ₱900/beacon, onboarding fees are ₱187,500 / ₱594,600 / ₱1,585,000. At ₱500/beacon, they'd be ₱117,500 / ₱357,000 / ₱925,000. Check actual bulk beacon cost (likely under ₱500 landed) plus labor time, then pick a rate.
- The ₱3,500 Additional Stall Node Fee is a working estimate — sanity-check against actual technician time once the per-beacon rate above is settled.
- How many stall nodes go unused vs. reused over a year is unknown — 15/60/150 is a reasonable starting guess, revisit once you have real turnover data.
- Section 11's feature lists are functional requirements, not final UI — worth a pass with whoever's building the frontend to confirm nothing's missing or redundant with what's already built.
