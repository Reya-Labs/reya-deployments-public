# Market-maker receipts (LT-39)

rKeyrock and rFlow use the same ShareTokenRouter as rSelini and rAmber. They are
included in the ordinary omnibus graph: share-token deployment, Core collateral
configuration and passive-pool admission. They deploy no oracle of their own.
There is no separate preparation/activation release. This configuration creates
zero initial supply; it neither issues a loan claim nor transfers loan capital.

## Environment ownership

| Environment | Token contracts                             | Protocol integration                                   |
| ----------- | ------------------------------------------- | ------------------------------------------------------ |
| Mainnet     | Deploy and configure its own rKeyrock/rFlow | Mainnet Core, oracle adapters/manager and passive pool |
| Cronos      | Deploy and configure its own rKeyrock/rFlow | Cronos Core, oracle adapters/manager and passive pool  |
| Devnet      | Reuse verified Cronos token addresses       | Devnet Core, oracle adapters/manager and passive pool  |

Devnet does not change shared-token ownership, permissions, pausers or their
Cronos Core binding. This follows the established rSelini/rAmber boundary;
devnet also has its own sRUSD because that token represents its own pool.

## Parameters and rationale

| Setting                                | New receipts                                                          | Rationale                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Decimals                               | 18                                                                    | Same receipt accounting precision as rSelini/rAmber                                                                       |
| Owner/router/pausers                   | Existing environment configuration                                    | No new authority or implementation                                                                                        |
| Mint, subscribe, redeem                | Environment owner                                                     | Owner operates all five receipts, including rSelini/rAmber/rHedge                                                         |
| Subscription/redemption token          | rUSD and sUSDe                                                        | rUSD as for the legacy receipts; sUSDe lets repaid principal retire receipts 1:1 at the shared node                       |
| Custodian                              | Environment owner                                                     | Subscription proceeds return to the owner                                                                                 |
| Haircut                                | 7.5%                                                                  | Existing production receipt policy; the post-cutover change is separate in PRO-1081                                       |
| Auto-exchange discount / insurance fee | 0.5% / 0.5%                                                           | Existing production receipt defaults                                                                                      |
| Withdrawal window / percentage         | 1 day / 0%                                                            | Existing production receipt policy; Cronos rAmber's permissive testnet value is not a production baseline                 |
| Receipt collateral cap                 | Explicit token quantity, equivalently an sUSDe quantity               | Equal to the agreed allocation at an sUSDe price of 1 rUSD, with headroom above that; distinct from a Core-wide sUSDe cap |
| Oracle                                 | Shared sUSDe/USDC Stork node, the same node the sUSDe collateral uses | One receipt is a claim on one sUSDe, so the sUSDe price is the receipt price; no LM feed of its own                       |
| Reference spot pair                    | Receipt/rUSD, trading disabled                                        | Same reference-data and auto-exchange registration as legacy receipts                                                     |

The debt denomination and the subscription payment token are separate. A receipt
represents a claim on one sUSDe. Its oracle value is therefore the sUSDe price
itself, read from the node the sUSDe collateral already uses; rUSD settlement
permissions do not decide the funding asset. Price appreciation accrues to pool
NAV without minting additional receipts or pool shares. The receipt measures the
claim, not maker trading NAV.

Receipt quantities are configured in `receipt_settings.toml`. Because one receipt
is one sUSDe, a cap is equivalently an sUSDe quantity and issuance is exact: mint
exactly the sUSDe quantity actually funded, no more. There is no initial price to
seed and no valuation bounds to configure; a write-down is an explicit owner
re-point to a receipt-specific LM node (see the impairment runbook below), not a
default in this file. Subscription custody defaults to the owner. The funding
asset and the commercial prerequisites are tracked in LT-39, not in this
configuration. Reconcile the configured defaults with the release packet before
simulation. A build with skipped steps is not a valid release.

## Deployment ordering

