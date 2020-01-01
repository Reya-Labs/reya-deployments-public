# Working with Cannon

Field notes for this repo. Every entry below cost real debugging time at least
once — most of them present as something other than what they are.

## Current mainnet candidate (8 October 2026)

BNB/DOGE/AAVE relaunch configuration builds **1.1.9** from the executed and published
**1.1.8** artifact, CID `QmQrd6rifyY4Un9bJV666otxW2giUCAPbqMCeoKgxje4Jo`.
Expect six protocol calls: three market configurations followed by three clears of
the historical `marketEnabled.denyAll` flags. Existing `allowAll`, allowlists, risk
assignments and ADL trackers are preserved. Replace the unexecuted nonce-519 proposal;
the changed payload needs new signatures. API/UI activation remains separate.
Mainnet and devnet share the agreed order grids and caps for these three markets; devnet executed and published those changes in 1.1.12 with its rSelini update. See [scope and acceptance](docs/releases/crypto-preopen-bnb-doge-aave.md).
The versioned release notes below describe historical rehearsals, not the current
baseline. Reconcile any intervening publication before proposing this candidate.

## The one thing to internalise

**Cannon SKIPS a failing step and still exits 0.** One failed step cascades
into every step that `depends` on it, and the build reports success. So:

- A green build is not evidence of a complete deployment. Grep the log for
  `Skipping [` — a healthy build has **zero**.
- Fork tests are the real gate. They read live chain state, so a silently
  skipped config step shows up as a failed assertion rather than as nothing.
- `packages/tests/scripts/cannon-retry.sh` wraps the devnet suite and retries
  on any skip. It is deliberately **not** applied to the mainnet/cronos
  suites — see "Partial builds are normal on mainnet/cronos" below.

## Two cannon versions, and why devnet behaves differently

`@usecannon/cli-devnet` is **not a fork**. It is an npm alias in the root
`package.json`:

```json
"@usecannon/cli":        "2.23.0",
"@usecannon/cli-devnet": "npm:@usecannon/cli@2.26.0",
```

Both are upstream `@usecannon/cli`; the repo simply installs two versions
side by side. The name makes it look like a Reya variant, which has cost
debugging time more than once — including a whole evening chasing a
"cli-devnet bug" that is really an upstream 2.23 → 2.26 change.

|                                         | network / cronos suites   | devnet suite                                                      |
| --------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| binary                                  | `@usecannon/cli` (2.23.0) | `@usecannon/cli-devnet` (2.26.0)                                  |
| rebuilding an already-published version | allowed                   | **refused** unless the package is in the machine's LOCAL registry |

**Why the split exists is not recorded.** #470 (13 May 2026) switched the
devnet script from a globally-installed `cannon` to the pinned 2.26 binary,
alongside unrelated WS-executor work; nothing in the PR explains the version
choice, and no devnet toml appears to need a 2.26-only feature. Most likely
it was simply "latest at the time" while pinning away from a global install.

### The consequence you will actually hit

2.26 added this to `build.js`:

```js
const localPackageUrl = await localOnlyResolver.getUrl(fullPackageRef, chainId);
if (!localPackageUrl.url) {
  // local cache miss only
  if (isPackageAlreadyPublished.url) {
    throw new Error('The package ${fullPackageRef} is already published ...');
  }
}
```

(The `${fullPackageRef}` is an upstream bug — single-quoted, so the error
prints the literal template rather than the package name.)

Because it fires only on a **local cache miss**, it never triggers on a
developer machine that just built the package, and always triggers on a cold
CI runner. That is why the devnet CI step can fail while the same command
passes locally.

For an already-published candidate, prime its exact version in the local
registry to satisfy this guard. For a new release, keep the candidate version
separate from the published upgrade baseline. The market/collateral mirror
was deployed as **1.1.2** on 8 September 2026. Its historical complete deploy CID was
**`QmWfs3ZzcSLwZC9beksXB5ktvkrd6icSQAjkdaw9gVr7rj`**.

