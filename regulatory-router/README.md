# Regulatory Pathway Router

Given a drug and a set of target markets, compute the filing sequence that covers them —
exploiting reliance pathways, where approval by one regulator unlocks a faster, cheaper
route in another.

38 markets, 125 routes, 9 multilateral programmes. Every route carries a confidence level
and a link to its regulator source.

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # solver correctness + knowledge-base validation
```

## Why this is not a lookup table

Two networks tie the markets together and pull in opposite directions.

**Approval unlocks approval.** Project Orbis, the Access Consortium, EU-M4all, WHO
Prequalification and its Collaborative Registration Procedure, Swissmedic MAGHP,
ZaZiBoNa, plus national abridged and verification routes that shortcut review once the
FDA or EMA has said yes. This rewards filing early and widely.

**Price references price.** Most countries cap a new drug's price against a basket of
other countries. Add Most Favoured Nation policy, which pegs the US price to the lowest
price among comparable nations, and an early launch in a cheap market drags down revenue
in the largest one. This punishes launching early and widely.

### The asset reshapes the graph

There is no single optimal route. Eligibility gates change which anchors even exist:

| Gate | Consequence |
|---|---|
| Project Orbis is oncology-only | A cardiovascular asset loses the anchor and its seven partner markets |
| EU centralised procedure is mandatory for biologics, ATMPs, oncology, orphan | A biologic cannot use DCP/MRP at all |
| WHO PQ needs an active Expression of Interest | A commercial oncology drug cannot enter the PQ → CRP chain |
| Saudi SFDA fast routes exclude generics, ATMPs, blood products | Those modalities lose the 30/60-working-day routes |
| WLA listings are modular by product category | The same `wla` reference predicate resolves differently per asset |

### Constraint types beyond precedence

A plain DAG gets the answer wrong. The model encodes:

- **k-of-N thresholds** — Singapore verification needs 2 reference agencies; Saudi
  verification needs *both* FDA and EMA
- **Recency windows** — MHRA Recognition A needs an approval ≤2 years old, TGA COR-A ≤1
  year. Delay past the window and the cheap route disappears
- **Submission vs approval events** — Orbis Type A files within a month of the FDA
  *submission* and reviews concurrently; treating it as "wait for FDA approval" overstates
  the timeline by about a year
- **Approval provenance** — Mexico accepts only ordinary approvals, so reliance generally
  cannot chain
- **Component granularity** — reliance applies to a dossier assessment or a GMP audit
  separately. In Türkiye, Nigeria and Russia the site inspection, not the review, is the
  binding constraint
- **Lead times and cadence** — Access Consortium wants an expression of interest 3–6
  months ahead; ZaZiBoNa assesses in quarterly sessions

## Algorithm

Minimising **time** is polynomial: earliest approval is a shortest path on an AND/OR
hypergraph — min over a market's routes of the max over that route's prerequisites. Both
operators are monotone, so a label-correcting fixpoint converges even though mutual
recognition puts real cycles in the graph.

Minimising **cost** is NP-hard: anchors are shared enablers, so choosing the cheapest set
covering the targets is node-weighted Steiner / set cover.

It is solved exactly anyway, because the hardness concentrates in ~12 anchor regulators.
Enumerate anchor subsets, run the polynomial solve inside each, sweep a deadline over
per-market cost/time staircases, then take the Pareto envelope. Milliseconds, no solver
dependency. With a capacity limit the uncapacitated result becomes an admissible lower
bound, so any gap is reportable rather than hidden.

## API

Base: `/api`. All endpoints CORS-open and JSON.

| Endpoint | Purpose |
|---|---|
| `GET`/`POST` `/api/solve` | **Main endpoint.** Time/cost Pareto frontier with fully scheduled plans |
| `GET`/`POST` `/api/pricing` | ERP propagation, MFN cliff, NPV and access curves |
| `GET /api/markets` | Markets with price index, MFN basket membership, route counts |
| `GET /api/routes` | Every route with its prerequisite in plain language |
| `GET /api/programs` | The multilateral schemes |
| `GET /api/authorities` | Reference authorities, ICH membership, WLA scopes |
| `GET /api/assets` | Archetypes with the routes and programmes each can reach |
| `GET /api/health` | Counts and seed-time validation |

```bash
# fastest and cheapest sequences for an oncology biologic
curl "localhost:3000/api/solve?assetId=onc-biologic&targets=US,EU,JP,UK,CA,AU,SG,BR,SA"

# the global-health chain, under a budget
curl "localhost:3000/api/solve?assetId=hiv-small-molecule&targets=KE,UG,TZ,RW,ZA,NG,PH&budget=400000"

# an inline asset
curl "localhost:3000/api/solve?indication=oncology&kind=biologic&priorityReviewGrade=true&targets=US,EU,AU"

# what MFN does to launch breadth
curl "localhost:3000/api/pricing?assetId=onc-biologic&targets=US,EU,JP,UK,CA,AU&mfnExposure=0.25"
```

`POST /api/solve` body:

```json
{
  "assetId": "onc-biologic",
  "targets": ["US", "EU", "JP"],
  "capacity": 3,
  "budgetUsd": 5000000,
  "horizonDays": 4000
}
```

## Reading the numbers honestly

- Durations are **agency clocks in calendar days**. Real elapsed time runs 1.5–3× longer.
- These are **times to approval, not to patient**. Reimbursement is a separate clock,
  modelled as `htaLagDays`. The EFPIA W.A.I.T. index puts EU average availability at 597
  days, and NICE delays for Orbis drugs *rose* from 137 to 302 days as approvals sped up.
- **MFN is proposed policy, not settled law.** GLOBE and GUARD were still at proposed-rule
  stage. Every pricing parameter is an input you can move, not a fact.
- Reference pricing propagates on **list** prices while revenue accrues on **net** prices.
  Confidential rebates keep the two apart; Belgium, Italy and Poland request net prices and
  are the leak points.
- Route costs are **total sponsor cost**, not agency fees — that difference is most of why
  reliance pays.
- `confidence: low` rows are estimates. The UI marks them and links the source.

## Prior art

Sequence optimisation exists commercially — Inpharmation and Simon-Kucher both sell launch
sequence tools — but they optimise against *pricing* networks. RIM systems (Veeva,
Cortellis) store reliance rules without optimising over them. What is missing, and what
this does, is treating regulatory eligibility as a precedence structure and solving both
networks together.