Initialization follows the proxy/router deployment. There is no price seeding, no
bounds and no per-receipt node registration. CP1 registration instead depends on
the shared sUSDe node's staleness step
(`oracle_manager_susde_usdc_stork_max_stale_duration`), so that node resolves
before Core starts walking the collateral set. Global collateral configuration
and the normal CP1 limit update precede receipt registration. The sUSDe
settlement-allowlist entry follows the rUSD one, which keeps rUSD first in the
allowlist, and precedes unpause. Token unpause waits for initialization,
permissions, Core binding, collateral registration and pool admission. No custom
limit-setting transaction or extra deploy/activate graph is needed.

`rkeyrockCap` / `rflowCap` default to 500,000 / 2,000,000 receipt tokens, which
are equivalently sUSDe quantities. Mainnet/Cronos additionally default
subscription custody to the owner; devnet requires the verified
`rkeyrockProxyAddress` / `rflowProxyAddress` Cronos outputs; its graph wraps them in
`getAddress`, so an ordinary build or simulation with the empty defaults aborts before
any receipt step runs rather than skipping those steps. The ordinary Cannon
build settings supply these values. Retain the resulting deployment inputs and
reconcile later oracle updates against the outstanding debt ledger.

The new receipts inherit the shared sUSDe node's freshness window, so their
staleness behaviour is whatever that Stork feed's is. An impaired receipt is
re-pointed to an LM node instead, and the LM adapter reports a current timestamp
when read: that on-chain staleness window does not establish the age of the
economic valuation, so source-age and impairment monitoring remain operational
requirements.

## Matching-engine coupling

The matching engine keeps a compiled collateral table per environment
(`crates/matching-engine/src/base/risk_engine/ingestion/collateral_sources.rs`
in reya-chain, one table each for mainnet, cronos and devnet1) and classifies
every Core collateral against it at startup. A graph that admits a new
collateral to Core therefore has an off-chain prerequisite: the matching table
row must be merged and deployed in every environment that runs an engine
before the graph executes. Devnet 1.1.9 (19 September 2026) admitted
rKeyrock/rFlow without that row and the devnet engine aborted on its next
restart; reya-chain #268 added the rows and made an unknown collateral load
with zero margin credit instead of aborting. The receipts are `DisabledZero`
in the engine, the same treatment as rSelini/rAmber/rHedge: they are pool-held
claims valued on-chain by Core, never account margin. For mainnet, the rows
for the expected addresses in the table below must be live before the 1.0.166
proposal executes.

## Verification

Run the ordinary `reya_network:test`, `reya_cronos:test` or `reya_devnet:test`
commands. The fork graphs build the production economics: they are the actual
omnibus with no valuation overlay, so the caps, oracle wiring and settlement
allowlist under test are the ones that will be deployed. Caps are the approved
production quantities of 500,000 / 2,000,000 receipts. Custody and operational
permissions use the environment owner. Other collateral risk defaults and
operator policy are inherited unchanged. The devnet fork graph is the production
devnet omnibus itself: it reads the live Cronos receipt tokens at the addresses
pinned in `reya_devnet.toml`, so no fork-only token fixture is layered on.

The existing LM-token suite exercises subscription, redemption, permissions
and account flows for the new receipts, in rUSD as for the legacy receipts and
additionally in sUSDe, where the shared node makes both directions convert 1:1 and
the suite asserts exactly that. The shared all-collateral suite checks caps. The existing passive-pool
suite exercises partial/full rebalances and authorized minting. All four receipts
are tested against both rUSD and sUSDe in both directions on mainnet and Cronos.
Empty receipt/sUSDe output inventory is provisioned in the fork fixture so successful exchanges are
actually exercised; receipt minting uses the owner; pool rebalancing retains its existing operator. A common helper
checks appreciation and immediate impairment for rSelini and rAmber against their
own LM feeds, with exact NAV changes, unchanged supplies and independent
valuations. NAV coverage for the new receipts instead mocks the shared sUSDe node
and checks that rKeyrock and rFlow move with it, which is the whole content of
the 1:1 claim. A separate impairment rehearsal executes the owner re-point batch
described below and checks NAV drops by exactly the write-down. Devnet tests
protocol integration and valuation; it does not claim ownership of the shared
tokens' lifecycle.