The latest completed devnet release is **1.1.12**, executed and published on
8 October 2026 from completed 1.1.11, CID **`QmRkHcMTqvkLRJ4hwHJtX4QitvaxbgaknNxE567ik3r9kT`**.
Four owner calls aligned BNB/DOGE/AAVE order grids and caps with the mainnet candidate
and repointed devnet Core pool 1's rSelini oracle to its own sUSDe/USDC node with a
1,000,000 cap. The passive pool held zero rSelini. Receipt verification and full
readback preserved all other market configuration, access flags and historical ADL
state, plus 41 imported addresses and 105 creation/initialization records. The shared
rSelini token and Cronos Core were not changed. See the
[release record](docs/releases/crypto-preopen-bnb-doge-aave.md#devnet-execution-and-publication-8-october-2026).
An unchanged 1.1.12 rehearsal must resolve this completed artifact and make zero
protocol calls. Bump the candidate before another devnet change.

The previous devnet release **1.1.11**, executed on 29 September and published on
30 September 2026 (#554), registered markets 76-87, raised CP1 maxMarkets to 87,
and carried the six then-pending shared configuration calls (163 owner calls).
Its baseline CID `QmRp6me5FXySZEkoG9byPTS72athSH1YE3BKn1GAwjZvUr` remains historical;
do not use it to replay the now-completed 1.1.12 calls.

The previous devnet release **1.1.10** was executed and published on
23 September 2026 (#547). Core 1.1.5 adds owner/collateral withdrawal locks;
PassivePerp 1.1.4 starts a fresh referral V3 epoch. Core and PassivePerp upgraded
at blocks 64400559 and 64400562 respectively, and account NFT transfers remain
closed (`allowAll=false`, `denyAll=true`). Referral writers were drained, source
and projection rows archived/reset atomically, then the V3 consumer activated
from block 64400562. The live referral canary set, survived consumer restart,
cleared at sequence 2 and agreed with the DB/API. The withdrawal canary verified
locked sUSDe rejection, unaffected rUSD withdrawal, unlock recovery and complete
collateral/lock cleanup. Signed fee-fill behavior was verified on a fork; a live
matching-engine fill was not part of this release canary.

The previous devnet release **1.1.9** was executed and published on
19 September 2026 from deployment commit `733977d` (#534): the maker receipts
rKeyrock and rFlow, live on Cronos since `reya-omnibus:1.0.148@main` and pinned
by address, admitted to devnet's CP1 (caps 500,000 / 2,000,000 receipts, priced by
devnet's shared sUSDe/USDC node), the CP1 collateral limit raised to 15, the
auto-exchange and passive-pool rebalance allowlists extended, and the rFlow/rUSD
and rKeyrock/rUSD spot markets registered as ids 13 and 14 (thirteen transactions,
no router change, no token creation). 1.1.8 (19 September, #541) added the
Arbitrum Sepolia Socket connectors and static withdraw fees for USDC and wETH on
Periphery, re-emitted the Ethereum Sepolia fees as `FeeUpdatedV2`, and enabled
the passive pool fee share on PassivePerp via the fee model V3
`setGlobalFeeParameters`. 1.1.7 (17 September, #540) granted the dedicated devnet
tier-updater signers `configureFees`; 1.1.6 (16 September, #537) brought the
audit-fixed routers Core 1.1.4 / passive-perp 1.1.3 / orders-gateway 1.1.4; 1.1.5
upgraded Orders Gateway for resting SL/TP maker fills; the auto-exchange signer
isolation from 1.1.4 and Core/spot 1.1.3 remain unchanged. The market/collateral
mirror first shipped in 1.1.2; the paragraph above is its historical origin, not
the current upgrade baseline.

A baseline is Cannon's record of operations already executed on this chain.
CI and the devnet test/simulation scripts restore **`reya-devnet-omnibus:1.1.12@main`**,
complete deploy CID **`QmRkHcMTqvkLRJ4hwHJtX4QitvaxbgaknNxE567ik3r9kT`**.
Both the version and `latest` registry tags were verified on Optimism after
publication. Publishing does not update explicit version pins in these scripts.
(#537 flipped only the package scripts and left the CI prime ref and this
paragraph at 1.1.5; #540, #541, #534 and #554 realigned all four in their completed-record commits.)
The Cronos job now primes `reya-omnibus:1.0.148@main` the same way: that candidate
is executed and published, so a cold runner would otherwise hit the guard above.

Keep the CI prime ref/CID and test/simulation scripts aligned after each
completed, verified publication. Retain that completed baseline while preparing
a new candidate, and bump the candidate version before another release. An
unchanged 1.1.12 rehearsal from its completed record must make zero protocol
calls with zero skipped operations. Do not replay earlier market registration
or transfer accounts as part of a signer change; create a fresh account.

```bash
REF=reya-devnet-omnibus:1.1.12@main
URL=$(cannon inspect "$REF" --chain-id 89346162 \
      | grep -oE "ipfs://Qm[A-Za-z0-9]+" | head -1)
cannon fetch "$URL" "$REF" --chain-id 89346162
```

`fetch` reads **`CANNON_PUBLISH_IPFS_URL`** for its download loader — not
`CANNON_IPFS_URL`, not `CANNON_WRITE_IPFS_URL`. Unset, it falls back to the
decommissioned region-derived repo hosts and dies with an SSL `EPROTO`
handshake error, exactly like `publish`.

Converging the two versions is tracked in PRO-994; until then, remember that
any cannon behaviour that differs between devnet and the other environments is
a version difference, not an environment one.

## Package resolution

### Registry packages live on TWO chains

Cannon reads package hashes from an on-chain registry deployed at the same
address on both Ethereum and Optimism. Reya's packages are **split across
both**: older proxies resolved from Ethereum, newer routers and the omnibus
baselines from Optimism. Any build needs **both** reachable.

Consequence: pinning a single registry via `CANNON_REGISTRY_*` env vars
**breaks resolution** for whatever lives on the other chain. Those env vars
configure exactly one registry. Use a settings file instead (below).

### Registry lookups get rate-limited

Cannon's default registry config uses globally-shared Infura/Alchemy keys.
On shared IPs (CI runners especially, sometimes home connections) they return
429s, which surface as:

```
Error: deployment not found: <pkg>:<ver>@<preset>. please make sure it exists
       for preset <preset> and network 13370
```

That message reads like "the package was never published". Usually it means
"the registry lookup was throttled". Verify with a direct read before
concluding a package is missing:

```bash
cast call 0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba \
  "getPackageUrl(bytes32,bytes32,bytes32)(string)" \
  $(cast --format-bytes32-string "reya-core") \
  $(cast --format-bytes32-string "1.1.2") \
  $(cast --format-bytes32-string "13370-router") \
  --rpc-url <an-ethereum-rpc>
```

Empty string = genuinely unpublished **on that chain**. Check the other one
before declaring it missing.

### Fix: a settings file with both registries

`~/.local/share/cannon/settings.json` (CI writes the same file):

```json
{
  "ipfsUrl": "https+ipfs://repo.usecannon.com",
  "registries": [
    {
      "name": "OP Mainnet",
      "chainId": 10,
      "rpcUrl": ["<your-optimism-endpoint>", "https://optimism-rpc.publicnode.com"],
      "address": "0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba"
    },
    {
      "name": "Ethereum Mainnet",
      "chainId": 1,
      "rpcUrl": ["<your-ethereum-endpoint>", "https://ethereum-rpc.publicnode.com"],
      "address": "0x8E5C7EFC9636A6A0408A46BB7F617094B81e5dba"
    }
  ]
}
```

Public endpoints alone are **not** enough on CI runners — they rate-limit
shared egress IPs too. CI uses a keyed endpoint first, public as fallback.

### The local cache hides all of this

`~/.local/share/cannon` answers lookups that would otherwise fail. A build
that works on a machine which previously built the packages can fail
everywhere else. When a build works only for you, suspect the cache: test
with a throwaway `CANNON_DIRECTORY` holding just the settings file.

### Clone-source pinning

A registry ref is **not** immutable in practice. A package can be rebuilt on a
newer cannon toolchain and republished under the same `name:version@preset`,
and the registry will then hand out bytes that are not what you deployed from.
For 12 of devnet's 17 clone sources that already happened.

This is not cosmetic, because **cannon clones proxies via arachnid CREATE2**:
the address is a pure function of `(deployer, salt, initcode)`, and the
initcode comes from the cloned package's artifacts. Different artifact bytes,
different proxy address. For `reya-exchange-passive-pool:1.0.0@proxy`:

| artifact                               | PassivePool proxy    |
| -------------------------------------- | -------------------- |
| what devnet was deployed from (2.23.0) | `0x9fDba948…abA2` ✅ |
| what the registry now serves (2.12.4)  | `0xE93414D5…8652` ❌ |

So devnet reproduced on exactly one machine — the one whose local cache still
held the originals — and the devnet fork suite could not pass anywhere else.
The fix is a lockfile plus a prime step, because **cannon consults the local
registry before the on-chain ones**:

```bash
yarn reya_devnet:prime    # before reya_devnet:test / reya_devnet:simulate
```

- Pins: `packages/tomls/src/omnibus/reya_devnet.lock.json`, keyed by package
  ref. Each entry pins **two** CIDs: the `deploy` blob and the `misc` (artifact)
  blob it points at. Both matter — the clone step reads `deployInfo.miscUrl`
  unconditionally for contract bytecode.
- **Prime clone sources at chain id `13370`, not `89346162`.** Cannon resolves
  `clone.source` at `CANNON_CHAIN_ID` regardless of the target chain
  (`steps/clone.js`, `config.chainId ?? CANNON_CHAIN_ID`). Priming at the devnet
  chain id writes tags no clone step reads, the build falls through to the
  registry, and you get the wrong addresses with no error. Note this differs
  from the omnibus prime step, which correctly uses `89346162` — the omnibus
  really is an 89346162 deployment.
- Verify a pin without a chain, an RPC key, or a build:
  `node packages/tomls/scripts/verify-clone-source-pins.js` recomputes the
  PassivePool CREATE2 address from the pinned bytes.

When bumping a `*Package` ref in `reya_devnet.toml`, update the lockfile in the
same commit — the prime script hard-fails on a pin the omnibus no longer clones.

Mainnet also primes `reya_network.lock.json` alongside `perpob.lock.json`. Its
rUSD and ExchangePass router CIDs match the published 1.1.2 baseline. Copying a
developer's entire `tags` directory into a mainnet rehearsal can override these
with different same-version sources when the build uses `--registry-priority
local`. An HTTP 500 for such a CID is not proof that the deployed artifact is
lost: compare the local mapping, target baseline import and remote registry
first. Use a new `CANNON_DIRECTORY` containing only settings, then run the
environment's prime steps. Keep the old cache as evidence.

## IPFS

### Read URL

Cannon's default read endpoint is chosen by **timezone** and resolves to
regional subdomains (`https+ipfs://<region>.repo.usecannon.com`) which have
been decommissioned (NXDOMAIN). Always set:

```
CANNON_IPFS_URL=https+ipfs://repo.usecannon.com
```

Without it, `--upgrade-from` cannot download the baseline and every step
fails at "Checking for existing package".

### Write URL is a _separate_ setting

`publish` uploads through `CANNON_PUBLISH_IPFS_URL`, which falls back to the
same dead regional hosts. Symptom is an SSL handshake failure, not a 404:

```
Error: Failed to upload to IPFS. ... ssl3_read_bytes:ssl/tls alert handshake failure
```

Set **both** when publishing:

```
CANNON_IPFS_URL=https+ipfs://repo.usecannon.com
CANNON_PUBLISH_IPFS_URL=https+ipfs://repo.usecannon.com
```

Fetch flakes are common enough to matter (`Skipping [clone.*]`). Raise
`CANNON_IPFS_RETRIES` / `CANNON_IPFS_TIMEOUT`, and note that on retry cannon
resumes from cached state — it often re-reports only the downstream
`Skipping [invoke.*]` cascade without re-attempting the clone, so a retry
predicate matching only `clone.` will happily accept a broken build.

## Publishing

```bash
CANNON_IPFS_URL=https+ipfs://repo.usecannon.com \
CANNON_PUBLISH_IPFS_URL=https+ipfs://repo.usecannon.com \
cannon publish <pkg>:<ver>@<preset> --chain-id <id> --skip-confirm \
  --exclude-cloned --private-key <key>
```

- **`--exclude-cloned` is usually required.** By default publish also pushes
  cloned sub-packages; if any of those is already registered by another
  owner, the whole registry transaction reverts.
- **`--registry-*` flags crash `publish`** (`Cannot read properties of
undefined (reading 'chainId')`) — it hard-requires the default two-registry
  shape. Configure registries in the settings file instead.
- CLI 2.26 still prompts for the registry even with `--skip-confirm`; that
  flag skips the later publication confirmation. Select Optimism for this
  devnet omnibus. Non-interactive automation must explicitly select the
  registry, simulate the exact publication call and verify its receipt.
- If receipt lookup fails after submission, query the original hash and both
  version/latest registry entries before retrying. An HTTP error is not proof
  that publication failed; never blindly submit the publication again.
- Registry `publishFee`/`registerFee` are currently zero; cost is chain gas.
- Publishing a package for one `chain-id` variant does **not** publish the
  others. `1.1.2@router` on chain 89346162 and the same package for chain
  13370 are separate registry entries — and `clone` steps in the tomls
  reference the **13370** (portable) variant.

## CREATE2 collisions between sibling clones

Several cloned packages contain an identical `deploy.OwnerUpgradeModule`
sub-step, which resolves to the same CREATE2 address for all of them.
Whichever clone runs first deploys it; the others fail with:

```
The contract at the create2 destination 0x... is already deployed, but the
Cannon state does not recognize that this contract has already been deployed.
```

This is **scheduling-dependent** — dry runs and real runs can pick different
winners, so a clean dry run does not guarantee a clean deployment.

The sanctioned fix is `ifExists = "continue"` on the deploy step, which we
cannot add from here because the step lives inside published source packages.
It is safe to treat as `continue`: a CREATE2 address is a function of the
initcode hash, so code already at the destination is bit-identical to what
the step would deploy. Until the upstream packages carry `ifExists`, recovery
is: patch the guard locally in `@usecannon/builder/dist/src/steps/deploy.js`
(**both** the top-level copy and the one nested under `@usecannon/cli-devnet`),
then resume.

### Perp OB upgrades over existing deployment history

Mainnet's `reya-omnibus:1.0.166@main` to `1.1.0` upgrade executed on 28 Sep 2026 (Safe nonce 507,
block 244533378), and `1.1.1` (the WETH/WBTC withdrawal limits) executed on 29 Sep 2026 (Safe nonce 508)
and was published on 30 Sep 2026. The historical RWA batch-one registration rehearsal
used published `1.1.2` (`QmVm96m6QhM8Q5y3J88fvrV4yKXD7LZmwQZtqgt4jFbHCS`)
to build `1.1.4` (markets 76-81 only). For the current standard fork suite's baseline
and candidate, see [Mainnet RWA launch-risk candidate](#mainnet-rwa-launch-risk-candidate-6-october-2026).
The unexecuted twelve-market `1.1.3` preview is superseded because Cannon staging
rejects its >100 KB signing request. See `docs/releases/rwa-mainnet-staging.md`
for the second-batch restoration and completed-baseline requirements.
The migration tests still read historical legacy state at the pinned pre-upgrade block in
`src/fixtures/MainnetPerpOBUpgrade.sol`. Mainnet `1.1.2` moves rSelini to the 1:1 sUSDe receipt model;
devnet `1.1.12` mirrors only the Core oracle and cap. See `packages/tomls/src/share_token/README.md`.
Cronos upgrades `reya-omnibus:1.0.148@main` to `1.1.0`. Devnet reuses completed `1.1.12` with no pending protocol calls.
The source artifacts are pinned in `packages/tests/scripts/omnibus-baselines.mjs`.
The former `reya_network_perpob.toml` entrypoint includes the production recipe.
It does not create a separate package or replacement tokens.

All environments share native router pins, market configuration, fee configuration
and liquidation configuration. Mainnet and Cronos pause PassivePerp before upgrading
its existing proxies and retire AMM spread/depth/log-F/volatility permissions.
The migration leaves trading paused. Reopening occurs only in the disposable test
fixture, or later through the separately reviewed cutover procedure.

Cronos oracle-pusher settings are intentionally empty until GCP provisioning is
complete. Only `test/reya_cronos.toml` supplies disposable addresses. The production
recipe fails if those required signers are still missing.

The receipt predeployment exception is retired: published mainnet `1.0.166` contains
the completed rFlow/rKeyrock deployment state. Tests use ordinary Cannon collision
checks. `verify-omnibus-preservation.mjs` rejects changed token/proxy identities,
replayed account/market/pool creations, missing history, or a separate package name.
Zero-price readbacks also require existing collateral parameters and balances to
remain unchanged, apart from the two intended parent oracle pointers.

## Resuming a partial deployment

When a build ends "not fully completed", cannon stores a partial package and
prints its IPFS hash. To continue:

```bash
# NOTE: no --upgrade-from — that restarts from the published baseline
cannon build <omnibus.toml> --rpc-url <rpc> --private-key <key>
```

Executed steps are not re-run; only skipped ones are attempted. Use `--wipe`
only when you intend to redo everything.

## Dependency inference

Cannon computes step dependencies from template access. When it cannot
evaluate a template (advanced expressions) **and** the step declares
`depends`, it silently falls back to the explicit list. A wrong or
incomplete `depends` then produces a step that runs too early and fails on
missing state — visible only as a skip. Prefer keeping template expressions
simple enough to be inferable.

## Partial builds are normal on mainnet/cronos

Local dry runs of `reya_network.toml` / `reya_cronos.toml` end partial by
design: some source packages have never been published (their pins are gone),
so ~24 root failures cascade into ~1800 skips. This is identical on `main`
and on any branch, so a **differential** is still meaningful — compare the
executed-step sets between branches rather than expecting zero skips.

## Verifying a deployment changes nothing elsewhere

To prove a change cannot affect mainnet/cronos, dry-run **both** environments
from **both** `main` and the branch, and diff the step sets:

```bash
cannon build ../tomls/src/omnibus/reya_network.toml --dry-run --impersonate-all \
  --upgrade-from reya-omnibus:latest@main --rpc-url <rpc>
```

Identical executed-step sets is a much stronger claim than "the files look
unrelated". Run the four builds **sequentially** — parallel builds rate-limit
the registry.

## Environment variables, collected

| Variable                                     | Why                                                     |
| -------------------------------------------- | ------------------------------------------------------- |
| `CANNON_IPFS_URL`                            | read endpoint; default regional hosts are dead          |
| `CANNON_PUBLISH_IPFS_URL`                    | **separate** write endpoint for `publish`               |
| `CANNON_IPFS_RETRIES`, `CANNON_IPFS_TIMEOUT` | fetch flakes on slow networks                           |
| `CANNON_DIRECTORY`                           | point at a throwaway dir to test cold-cache resolution  |
| `RPC_KEY`                                    | chain RPC key; one key works for both branded endpoints |

Registry endpoints belong in the settings file, not env vars — the env vars
can only express one registry.

## Mainnet RWA launch-risk candidate (6 October 2026)

`reya-omnibus:1.1.6@main` builds from completed `1.1.5`, CID
`QmPLRiSdy4SNCozDVWmuoduUQWpZRY34H5oe3VrDyFnj8N`. This preserves #560's
withdrawal limits and changes only risk for markets 76-81 plus gold's OI cap.
See [the exact launch batch](docs/releases/rwa-batch-one-launch-risk.md).
Do not combine this with the separate 82-87 registration candidate (#561).
That draft must consume the completed launch-risk record and receive its own
unused version after this batch is executed and published.


## Historical mainnet RWA cap candidate (7 October 2026)

Safe 516 executed and `reya-omnibus:1.1.6@main` was published on 6 October,
CID `QmYiRMcmBvEgtetzc7rbLVCPieCt6DmsyidNtJicrpQBfb`. The cap-only candidate
is `1.1.7`, building from that completed record. It updates existing markets
77–81 to their agreed base-unit launch caps; gold stays at 120 XAU. See
[scope and rollout gates](docs/releases/rwa-batch-one-oi-caps.md).
Both the mainnet baseline primer and environment test runner advance together.
The separate deferred-registration draft #561 must preserve these changes and
choose a fresh version/confirmed completed baseline before its own execution.

## Historical 7 October batch-two draft follow-up

The batch-two branch retains first-batch target caps and registers 82–87 at the
hybrid (5 min) tiers and their target caps, candidate 1.1.8. Its baseline is the
executed and published 1.1.7 artifact, CID
`QmS9FiTQfWp1zzmTDq2c7PGuDbqXoRkqpGmTXYjJWrmwK1`.
Both baseline consumers and their regression assertion advance together.
Rehearse only the 79 registration/CP1 calls; the five first-batch cap writes must
not replay. No automatic ME restart. See docs/releases/rwa-mainnet-staging.md.
