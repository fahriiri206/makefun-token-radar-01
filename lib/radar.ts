// FIELDNOTE's radar model. One sealed DefiLlama snapshot in, one explainable ranked board out.
//
// The board is built only from the snapshot's own record. A protocol is "no token in record"
// when gecko_id, symbol and mcap_usd are all null; that is a statement about DefiLlama's record,
// never a claim that the protocol has no token. The ranked board covers every watchlist slug and
// adds the other no-token protocols whose category is not a wrapped/bridged/staked product, so the
// radar can surface protocols below the house floor as well as the floor itself.
//
// Implied value is deliberately conservative and fully derived:
//
//   comp        = median(mcap_usd / tvl_usd) of live peers in the same category
//   comp_used   = clamp(comp, 0.05, 4) x 0.60 haircut
//   growth      = 1 + clamp(change_7d, -50, 100) / 100 x 0.30
//   maturity    = 0.60 + min(age_days, 1095) / 1095 x 0.40
//   confidence  = 1.00 high | 0.92 medium | 0.80 low
//   implied     = round(tvl_usd x comp_used x growth x maturity x confidence)
//
// The base value is one point, so the row also carries a band. The band is the peer-ratio
// quartile walk, not a market prediction: take the same comparable pool the median came from,
// swap the median for its 25th and 75th percentile mcap/TVL ratio, and run the identical
// haircut, growth, maturity and confidence factors.
//
//   implied_low  = tvl x clamp(p25, 0.05, 4) x 0.60 x growth x maturity x confidence
//   implied_high = tvl x clamp(p75, 0.05, 4) x 0.60 x growth x maturity x confidence
//
// The band says how much the peer set itself disagrees about mcap/TVL; it is not a forecast of
// where a token would trade, and it is forced to contain the base (low <= base <= high).
//
// No protocol name is special-cased. Every number the dashboard shows can be traced back to a
// snapshot field or to this formula.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface ModelConstants {
  version: string;
  comp_haircut: number;
  comp_floor: number;
  comp_ceiling: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  confidence_high: number;
  confidence_medium: number;
  confidence_low: number;
}

export const MODEL: ModelConstants = {
  version: 'fieldnote-1',
  comp_haircut: 0.6,
  comp_floor: 0.05,
  comp_ceiling: 4,
  growth_weight: 0.3,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  confidence_high: 1,
  confidence_medium: 0.92,
  confidence_low: 0.8,
};

export interface PeerComp {
  slug: string;
  name: string;
  tvl_usd: number;
  mcap_usd: number;
  ratio: number;
  distance: number;
}

export interface RiskFlag {
  level: 'high' | 'watch' | 'info';
  label: string;
  detail: string;
}

export interface Confidence {
  label: 'High' | 'Medium' | 'Low';
  score: number;
  factor: number;
  sample: number;
  category_sample: number;
  source: string;
  note: string;
}

export interface Valuation {
  tvl_usd: number;
  comp_raw: number;
  comp_used: number;
  comp_haircut: number;
  comp_sample: number;
  category_sample: number;
  comp_source: string;
  peer_p25: number;
  peer_p50: number;
  peer_p75: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  confidence_factor: number;
  confidence: Confidence;
  formula: string;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_base_usd: number;
  implied_high_usd: number;
  band_note: string;
}

export interface FarmStep {
  step: number;
  action: string;
  cost: string;
  duration: string;
  cost_low_usd: number;
  cost_high_usd: number;
  duration_minutes: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'no-token-in-record';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  valuation: Valuation;
  risk: { score: number; flags: RiskFlag[] };
  peer_comps: PeerComp[];
  farm_steps: string[];
  farm_plan: FarmStep[];
  farm_budget_usd: number;
  farm_time_days: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'token-trades';
  mcap_tvl: number | null;
}

