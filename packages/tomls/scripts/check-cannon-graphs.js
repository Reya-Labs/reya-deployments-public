#!/usr/bin/env node
// Check deployment ordering, and the receipt oracle wiring, that final-state Solidity tests cannot
// establish: which step precedes which, that the new receipts carry no price feed of their own, and
// that their CP1 parent config reads the same oracle node as the sUSDe collateral.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const newReceipts = ['rkeyrock', 'rflow'];
const existingReceipts = ['rselini', 'ramber', 'rhedge'];
const allReceipts = [...existingReceipts, ...newReceipts];
// The new receipts (LT-39) are 1:1 claims on sUSDe, so they carry no feed of their own: they are
// priced by the shared sUSDe/USDC Stork node that sUSDe collateral already uses. Impairment is an
// explicit owner re-point to a receipt-specific LM node, never a step in this graph.
const susdeCollateralStep = 'cp_1rusd_set_susde_config';

// The CP1 parent configs reference the node through settings, and the sUSDe collateral does so via
// an extra indirection. Follow `<%= settings.x %>` chains through the graph's var blocks so the two
// templates can be compared without resolving an id that only exists at build time.
const resolveSettingTemplate = (template, settings) => {
  const seen = new Set();
  let current = template;
  while (typeof current === 'string') {
    const match = /^<%=\s*settings\.([A-Za-z0-9_]+)\s*%>$/.exec(current.trim());
    if (!match || seen.has(match[1]) || !(match[1] in settings)) return current;
    seen.add(match[1]);
    current = settings[match[1]];
  }
  return current;
};