NAV-only fixtures relax the freshness windows of unrelated existing oracle
dependencies and lift collateral caps. They do not mock the legacy receipts' LM
prices or relax those nodes' freshness settings. Mocking the shared sUSDe node is
deliberate for the new receipts, because that node _is_ their price. Receipt
balances for these accounting scenarios are synthetic; actual subscription and
redemption are tested separately on the owning environments. These tests are not
the complete funding/recall rehearsal.

`cannon:check` checks ordinary production/test graphs, critical dependency order
and the devnet token-reuse boundary. Source priming uses the existing shared
helper and the share-token component's exact proxy/router deploy and misc pins.
CI builds each environment once and validates its structured Foundry results;
missing, skipped or failed receipt tests fail that environment's job. The mainnet
and devnet jobs are required status checks on `main`, and their full suites gate
the job; Cronos stays advisory for unrelated failures while its receipt and cap
checks still fail its job. The same gate covers all existing tests named for
rSelini, rAmber, rHedge, rKeyrock or rFlow, plus shared receipt checks. This includes
legacy lifecycle, collateral, valuation, auto-exchange and pool-operation tests.
All collateral-cap tests are also mandatory, regardless of token type.
Devnet requires its complete collateral-mirror integration suite; authorised
shared-token lifecycle coverage belongs to Cronos. No receipt-specific exceptions
are configured. Skipped deployment steps for any of the five receipts also fail the gate.

Live deployment, minting/funding, withdrawal controls, Core-wide sUSDe custody
limits and receipt retirement remain in the LT-39 runbook.
A reverse pool rebalance and a token redemption must not pay the same claim twice.

## Receipt authority consolidation

All five LM receipts (rSelini, rAmber, rHedge, rKeyrock and rFlow) use the
environment owner for mint, subscription, redemption and subscription custody.
Mainnet uses `0x1Fe50318e5E3165742eDC9c4a15d997bDB935Eb9`; Cronos uses
`0xaE173a960084903b1d278Ff9E3A81DeD82275556`. Devnet reuses the Cronos
tokens and inherits their authority changes when the Cronos migration executes.

The legacy token definitions explicitly remove the previous operator and custodian
entries after granting the owner access. This changes future subscription destinations;
it does not move funds already held by previous custodians. Pool rebalancing and
pauser permissions remain separate. Fork tests assert the owner is the sole entry
for all four roles on all five receipts in mainnet and Cronos.

## Receipt caps across environments

Mainnet, Cronos and devnet use the same CP1 caps for existing receipts:

| Receipt | Cap in receipt tokens |
| ------- | --------------------: |
| rSelini |            12,525,209 |
| rAmber  |             2,000,000 |
| rHedge  |               500,000 |

These are token quantities with 18 decimals, not fixed dollar amounts. Cronos
uses finite caps and runs the same cap-exceeded checks as mainnet. Devnet
asserts the caps on its own Core, independently of the shared token contracts.

rKeyrock and rFlow use the same approved quantities across all environments:
500,000 and 2,000,000 receipt tokens respectively. Fork tests inherit these caps;
they do not override them with smaller capacities. These are CP1 admission caps,
not ERC20 mint/supply limits or a Core-wide custody limit. Issue only receipts
corresponding to a funded claim. Yield changes valuation, not the receipt count.

Cronos exception: Cronos CP1 already holds approximately 5.33 million rAmber,
the whole supply, above the common 2 million cap. Lowering the cap does not
unwind that balance, and every positive rAmber delta into CP1 would revert while
the balance exceeds the cap, so the Cronos graph carries a temporary 6 million
rAmber cap instead. Realign it to 2 million once the testnet exposure has been
reduced (PRO-1086).

## Coverage and environment expectations

rSelini, rAmber, rKeyrock and rFlow share configuration, unauthorized-operation,
account-restriction and NAV checks. The existing authorized lifecycle and pool
rebalance helpers run on mainnet and Cronos. All named receipt tests are required
by CI, including devnet's integration suite; older receipts have no exemption.
The separate owner-role assertion covers all five receipts, including rHedge.
Mainnet's duplicate rSelini/sUSDe wrappers have been removed; each maker retains
five distinct sUSDe rebalance cases per lifecycle environment.