export interface RadarData {
  meta: {
    as_of: string;
    source: string;
    floor_usd: number;
    model: ModelConstants;
    watchlist_size: number;
    board_size: number;
    early_size: number;
    live_size: number;
    no_token_size: number;
  };
  rows: BoardRow[];
  live: LiveRow[];
  categories: string[];
  chains: string[];
  stats: {
    confidence: { High: number; Medium: number; Low: number };
    board_by_category: Array<{ name: string; count: number }>;
    watchlist_by_category: Array<{ name: string; count: number }>;
    median_implied: number;
    top_implied: number;
    watchlist_implied: number;
  };
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const PRODUCT_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4;
const round2 = (value: number): number => Math.round(value * 1e2) / 1e2;

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

export function isNoToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

function isRankableNoToken(p: Protocol): boolean {
  if (!isNoToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name) || PRODUCT_WORD.test(p.name) || EXCHANGE_START.test(p.name)) return false;
  return true;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Linear-interpolated quantile of a sorted-once copy; q is 0..1. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * clamp(q, 0, 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (pos - lower);
}

interface CompIndex {
  all: number[];
  peers: Protocol[];
}

function buildCompIndex(snapshot: Snapshot): CompIndex {
  const all: number[] = [];
  const peers: Protocol[] = [];
  for (const p of snapshot.protocols) {
    if (isNoToken(p)) continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    if (p.category === 'CEX') continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    peers.push(p);
    all.push(ratio);
  }
  return { all, peers };
}

interface CompPool {
  ratios: number[];
  peers: Protocol[];
  source: string;
  category_sample: number;
}

const ratioOf = (peer: Protocol): number => (peer.mcap_usd ?? 0) / peer.tvl_usd;

/** The peer pool one protocol is priced against: category peers, else chain peers, else all live peers. */
function compPool(p: Protocol, index: CompIndex): CompPool {
  const categoryPeers = p.category === null ? [] : index.peers.filter((peer) => peer.category === p.category);
  if (categoryPeers.length >= 3) {
    return { ratios: categoryPeers.map(ratioOf), peers: categoryPeers, source: `${p.category} peers`, category_sample: categoryPeers.length };
  }
  const chains = new Set(p.chains);
  const chainPeers = index.peers.filter((peer) => peer.chains.some((chain) => chains.has(chain)));
  if (chainPeers.length >= 3) {
    return { ratios: chainPeers.map(ratioOf), peers: chainPeers, source: 'chain peers', category_sample: categoryPeers.length };
  }
  return { ratios: index.all, peers: index.peers, source: 'all live peers', category_sample: categoryPeers.length };
}

function confidenceFor(p: Protocol, age: number | null, categorySample: number, usedSample: number, source: string): Confidence {
  let score = 34 + Math.min(categorySample, 12) * 4 + Math.min(usedSample, 20);
  if (age !== null) score += age >= 365 ? 14 : 6;
  if (p.change_7d !== null) score += 8;
  if (p.chains.length > 1) score += 6;
  if (categorySample >= 8) score += 8;
  score = Math.round(clamp(score, 20, 96));
  let label: Confidence['label'] = 'Low';
  if (categorySample >= 8 && age !== null && age >= 365 && p.change_7d !== null) label = 'High';
  else if ((categorySample >= 3 || usedSample >= 20) && (age !== null || p.change_7d !== null)) label = 'Medium';
  const factor = label === 'High' ? MODEL.confidence_high : label === 'Medium' ? MODEL.confidence_medium : MODEL.confidence_low;
  const note =
    `${categorySample} live same-category peer${categorySample === 1 ? '' : 's'}` +
    `${usedSample === categorySample ? '' : `, ${usedSample} ${source}`}, ` +
    `${age === null ? 'age not recorded' : `${age.toLocaleString('en-US')} days on record`}, ` +
    `${p.change_7d === null ? '7-day change not reported' : '7-day change reported'}.`;
  return { label, score, factor, sample: usedSample, category_sample: categorySample, source, note };
}

function nearestPeers(p: Protocol, index: CompIndex): PeerComp[] {
  return compPool(p, index).peers
    .map((peer) => ({
      slug: peer.slug,
      name: peer.name,
      tvl_usd: peer.tvl_usd,
      mcap_usd: peer.mcap_usd ?? 0,
      ratio: round4(ratioOf(peer)),
      distance: Math.abs(Math.log((p.tvl_usd + 1) / (peer.tvl_usd + 1))),
    }))
    .filter((peer) => peer.ratio > 0)
    .sort((a, b) => a.distance - b.distance || b.tvl_usd - a.tvl_usd)
    .slice(0, 5)
    .map(({ distance, ...peer }) => peer);
}

function valueProtocol(p: Protocol, snapshot: Snapshot, index: CompIndex): { implied: number; valuation: Valuation; age: number | null } {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const pool = compPool(p, index);
  const ratios = pool.ratios;
  const categorySample = pool.category_sample;
  const source = pool.source;
  const compRaw = median(ratios);
  const compClamped = clamp(compRaw, MODEL.comp_floor, MODEL.comp_ceiling);
  const compUsed = compClamped * MODEL.comp_haircut;
  const growthPct = clamp(p.change_7d ?? 0, MODEL.growth_floor, MODEL.growth_cap);
  const growthMult = 1 + (growthPct / 100) * MODEL.growth_weight;
  const ageForModel = age ?? MODEL.unknown_age_days;
  const maturityMult = MODEL.maturity_floor + (clamp(ageForModel, 0, MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
  const confidence = confidenceFor(p, age, categorySample, ratios.length, source);
  const factor = growthMult * maturityMult * confidence.factor;
  const p25 = quantile(ratios, 0.25);
  const p50 = quantile(ratios, 0.5);
  const p75 = quantile(ratios, 0.75);
  const lowComp = clamp(p25, MODEL.comp_floor, MODEL.comp_ceiling) * MODEL.comp_haircut;
  const highComp = clamp(p75, MODEL.comp_floor, MODEL.comp_ceiling) * MODEL.comp_haircut;
  const rawImplied = p.tvl_usd * compUsed * factor;
  const base = Math.max(1, Math.min(100_000_000_000_000, Math.round(rawImplied)));
  const rawLow = p.tvl_usd * lowComp * factor;
  const rawHigh = p.tvl_usd * highComp * factor;
  const low = Math.max(1, Math.min(base, Math.round(rawLow)));
  const high = Math.max(base, Math.min(100_000_000_000_000, Math.round(rawHigh)));
  const formula =
    `$${Math.round(p.tvl_usd).toLocaleString('en-US')} TVL x ${round2(compUsed).toFixed(2)} comp ` +
    `x ${round4(growthMult).toFixed(2)} growth x ${round4(maturityMult).toFixed(2)} maturity ` +
    `x ${confidence.factor.toFixed(2)} confidence`;
  const bandNote =
    `Peer mcap/TVL quartiles in the ${source} pool are ${round2(p25).toFixed(2)}x / ` +
    `${round2(p50).toFixed(2)}x / ${round2(p75).toFixed(2)}x (p25 / p50 / p75); the band re-runs ` +
    `the same formula at p25 and p75. It measures peer disagreement, not a price prediction.`;
  const valuation: Valuation = {
    tvl_usd: p.tvl_usd,
    comp_raw: round4(compRaw),
    comp_used: round4(compUsed),
    comp_haircut: MODEL.comp_haircut,
    comp_sample: ratios.length,
    category_sample: categorySample,
    comp_source: source,
    peer_p25: round4(p25),
    peer_p50: round4(p50),
    peer_p75: round4(p75),
    growth_pct: round4(growthPct),
    growth_multiplier: round4(growthMult),
    maturity_multiplier: round4(maturityMult),
    confidence_factor: confidence.factor,
    confidence,
    formula,
    implied_value_usd: base,
    implied_low_usd: low,
    implied_base_usd: base,
    implied_high_usd: high,
    band_note: bandNote,
  };
  return { implied: base, valuation, age };
}

function riskFor(p: Protocol, age: number | null, valuation: Valuation): { score: number; flags: RiskFlag[] } {
  const flags: RiskFlag[] = [];
  if (age === null) {
    flags.push({
      level: 'watch',
      label: 'Age not recorded',
      detail: 'DefiLlama reports no listing date, so the maturity multiplier uses the conservative default.',
    });
  } else if (age < 180) {
    flags.push({
      level: 'watch',
      label: `Young record (${age} days)`,
      detail: 'Less than six months of tracked TVL means the growth and maturity signals are thin.',
    });
  }
  if (p.change_7d !== null && p.change_7d <= -10) {
    flags.push({
      level: p.change_7d <= -25 ? 'high' : 'watch',
      label: `TVL ${p.change_7d.toFixed(2)}% over 7 days`,
      detail: 'A falling TVL base lowers the implied value and can signal depositors leaving.',
    });
  }
  if (p.chains.length === 1) {
    flags.push({
      level: 'info',
      label: `Single-chain exposure (${p.chains[0]})`,
      detail: 'The protocol records TVL on one chain only; a chain outage or bridge event hits the whole position.',
    });
  }
  if (valuation.comp_sample < 3) {
    flags.push({
      level: 'watch',
      label: 'Thin peer sample',
      detail: `Only ${valuation.comp_sample} live comparison${valuation.comp_sample === 1 ? '' : 's'} priced this estimate; confidence is reduced.`,
    });
  }
  if (valuation.comp_raw > MODEL.comp_ceiling || valuation.comp_raw < MODEL.comp_floor) {
    flags.push({
      level: 'watch',
      label: 'Peer comp clamped',
      detail: `The peer median of ${valuation.comp_raw.toFixed(2)}x sits outside the model's ${MODEL.comp_floor}..${MODEL.comp_ceiling}x band, so the estimate uses the band edge.`,
    });
  }
  const category = (p.category ?? '').toLowerCase();
  if (category.includes('curator') || category.includes('allocator')) {
    flags.push({
      level: 'watch',
      label: 'Curator discretion',
      detail: 'A curator or allocator chooses the underlying strategies; the protocol record does not show those positions or their counterparties.',
    });
  }
  if (category.includes('bridge') || category.includes('cross chain')) {
    flags.push({
      level: 'high',
      label: 'Bridge dependency',
      detail: 'Funds depend on bridge contracts and their operators; a bridge failure can impair the whole position.',
    });
  }
  flags.push({
    level: 'info',
    label: 'Smart-contract and governance risk',
    detail: 'TVL is not a safety score: a contract bug, key compromise or governance change can impair the position.',
  });
  if (p.tvl_usd < 10_000_000) {
    flags.push({
      level: 'info',
      label: 'Small TVL base',
      detail: 'The protocol is below $10M of TVL; position size and exit liquidity need extra care.',
    });
  }
  flags.push({
    level: 'info',
    label: 'No token in DefiLlama record',
    detail: 'gecko_id, symbol and mcap_usd are null in the sealed snapshot. That is not proof the protocol has no token.',
  });
  flags.push({
    level: 'info',
    label: 'Static snapshot',
    detail: 'The file is a sealed historical snapshot; the radar cannot check live contracts, yields or eligibility.',
  });
  let score = 8;
  for (const flag of flags) score += flag.level === 'high' ? 30 : flag.level === 'watch' ? 14 : 4;
  return { score: Math.round(clamp(score, 0, 100)), flags };
}

function capitalFor(p: Protocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

// Gas is derived from the chain, never from the protocol's name. Ethereum L1 and Bitcoin pay
// real per-transaction fees; the L2s, Solana-class chains and newer appchains are cents.
const LOW_FEE_CHAINS = new Set([
  'arbitrum', 'base', 'optimism', 'polygon', 'binance', 'avalanche', 'solana', 'sui', 'aptos',
  'near', 'ton', 'tron', 'stellar', 'algorand', 'cardano', 'ripple', 'noble', 'monad',
  'hyperliquid l1', 'plume mainnet', 'mezo', 'ink', 'katana', 'arc', 'tempo', 'pharos',
  'bittensor', 'flare', 'core', 'babylon genesis', 'bsquared', 'citrea', 'etherlink', 'hemi',
  'world chain', 'stable', 'morph', 'tac', 'rayls', 'corn', 'bob', 'fluent', 'sei', 'xdai',
  'fantom', 'celo', 'berachain', 'mantle', 'linea', 'scroll', 'zksync era', 'blast', 'sonic',
  'unichain', 'ronin', 'abstract', 'apechain', 'astar', 'aurora', 'cronos', 'filecoin', 'gnosis',
  'immutable zkevm', 'klaytn', 'kaia', 'manta', 'metis', 'moonbeam', 'opbnb', 'rootstock',
  'starknet', 'taiko', 'viction', 'wemix', 'zora', 'plasma', 'robinhood chain',
]);

interface GasProfile {
  low: number;
  high: number;
  label: string;
  chain: string;
}

function gasProfile(chain: string | undefined): GasProfile {
  const named = (chain ?? '').trim();
  const key = named.toLowerCase();
  if (key === 'ethereum' || key === 'mainnet') return { low: 3, high: 18, label: 'Ethereum L1 gas', chain: named };
  if (key === 'bitcoin') return { low: 1.5, high: 8, label: 'Bitcoin network fee', chain: named };
  if (LOW_FEE_CHAINS.has(key)) return { low: 0.02, high: 0.6, label: `${named} gas`, chain: named };
  return { low: 0.1, high: 2, label: `${named || 'network'} gas`, chain: named || 'its main chain' };
}

function usdRange(low: number, high: number): string {
  const fmt = (n: number): string => {
    if (n >= 10) return `$${Math.round(n).toLocaleString('en-US')}`;
    const text = (Math.round(n * 100) / 100).toFixed(2);
    return `$${text.replace(/\.00$/, '')}`;
  };
  const lo = Math.max(0, low);
  const hi = Math.max(lo, high);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
}

interface FarmFees {
  entry_low_pct: number;
  entry_high_pct: number;
  exit_low_pct: number;
  exit_high_pct: number;
  entry_action: string;
  weekly_verb: string;
}

// Protocol fees are derived from the category and the capital, never from a name. Percentages are
// of the capital deployed, so they scale with the budget the row states.
function farmFees(p: Protocol, budget: number, chain: string): FarmFees {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.005, exit_low_pct: 0, exit_high_pct: 0.005,
      entry_action: `Deposit $${budget} of USDC into a ${name} curated vault on ${chain}, read the curator fee before signing and keep the vault receipt.`,
      weekly_verb: 'deposit check or curator-vault report review',
    };
  }
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.001, exit_low_pct: 0, exit_high_pct: 0.001,
      entry_action: `Supply $${budget} of USDC to ${name} on ${chain} and, only if the app rewards it, borrow at most half against the supply.`,
      weekly_verb: 'supply, borrow or repay action',
    };
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('farm') || c.includes('liquidity')) {
    return {
      entry_low_pct: 0.0005, entry_high_pct: 0.003, exit_low_pct: 0.0005, exit_high_pct: 0.003,
      entry_action: `Provide $${budget} of liquidity to ${name}'s main ${chain} pool in a range you can rebalance, and keep the LP receipt.`,
      weekly_verb: 'swap, rebalance or fee claim',
    };
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return {
      entry_low_pct: 0.0005, entry_high_pct: 0.003, exit_low_pct: 0.0005, exit_high_pct: 0.003,
      entry_action: `Bridge $${budget} of USDC through ${name} to ${chain}, then use the bridged funds inside the app and keep the bridge receipt.`,
      weekly_verb: 'bridge or app transaction',
    };
  }
  if (c.includes('stak') || c.includes('restak')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.001, exit_low_pct: 0, exit_high_pct: 0.001,
      entry_action: `Stake $${budget} of ${chain}'s native asset through ${name} and keep the liquid staking receipt.`,
      weekly_verb: 'stake, delegate or restake action',
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis') || c.includes('option')) {
    return {
      entry_low_pct: 0.0002, entry_high_pct: 0.001, exit_low_pct: 0.0002, exit_high_pct: 0.001,
      entry_action: `Deposit $${budget} of USDC as margin on ${name} on ${chain}, open one small hedge and stay inside the app's limits.`,
      weekly_verb: 'trade, hedge roll or margin check',
    };
  }
  if (c.includes('prediction')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.02, exit_low_pct: 0, exit_high_pct: 0.02,
      entry_action: `Fund $${budget} on ${name} on ${chain}, place one liquid market position and record the market id and resolution date.`,
      weekly_verb: 'market position or resolution check',
    };
  }
  if (c.includes('rwa')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.01, exit_low_pct: 0, exit_high_pct: 0.01,
      entry_action: `Subscribe to $${budget} of ${name}'s yield asset on ${chain}, confirm the redemption terms and hold the receipt.`,
      weekly_verb: 'subscription, yield check or redemption action',
    };
  }
  if (c.includes('insurance')) {
    return {
      entry_low_pct: 0.005, entry_high_pct: 0.03, exit_low_pct: 0, exit_high_pct: 0.002,
      entry_action: `Buy $${budget} of cover from ${name} on ${chain}, save the policy terms and read the claims process before you need it.`,
      weekly_verb: 'cover or claims check',
    };
  }
  if (c.includes('stable')) {
    return {
      entry_low_pct: 0, entry_high_pct: 0.001, exit_low_pct: 0, exit_high_pct: 0.001,
      entry_action: `Mint or deposit $${budget} of the stable asset through ${name} on ${chain}, confirm the collateral ratio and keep the receipt.`,
      weekly_verb: 'mint, repay or collateral check',
    };
  }
  return {
    entry_low_pct: 0, entry_high_pct: 0.005, exit_low_pct: 0, exit_high_pct: 0.005,
    entry_action: `Deposit $${budget} of USDC into ${name} on ${chain}, confirm the deposit asset in the app's own docs and keep the position open.`,
    weekly_verb: 'deposit, swap or vote action',
  };
}