async function main() {
  for (const environment of ['network', 'cronos', 'devnet']) {
    const cli = environment === 'devnet' ? '@usecannon/cli-devnet' : '@usecannon/cli';
    const { loadCannonfile } = require(cli);
    const builder = createRequire(require.resolve(cli))('@usecannon/builder');
    for (const location of ['src/omnibus', 'test']) {
      const { def } = await loadCannonfile(path.join(root, location, `reya_${environment}.toml`));
      assert.equal(def.checkAll(), null, `${location}/${environment} graph`);
      const raw = def.toJson();
      const settings = Object.assign({}, ...Object.values(raw.var));
      const context = await builder.createInitialContext(def, {}, 13370, settings);
      const ancestors = (step) => def.getDependencyTree(step)[0];
      if (environment === 'network') {
        assert(
          ancestors('invoke.core_lock_keyrock_susde').includes('invoke.core_deny_account_transfer'),
          'Keyrock withdrawal lock must follow Core upgrade and ownership-transfer denial'
        );
      } else {
        assert(
          !raw.invoke.core_lock_keyrock_susde,
          'Mainnet borrower identity must not leak to testnets'
        );
      }
      // Shared integration and token-reuse rules apply to every receipt.
      for (const receipt of allReceipts) {
        const registration = ancestors(`invoke.cp_1rusd_set_${receipt}_config`);
        const oracle = newReceipts.includes(receipt)
          ? 'invoke.oracle_manager_susde_usdc_stork_max_stale_duration'
          : `invoke.oracle_manager_reya_lm_${receipt.slice(1)}_max_stale_duration`;
        for (const step of [
          `invoke.${receipt}_global_collateral_config`,
          oracle,
          'invoke.market_1eth_set_cp_limits',
        ]) {
          if (environment === 'network' && step === 'invoke.rhedge_global_collateral_config') {
            assert(
              !raw.invoke.rhedge_global_collateral_config,
              'PRO-1137 collateral rewrite must stay deferred'
            );
          } else assert(registration.includes(step), `${receipt} registration must follow ${step}`);
        }
        if (environment === 'devnet') {
          assert(!raw.clone?.[receipt], 'devnet must reuse Cronos tokens');
          const identity = receipt.toUpperCase() + 'Proxy';
          for (const action of Object.values(raw.invoke)) {
            assert(
              !action.target?.some(
                (target) => target.includes(identity) || target.startsWith(receipt + '.')
              ),
              `devnet must not mutate shared ${receipt}`
            );
          }
          if (existingReceipts.includes(receipt)) {
            const seed =
              receipt === 'rhedge'
                ? 'invoke.oracle_adapters_reya_lm_hedge_init_price'
                : `invoke.devnet_oracle_adapters_reya_lm_${receipt.slice(1)}_init_price`;
            assert(
              registration.includes(seed),
              `devnet ${receipt} registration must follow its own price seed`
            );
          }
        } else if (existingReceipts.includes(receipt)) {
          // Existing-token migrations grant the owner before revoking former authorities.
          for (const [role, grant] of [
            ['mint', 'minter1'],
            ['subscription', 'subscriber'],
            ['redemption', 'redeemer'],
            ['whitelistedCustodians', 'custodian'],
          ]) {
            assert(
              ancestors(`invoke.${receipt}_remove_previous_${role}`).includes(
                `invoke.${receipt}_enable_${grant}`
              ),
              `${receipt} must grant owner ${role} before revocation`
            );
          }
          if (receipt !== 'rhedge') {
            for (const role of ['subscription', 'redemption']) {
              assert(
                ancestors(`invoke.${receipt}_remove_historical_${role}`).includes(
                  `invoke.${receipt}_remove_previous_${role}`
                )
              );
            }
          }
        }
      }
      // Creation-only requirements: existing receipts must not be reinitialized or reset to a seed NAV.
      for (const receipt of newReceipts) {
        const registration = ancestors(`invoke.cp_1rusd_set_${receipt}_config`);
        for (const step of [
          `invoke.${receipt}_global_collateral_config`,
          'invoke.market_1eth_set_cp_limits',
        ]) {
          assert(registration.includes(step), `${receipt} registration must follow ${step}`);
        }
        // A 1:1 sUSDe claim needs no feed of its own; an LM seed/bounds/node here would be an
        // impairment re-point smuggled into the deployment graph.
        for (const step of [
          'seed_price',
          'price_bounds',
          'oracle_node',
          'oracle_max_stale_duration',
        ])
          assert.equal(
            raw.invoke[`${receipt}_${step}`],
            undefined,
            `new receipts must not carry an LM feed (${receipt}_${step})`
          );
        // The receipt must read the very node the sUSDe collateral reads, not a copy of it.
        assert.equal(
          resolveSettingTemplate(
            raw.invoke[`cp_1rusd_set_${receipt}_config`].args[3].oracleNodeId,
            settings
          ),
          resolveSettingTemplate(raw.invoke[susdeCollateralStep].args[3].oracleNodeId, settings),
          `${receipt} must be priced by the sUSDe collateral node`
        );
        if (environment === 'devnet') {
          assert(!raw.clone?.[receipt], 'devnet must reuse Cronos tokens');
          // Devnet pins the live Cronos token (reya-omnibus:1.0.148@main) rather than deploying
          // one: the pin must be a real address, and a wrong pin must abort the build, never skip
          // the receipt steps. Every receipt step depends on this var, and getAddress throws at
          // build time on an empty or mis-checksummed value.
          assert.match(
            raw.setting?.[`${receipt}ProxyAddress`]?.defaultValue ?? '',
            /^0x[0-9a-fA-F]{40}$/,
            `devnet must pin the live Cronos ${receipt} address`
          );
          assert.equal(
            raw.var.receipt_token_addresses?.[`${receipt}ProxyAddressChecked`],
            `<%= getAddress(settings.${receipt}ProxyAddress) %>`,
            `devnet must guard ${receipt}ProxyAddress with getAddress`
          );
          for (const action of Object.values(raw.invoke)) {
            assert(
              !action.target?.includes(`${receipt.toUpperCase()}Proxy`),
              'devnet must not mutate receipt tokens'
            );
          }
        } else {
          const activation = ancestors(`invoke.${receipt}_unpause`);
          for (const step of [
            'initialize',
            'global_config',
            'set_pausers',
            'enable_minter1',
            'enable_subscriber',
            'enable_redeemer',
            'enable_custodian',
            'enable_underlying_token',
            'enable_underlying_susde',
            'auto_exchange_access',
            'rusd_configure_spot_market',
          ]) {
            assert(
              activation.includes(`invoke.${receipt}_${step}`),
              `${receipt} unpause must follow ${step}`
            );
          }
          assert(
            ancestors(`invoke.${receipt}_enable_underlying_susde`).includes(
              `invoke.${receipt}_enable_underlying_token`
            ),
            `${receipt}: rUSD must precede sUSDe in the settlement allowlist`
          );
          assert(activation.includes(`invoke.passive_pool_allow_${receipt}_for_auto_rebalance`));
          assert(ancestors(`invoke.${receipt}_initialize`).includes('clone.reyaShareTokenRouter'));
        }
      }
      console.log(`Validated ${location}/reya_${environment}.toml`);
    }
  }
}
module.exports = { main };
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