Expected values live in each environment's `ReyaForkTest` fixture. Shared checks
have no `devnet` argument. The following differences are intentional test inputs
or existing configuration; this coverage change does not alter deployment policy:

| Property                                  | Mainnet                          | Cronos                           | Devnet                           | Rationale                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------- | -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipt pricing Core                      | Mainnet Core                     | Cronos Core                      | Cronos Core                      | Devnet owns its account Core but reuses Cronos token contracts.                                                                                                                                                                                                                                                     |
| Authorized token lifecycle                | Tested                           | Tested                           | Tested on Cronos                 | Devnet does not apply receipt owner-role migrations to the shared tokens.                                                                                                                                                                                                                                           |
| Legacy receipt oracle window              | 60 seconds                       | Disabled (0)                     | 180 seconds                      | Assert each environment's deployed setting without modifying receipt nodes in setup. Unchanged by this work. The new receipts have no node of their own and inherit the shared sUSDe/USDC node's window, which each fixture asserts at its deployed value (60 s / disabled / 180 s) before relaxing it for the run. |
| rAmber withdrawal allowance               | 0% per day                       | 100% per day                     | 0% per day                       | Preserve the existing Cronos policy; test the corresponding success or exact withdrawal-limit rejection.                                                                                                                                                                                                            |
| Legacy receipt pool rebalance eligibility | Enabled                          | Enabled                          | Disabled                         | Devnet's existing legacy entries are collateral integrations; it has no auto-rebalance operator. New receipts have eligibility prepared, but that alone does not authorize rebalancing.                                                                                                                             |
| Initial supply                            | Only rKeyrock/rFlow must be zero | Only rKeyrock/rFlow must be zero | Only rKeyrock/rFlow must be zero | Existing receipts already have outstanding supply.                                                                                                                                                                                                                                                                  |

All five receipt addresses are explicit expected values in each environment's
`ReyaForkTest`, following the established token-fixture pattern. Devnet uses the
same five Cronos identities. The tests do not read generated deployment JSON or
silently follow a changed deployment address. Missing code at an expected address
fails setup; the required configuration and lifecycle tests verify its integration.
The shared `initializeReceiptOracleNodes()` derives the three legacy receipts'
expected node IDs from the environment adapter and named feed, and expects the
two new receipts to resolve to the shared sUSDe/USDC node, then verifies the
local Core binding.
Expected custodian/subscriber/redeemer addresses are grouped in each environment
fixture for all five receipts; the oracle helper does not assign roles.

The new token addresses were independently calculated from the pinned
`reya-share-tokens:1.0.0@proxy` artifacts in `sources.lock.json`, CREATE2 factory
`0x4e59b44847b379578588920cA78FbF26c0B4956C`, salts `rkeyrock-main` / `rflow-main`
and the environment owner, then verified against fork deployments:

| Receipt  | Mainnet expected address                     | Cronos / devnet expected address             |
| -------- | -------------------------------------------- | -------------------------------------------- |
| rKeyrock | `0x088A85146bc401b44e1604740162421B5ff8e561` | `0xfd105c5d2b1399925E220b5Ad8fEecbf7C0bd43F` |
| rFlow    | `0x4325C20027025aC8E758310dB882F143a27e5Dfc` | `0xd018109EBd2c16B184286a99f3CD62c51ee818B0` |

The Cronos pair is live: `reya-omnibus:1.0.148@main` (executed on 19 September 2026) deployed both tokens at exactly these addresses, and an on-chain readback
of proxy code, owner and the retained Cronos Core binding preceded pinning them
in `reya_devnet.toml`. The mainnet pair remains a verified pre-deployment
expectation until the mainnet proposal executes. Changing the proxy bytecode,
constructor owner or salts requires deliberate recalculation and review of the
expected addresses. Commercial cap/price inputs do not enter the proxy
constructor. Devnet's Solidity expectations remain independent of generated
outputs.