function step(text: string): string {
  let value = text.replace(/\s+/g, ' ').trim();
  if (value.length > 600) value = `${value.slice(0, 596)}...`;
  if (value.length < 20) value = `${value} Keep the position and check the protocol's own page.`;
  return value;
}

/** Six costed steps per row: each names an action, a USD cost range and a duration. */
function farmPlan(p: Protocol, age: number | null): { steps: string[]; plan: FarmStep[]; budget: number; days: number } {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const gas = gasProfile(chain);
  const budget = capitalFor(p);
  const days = holdFor(age);
  const weeks = Math.max(1, Math.round(days / 7));
  const fees = farmFees(p, budget, chain);
  const entryFee = usdRange(budget * fees.entry_low_pct, budget * fees.entry_high_pct);
  const exitFee = usdRange(budget * fees.exit_low_pct, budget * fees.exit_high_pct);
  const txGas = usdRange(gas.low, gas.high);
  const cadenceGas = usdRange(gas.low * weeks, gas.high * weeks);
  const bridgeFee = usdRange(budget * 0.0005, budget * 0.003);
  const plan: FarmStep[] = [
    {
      step: 1,
      action: `Create a dedicated wallet for ${p.name} and verify the ${gas.chain} contract address from the protocol's own docs before connecting; do not reuse a wallet that holds other funds.`,
      cost: '$0.00 (no transaction)', duration: '10–15 min',
      cost_low_usd: 0, cost_high_usd: 0, duration_minutes: 12,
    },
    {
      step: 2,
      action: `Fund the wallet with $${budget} of USDC on ${gas.chain}; if the funds start on another chain, bridge them once and budget the bridge fee shown here.`,
      cost: `${txGas} gas plus ${bridgeFee} bridge fee if you cross chains`, duration: '15–30 min',
      cost_low_usd: gas.low, cost_high_usd: gas.high + budget * 0.003, duration_minutes: 22,
    },
    {
      step: 3,
      action: fees.entry_action,
      cost: `${entryFee} protocol fee plus ${txGas} gas`, duration: '10–25 min',
      cost_low_usd: budget * fees.entry_low_pct + gas.low,
      cost_high_usd: budget * fees.entry_high_pct + gas.high,
      duration_minutes: 18,
    },
    {
      step: 4,
      action: `Repeat one qualifying ${fees.weekly_verb} every 7 days for ${days} days on ${p.name}, and log each transaction hash in a farm journal.`,
      cost: `${usdRange(gas.low, gas.high)} gas per weekly action, about ${cadenceGas} over ${weeks} weeks`,
      duration: `${days} days`,
      cost_low_usd: gas.low * weeks, cost_high_usd: gas.high * weeks, duration_minutes: days * 1440,
    },
    {
      step: 5,
      action: `When ${p.name} publishes a claim or points page, claim or compound only there, never at a link sent to you, and record the transaction.`,
      cost: `${txGas} gas for the claim`, duration: '10–20 min',
      cost_low_usd: gas.low, cost_high_usd: gas.high, duration_minutes: 15,
    },
    {
      step: 6,
      action: `Review ${p.name}'s TVL weekly and unwind through the same app: withdraw, remove liquidity or repay, then confirm the balance on ${gas.chain}.`,
      cost: `${exitFee} exit fee plus ${txGas} gas`, duration: '20–40 min',
      cost_low_usd: budget * fees.exit_low_pct + gas.low,
      cost_high_usd: budget * fees.exit_high_pct + gas.high,
      duration_minutes: 30,
    },
  ];
  const steps = plan.map((s) => step(`${s.action} Cost: ${s.cost}. Time: ${s.duration}.`));
  return { steps, plan, budget, days };
}

