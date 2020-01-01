# reya-deployments
- variables follow camel case
- invoke commands follow snake case


```
yarn
RPC_KEY=... yarn reya_network:test
RPC_KEY=... yarn reya_cronos:test
RPC_KEY=... yarn reya_devnet:test
```

Cannon needs `CANNON_IPFS_URL=https+ipfs://repo.usecannon.com` and a
registry settings file — see [CANNON.md](CANNON.md), which also collects the
recurring failure modes (silent step skips, registry rate limits, CREATE2
collisions between sibling clones, publishing, resuming a partial build).

## Native Perp OB migration

Mainnet executed the upgrade of `reya-omnibus:1.0.166` to `1.1.0` on 28 Sep 2026
(Safe nonce 507, block 244533378) and `1.1.1` on 29 Sep 2026 (Safe nonce 508); its
fork suite now upgrades the published `1.1.1` to the next candidate. Cronos upgrades
its existing `1.0.148` to `1.1.0`. Devnet
stays on its existing native deployment and advances `reya-devnet-omnibus:1.1.9` to
`1.1.10`. All three use shared native router pins and market configuration. Token,
receipt, custody and proxy identities are preserved. The mainnet/Cronos migration
leaves PassivePerp paused.

The ordinary environment commands run native execution and retain required
receipt/collateral coverage. Cronos uses disposable pusher addresses only in its
test recipe; production addresses remain explicit GCP provisioning placeholders.

`yarn reya_network:perpob:test` additionally checks migration preservation at
mainnet block `240431867`, after the published receipt batch. Its terminal variant,
`yarn reya_network:perpob:terminal:test`, synthetically closes the 44 noncohort
markets with OI and locks all 70 markets outside ETH/BTC/SOL/XRP/HYPE.
These historical rehearsals record `release_acceptance=false`.

`yarn test:perpob-static` runs graph, runner, evidence and disposable-chain helper
regressions.

Once a proposal is staged on usecannon.com, `RPC_KEY=... yarn test:payload-rehearsal` executes the
EXACT staged Safe transaction on a disposable mainnet fork with the real owner threshold and checks the
result (readback, negative cases, production-actor flows, carried-holder continuity, delayed resume with
liquidations). See
[docs/payload-rehearsal.md](docs/payload-rehearsal.md). After `yarn build`, run
`node packages/tests/scripts/verify-perpob-artifacts.mjs` for published package/CID,
Cannon tuple and compiled interface checks. See the [review guide](docs/pr542-merge-readiness.md) for scope, coverage and gates,
and the [funding evidence](docs/pr542-legacy-funding-gap.md) for the transfer and
bootstrap reconciliation. Earlier reports are [archived](docs/archive/pr542/README.md).


### Crypto market launches and relaunches

Review minimum order size, base spacing and price ticks against current peer venues
in both base units and USD terms before choosing launch parameters. Distinguish
fixed quantities from minimum-notional rules and fixed ticks from dynamic precision.
Keep the intended devnet/mainnet values aligned and rehearse the same order grids.
See the [sizing review checklist](docs/releases/crypto-preopen-bnb-doge-aave.md#required-review-for-future-crypto-launches-and-relaunches).