Account tests deposit receipts without mint/subscription authority, transfer
between accounts of the same owner, and verify the configured withdrawal limit.
For locked receipts, the identical withdrawal succeeds after removing only that
limit as a positive control. The shared collateral-cap suite covers every registered
collateral (including rUSD and devnet legacy sRUSD), with independent raw-unit
expectations in each environment fixture. It checks the complete configured set,
finite-cap and zero-cap boundaries, actual deposits under unlimited settings, and
cap enforcement when previously unassigned accounts join CP1. These checks are
mandatory in all environments. The boundary fixture resets only the admitted
balance through Foundry storage discovery, preserving the deployed cap and
enforcement code; historical above-cap balances remain intact in the separate
account-assignment checks. Synthetic capacity checks do not prove safe production
exposure reduction or raw Core-wide custody enforcement. Devnet separately verifies
that retired Cronos sRUSD cannot transfer into devnet Core because it is not an
authorized holder. Only the two synthetic cap scenarios temporarily add devnet
Core to that token holder list, so they also exercise the zero cap behind the
token restriction. This fixture permission change is not a deployment action.

NAV tests retain snapshot prices for unrelated collateral and market dependencies
so they isolate receipt valuation arithmetic. All LM receipt oracle windows are
left as deployed. Configuration checks verify that the legacy receipts' pricing is
initialized and resolves through the expected adapter node, and that each new
receipt's CP1 parent config points at the shared sUSDe node. LM payload timestamps
are generated at read time, so these assertions do not prove the age of the
underlying valuation or the health of external oracle publishers.

## Separate deployed oracle health

CI also runs `test/oracle_health` against an untouched deployed-chain snapshot,
before Cannon. It uses no accounting-fixture changes, mocked prices, timestamp
warps or freshness overrides. This avoids measuring publisher health after time
spent simulating a deployment. It observes currently deployed receipts; the
ordinary Cannon suite verifies the proposed receipt configuration and accounting.

Each environment produces a separate advisory `Oracle Health / network`,
`Oracle Health / cronos` or `Oracle Health / devnet` check and a diagnostic job
summary. A failed, missing, skipped, cancelled or RPC-incomplete run cannot report
healthy. These results do not weaken the mandatory receipt gate or change which
ordinary tests are required.

The four checks cover:

- Supporting collateral prices and their oracle dependencies.
- Prices for markets active in the pool account, with the number checked reported
  explicitly. Zero active markets does not establish market-feed coverage.
- Readable, positive pool NAV and share price under deployed oracle settings.
- Both conversion directions for deployed LM receipts, using each token's stored
  pricing Core. Shared devnet receipt conversions can therefore depend on Cronos.

Raw external publisher timestamps must be nonzero, not in the future and no more
than 180 seconds old at the snapshot. This is a diagnostic observation threshold,
not a change to deployed policy; stricter deployed limits still apply. Calculated
`REYALM#` and `REYAPOOL#` payloads stamp read time, so they are checked for successful
price resolution but their timestamps do not prove economic valuation age. The
check is a point-in-time observation, not continuous publisher monitoring or an
all-market/spot-market health audit (the broader scope remains in PRO-403).

To run locally, set `ORACLE_ENVIRONMENT` to `network`, `cronos` or `devnet`, and
`ORACLE_RPC_URL` to the corresponding RPC URL, then run from the repository root:

```sh
mkdir -p packages/tests/logs
oracle_forge_exit=0
forge test --root packages/tests --fork-url "$ORACLE_RPC_URL" \
  --fork-block-number "$(cast block-number --rpc-url "$ORACLE_RPC_URL")" \
  --match-path "test/oracle_health/reya_${ORACLE_ENVIRONMENT}.fork.t.sol" --json -vv \
  > "packages/tests/logs/${ORACLE_ENVIRONMENT}-oracle-health.log" 2>&1 || oracle_forge_exit=$?
python3 packages/tests/scripts/check-fork-results.py "$ORACLE_ENVIRONMENT" --oracle-health "$oracle_forge_exit"
```

The 15 September 2026 snapshot found approximately 13.5-day-old Cronos inputs
while NAV and receipt conversions remained readable with freshness enforcement
disabled. The concrete publisher investigation is tracked in
PRO-1084. Receipt accounting remains
mandatory while that operational issue is investigated.

## Initial valuation and historical deployment steps