function bySlug(snapshot: Snapshot): Map<string, Protocol> {
  return new Map(snapshot.protocols.map((p) => [p.slug, p]));
}

export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const index = bySlug(snapshot);
  const watch = new Set(snapshot.watchlist);
  for (const slug of snapshot.watchlist) {
    if (!index.has(slug)) throw new SnapshotError(`the watchlist names ${slug}, which the protocols array does not carry`);
  }
  const chosen = snapshot.protocols.filter((p) => watch.has(p.slug) || isRankableNoToken(p));
  const scored = chosen.map((p) => {
    const { implied, valuation, age } = valueProtocol(p, snapshot, buildIndexOnce(snapshot));
    return { p, implied, valuation, age };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map(({ p, implied, valuation, age }, i) => {
    const farm = farmPlan(p, age);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'no-token-in-record',
      watchlist: watch.has(p.slug),
      age_days: age,
      implied_value_usd: implied,
      implied_low_usd: valuation.implied_low_usd,
      implied_high_usd: valuation.implied_high_usd,
      valuation,
      risk: riskFor(p, age, valuation),
      peer_comps: nearestPeers(p, buildIndexOnce(snapshot)),
      farm_steps: farm.steps,
      farm_plan: farm.plan,
      farm_budget_usd: farm.budget,
      farm_time_days: farm.days,
    };
  });
}

