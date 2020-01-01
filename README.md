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

Mainnet upgrades the existing `reya-omnibus:1.0.166` to `1.1.0`; Cronos upgrades
its existing `1.0.148` to `1.1.0`. Devnet stays on its existing native deployment
and advances `reya-devnet-omnibus:1.1.9` to `1.1.10`. All three use shared native
router pins and market configuration. Token, receipt, custody and proxy identities
are preserved. The mainnet/Cronos migration leaves PassivePerp paused.

The ordinary environment commands run native execution and retain required
receipt/collateral coverage. Cronos uses disposable pusher addresses only in its
test recipe; production addresses remain explicit GCP provisioning placeholders.

`yarn reya_network:perpob:test` additionally checks migration preservation at
mainnet block `240431867`, after the published receipt batch. Its terminal variant,
`yarn reya_network:perpob:terminal:test`, synthetically closes the 44 noncohort
markets with OI and locks all 70 markets outside ETH/BTC/SOL/XRP/HYPE.
These historical rehearsals record `release_acceptance=false`.

`yarn test:perpob-static` runs graph, runner, evidence and disposable-chain helper
regressions. After `yarn build`, run
`node packages/tests/scripts/verify-perpob-artifacts.mjs` for published package/CID,
Cannon tuple and compiled interface checks. See the [review guide](docs/pr542-merge-readiness.md) for scope, coverage and gates,
and the [funding evidence](docs/pr542-legacy-funding-gap.md) for the transfer and
bootstrap reconciliation. Earlier reports are [archived](docs/archive/pr542/README.md).
