import { greeks, impliedVol, parseOcc, yearsToExpiry, type Greeks } from '@/lib/options-math';

// Options chain from Alpaca's free "indicative" feed (modified quotes, delayed trades; not OPRA).
// Needs ALPACA_API_KEY and ALPACA_SECRET_KEY on the server (the same paper keys the trading bots use).
// Keys go in headers only and are never sent to the browser.

const DATA = 'https://data.alpaca.markets';

export type ChainSide = { bid: number | null; ask: number | null; iv: number | null; greeks: Greeks | null };
export type ChainRow = { strike: number; call: ChainSide | null; put: ChainSide | null };
export type Chain =
    | { status: 'ok'; symbol: string; spot: number; expiry: string; expiries: string[]; rows: ChainRow[] }
    | { status: 'unconfigured' | 'unavailable' };

const keys = () => {
    const id = process.env.ALPACA_API_KEY, secret = process.env.ALPACA_SECRET_KEY;
    return id && secret ? { 'APCA-API-KEY-ID': id, 'APCA-API-SECRET-KEY': secret } : null;
};

async function alpaca(path: string, headers: Record<string, string>) {
    try {
        const res = await fetch(DATA + path, { headers: { Accept: 'application/json', ...headers }, next: { revalidate: 60 }, signal: AbortSignal.timeout(12_000) });
        return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

const price = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export async function getChain(rawSymbol: string, wantExpiry?: string, strikesEachSide = 8): Promise<Chain> {
    const headers = keys();
    if (!headers) return { status: 'unconfigured' };
    const symbol = rawSymbol.toUpperCase();
    if (!/^[A-Z.]{1,6}$/.test(symbol)) return { status: 'unavailable' };

    const snap = await alpaca(`/v2/stocks/${encodeURIComponent(symbol)}/snapshot?feed=iex`, headers);
    const spot = price((snap?.latestTrade as Record<string, unknown> | undefined)?.p);
    if (!spot) return { status: 'unavailable' };

    // Pull up to 3 pages (3,000 contracts) of the next ~10 weeks.
    const until = new Date(Date.now() + 70 * 86_400_000).toISOString().slice(0, 10);
    const snapshots: Record<string, Record<string, unknown>> = {};
    let token: string | null = null;
    for (let page = 0; page < 3; page++) {
        const qs = new URLSearchParams({ feed: 'indicative', limit: '1000', expiration_date_lte: until });
        if (token) qs.set('page_token', token);
        const body = await alpaca(`/v1beta1/options/snapshots/${encodeURIComponent(symbol)}?${qs}`, headers);
        if (!body || typeof body.snapshots !== 'object' || body.snapshots === null) break;
        Object.assign(snapshots, body.snapshots);
        token = typeof body.next_page_token === 'string' ? body.next_page_token : null;
        if (!token) break;
    }

    const contracts = Object.entries(snapshots)
        .map(([occ, s]) => ({ occ: parseOcc(occ), s }))
        .filter((c): c is { occ: NonNullable<ReturnType<typeof parseOcc>>; s: Record<string, unknown> } => c.occ !== null);
    const expiries = [...new Set(contracts.map((c) => c.occ.expiry))].sort();
    if (!expiries.length) return { status: 'unavailable' };
    const expiry = wantExpiry && expiries.includes(wantExpiry) ? wantExpiry : expiries.find((e) => (yearsToExpiry(e) ?? 0) > 2 / 365) ?? expiries[0];
    const T = yearsToExpiry(expiry);

    const byStrike = new Map<number, ChainRow>();
    for (const { occ, s } of contracts) {
        if (occ.expiry !== expiry) continue;
        const q = (s.latestQuote ?? {}) as Record<string, unknown>;
        const bid = price(q.bp), ask = price(q.ap);
        const mid = bid && ask && ask >= bid ? (bid + ask) / 2 : null;
        const iv = mid && T && T > 0 ? impliedVol(occ.kind, mid, spot, occ.strike, T) : null;
        const side: ChainSide = { bid, ask, iv, greeks: iv && T ? greeks(occ.kind, spot, occ.strike, T, iv) : null };
        const row = byStrike.get(occ.strike) ?? { strike: occ.strike, call: null, put: null };
        row[occ.kind] = side;
        byStrike.set(occ.strike, row);
    }
    const all = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
    const atm = all.reduce((best, r, i) => (Math.abs(r.strike - spot) < Math.abs(all[best].strike - spot) ? i : best), 0);
    const rows = all.slice(Math.max(0, atm - strikesEachSide), atm + strikesEachSide + 1);
    return { status: 'ok', symbol, spot, expiry, expiries, rows };
}