// A board is built in one pass; this memo keeps the peer index from being rebuilt per protocol.
let memoSnapshot: Snapshot | null = null;
let memoIndex: CompIndex | null = null;
function buildIndexOnce(snapshot: Snapshot): CompIndex {
  if (memoSnapshot === snapshot && memoIndex !== null) return memoIndex;
  memoSnapshot = snapshot;
  memoIndex = buildCompIndex(snapshot);
  return memoIndex;
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isNoToken(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'token-trades' as const,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const confidence = { High: 0, Medium: 0, Low: 0 };
  const boardCats = new Map<string, number>();
  const watchCats = new Map<string, number>();
  for (const row of board) {
    confidence[row.valuation.confidence.label] += 1;
    const key = row.category ?? 'Uncategorised';
    boardCats.set(key, (boardCats.get(key) ?? 0) + 1);
    if (row.watchlist) watchCats.set(key, (watchCats.get(key) ?? 0) + 1);
  }
  const byCount = (a: { count: number; name: string }, b: { count: number; name: string }): number =>
    b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const boardByCategory = [...boardCats.entries()].map(([name, count]) => ({ name, count })).sort(byCount);
  const watchByCategory = [...watchCats.entries()].map(([name, count]) => ({ name, count })).sort(byCount);
  const categories = [...new Set(board.map((r) => r.category ?? 'Uncategorised'))].sort();
  const chains = [...new Set(board.flatMap((r) => r.chains))].sort();
  const implied = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const watchImplied = board.filter((r) => r.watchlist).map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const radar: RadarData = {
    meta: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      model: MODEL,
      watchlist_size: snapshot.watchlist.length,
      board_size: board.length,
      early_size: board.filter((r) => !r.watchlist).length,
      live_size: live.length,
      no_token_size: snapshot.protocols.filter(isNoToken).length,
    },
    rows: board,
    live,
    categories,
    chains,
    stats: {
      confidence,
      board_by_category: boardByCategory,
      watchlist_by_category: watchByCategory,
      median_implied: implied.length > 0 ? implied[Math.floor(implied.length / 2)]! : 0,
      top_implied: board[0]?.implied_value_usd ?? 0,
      watchlist_implied: watchImplied.length > 0 ? watchImplied[Math.floor(watchImplied.length / 2)]! : 0,
    },
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((value, i): Protocol => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = value as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board has ${board.length} rows, outside 100..4000`;
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of board) {
    if (!known.has(row.slug)) return `${row.slug} is not in the snapshot's protocols`;
    if (seen.has(row.slug)) return `${row.slug} appears twice`;
    seen.add(row.slug);
    if (row.name.trim().length === 0) return `${row.slug} has an empty name`;
    if (!Number.isSafeInteger(row.rank) || row.rank <= 0) return `${row.slug} has rank ${row.rank}`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0 || row.implied_value_usd > 100_000_000_000_000) {
      return `${row.slug} has implied value ${row.implied_value_usd}`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `${row.slug} has ${row.farm_steps.length} farm steps`;
    if (!Number.isSafeInteger(row.farm_budget_usd) || row.farm_budget_usd <= 0) return `${row.slug} has farm budget ${row.farm_budget_usd}`;
    if (!Number.isSafeInteger(row.farm_time_days) || row.farm_time_days <= 0) return `${row.slug} has farm time ${row.farm_time_days}`;
    if (!(row.implied_low_usd > 0 && row.implied_low_usd <= row.implied_value_usd && row.implied_value_usd <= row.implied_high_usd)) {
      return `${row.slug} has a band of ${row.implied_low_usd}..${row.implied_high_usd} around ${row.implied_value_usd}`;
    }
    for (const stepText of row.farm_steps) {
      const trimmed = stepText.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${row.slug} has a farm step of ${trimmed.length} characters`;
      if (!trimmed.includes('$')) return `${row.slug} has a farm step with no dollar cost`;
      if (!/(min|hour|day|week)/i.test(trimmed)) return `${row.slug} has a farm step with no duration`;
    }
  }
  const missing = snapshot.watchlist.filter((slug) => !seen.has(slug));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.FIELDNOTE=${JSON.stringify(radar)};\n`;
}