There is no initial price to choose, because a receipt is a claim on one sUSDe:
funding Q sUSDe issues exactly Q receipts, and the receipt price is the sUSDe
price at every later point. Nothing is seeded and no ratio has to be maintained.
Reconcile actual funding, tranche sizing and rounding before issuance. Deployment
alone has zero supply. If the asset switches to USDe, revise the debt ledger and
re-point the valuation source before funding; changing an existing debt's
denomination is not just a frontend symbol change.

### Impairment runbook

Impairment is an owner action against the deployed contracts, deliberately kept
out of the deployment graph. To write a receipt down, the owner executes one
batch:

1. `setLmTokenPriceConfiguration` on OracleAdapters, setting the bounds for a
   receipt-specific `REYALM#` pair.
2. `updateLmTokenPrice` on OracleAdapters at the recoverable value, with zero
   vesting.
3. `registerNode` on OracleManager, node type 4 (Stork offchain lookup),
   encoding the OracleAdapters address and that pair.
4. `setMaxStaleDuration` on OracleManager for the node just registered.
5. `setCollateralConfig` on CP1 for the receipt, with the same base config and
   the parent `oracleNodeId` replaced by the new node.

While impaired the receipt is a fixed rUSD value and no longer tracks sUSDe.
Recovery is step 5 again, re-pointing the parent config back to the shared sUSDe
node. The fork suite rehearses this batch and checks that NAV drops by exactly
the write-down.

The three legacy receipts (rSelini, rAmber, rHedge) stay LM-priced and are not
touched by this change; they remain so until their current claims are retired.
Switching a legacy token to the 1:1 model is only safe at zero supply, because
re-pointing its parent config revalues every outstanding receipt at once.

Historical commits in this repository:

- `eba1ebc` (3 December 2024) added Selini and Amber initial price calls at 1 with
  zero vesting in the shared `init_lm_token_prices.toml`.
- `9a28def` (5 June 2025) added rHedge, its seed at 1 and valuation bounds. It
  commented out the older Selini/Amber seed calls. Reintroducing those calls can
  overwrite an existing claim valuation; the current devnet seed file documents
  why its independent adapters need separate initial values.
- `0882aa9` (21 October 2025) lowered the configured rHedge lower bound from 0.5
  to 0.25. Current live bounds can differ from historical TOML; read them before
  a release.
- The original `1bf5876` Selini definition already made unpause depend only on
  the proxy upgrade. That historical ordering is not a distinct receipt policy
  or proof of complete initialization before activation. New receipt definitions
  encode the full creation order. Do not replay historical initialization or price
  seed steps merely to make an existing-token migration resemble new deployment.

The graph checker applies global collateral/oracle/CP-limit prerequisites to all
five receipts and verifies devnet never changes the shared token contracts. For
the new receipts it additionally asserts that no LM seed, bounds, node or
staleness step exists for them in any graph, that their CP1 parent config
resolves to the same oracle node as the sUSDe collateral's, and that the rUSD
settlement entry precedes the sUSDe one. New creation checks cover full
initialization/activation; on devnet they instead require the live Cronos
addresses to be pinned behind the `getAddress` guard.
Existing-token migration checks require owner grants before previous/historical
authority revocations. Mainnet/Cronos registration now has
explicit global-collateral and oracle dependencies for the three older receipts.

Devnet's production Cannon graph owns its independent Core/oracles/pool and
references Cronos tokens. Its fork starts with all five Cronos receipts already
deployed, the legacy three and the live rKeyrock/rFlow pair from
`reya-omnibus:1.0.148@main`, so the devnet graph carries no token creation at
all: it admits the pinned addresses to CP1, the auto-exchange allowlist, the
pool rebalance allowlist and the spot registry (13 transactions). The pins were
read back on-chain (code, owner, Cronos Core binding) before being committed.

Shared Keyrock/Flow Core and CP1 fragments use explicit environment settings.
Keeping those implementations shared avoids duplicate configuration. Migrating
all older definitions to this form is a broader Cannon migration, involving
historical step identities, seeded valuations and spot registrations; keep it
outside this bounded cap/fixture change until an unchanged-call-plan rehearsal is
available.
