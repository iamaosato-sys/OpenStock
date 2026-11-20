import { KALSHI_SERIES, POLYMARKET_TAGS, stockTopicsFor, type StockTopic } from './relevance';

// Read-only browsing of public Polymarket and Kalshi data. No accounts, keys or orders.
// Note for UK users: Kalshi doesn't accept UK customers and Polymarket is close-only for the UK.

export type PredictionMarket = { question: string; yes: number | null; label: string | null };
export type PredictionEvent = {
    id: string;
    provider: 'polymarket' | 'kalshi';
    title: string;
    url: string;
    endDate: string | null;
    volume24h: number | null;
    topics: StockTopic[];
    markets: PredictionMarket[];
};

const POLY = 'https://gamma-api.polymarket.com';
const KALSHI = 'https://external-api.kalshi.com/trade-api/v2';
const REVALIDATE = 300; // seconds; public data, cached by Next for everyone

async function getJSON(url: string): Promise<unknown> {
    try {
        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            next: { revalidate: REVALIDATE },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : null;
};

const prob = (v: unknown): number | null => {
    const n = num(v);
    return n !== null && n >= 0 && n <= 1 ? n : null;
};

const parseList = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return [];
    try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function normalizePolymarket(e: Row): PredictionEvent | null {
    const title = str(e.title);
    const slug = str(e.slug);
    if (!title || !slug || e.closed === true) return null;
    const tags = (Array.isArray(e.tags) ? e.tags : []).map((t) => str((t as Row)?.label)).filter(Boolean);
    const markets: PredictionMarket[] = [];
    const topics = new Set<StockTopic>();
    for (const m of (Array.isArray(e.markets) ? e.markets : []) as Row[]) {
        if (m.closed === true || m.active === false) continue;
        const question = str(m.question);
        const found = stockTopicsFor(title, question, tags);
        if (!found.length) continue;
        found.forEach((t) => topics.add(t));
        const outcomes = parseList(m.outcomes).map(String);
        const prices = parseList(m.outcomePrices);
        const yesAt = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
        markets.push({ question, yes: prob(prices[yesAt >= 0 ? yesAt : 0]), label: str(m.groupItemTitle) || null });
    }
    if (!markets.length) return null;
    return {
        id: `polymarket:${str(e.id) || slug}`, provider: 'polymarket', title,
        url: `https://polymarket.com/event/${encodeURIComponent(slug)}`,
        endDate: str(e.endDate) || null, volume24h: num(e.volume24hr), topics: [...topics], markets,
    };
}

// Kalshi prices come as dollar strings (`yes_ask_dollars`) on the current API, cents on older payloads.
const kalshiDollars = (m: Row, key: string): number | null => {
    const d = prob(m[`${key}_dollars`]);
    if (d !== null) return d;
    const c = num(m[key]);
    return c !== null && c >= 0 && c <= 100 ? c / 100 : null;
};

export function normalizeKalshi(e: Row): PredictionEvent | null {
    const title = str(e.title);
    const ticker = str(e.event_ticker);
    if (!title || !ticker) return null;
    const series = str(e.series_ticker);
    const tags = [str(e.category)].filter(Boolean);
    const markets: PredictionMarket[] = [];
    const topics = new Set<StockTopic>();
    let volume = 0;
    for (const m of (Array.isArray(e.markets) ? e.markets : []) as Row[]) {
        if (str(m.status) && !['active', 'open'].includes(str(m.status))) continue;
        const question = str(m.yes_sub_title) || str(m.title);
        const found = stockTopicsFor(title, question, tags);
        if (!found.length) continue;
        found.forEach((t) => topics.add(t));
        const last = kalshiDollars(m, 'last_price');
        const bid = kalshiDollars(m, 'yes_bid');
        const ask = kalshiDollars(m, 'yes_ask');
        const mid = bid !== null && ask !== null && ask > 0 ? (bid + ask) / 2 : null;
        markets.push({ question, yes: mid ?? last, label: null });
        volume += num(m.volume_24h) ?? 0;
    }
    if (!markets.length) return null;
    return {
        id: `kalshi:${ticker}`, provider: 'kalshi', title,
        // The public payload has no event page slug; link the series rather than invent a URL.
        url: series ? `https://kalshi.com/markets/${encodeURIComponent(series.toLowerCase())}` : 'https://kalshi.com/markets',
        endDate: str((e.markets as Row[] | undefined)?.[0]?.close_time) || null,
        volume24h: volume || null, topics: [...topics], markets,
    };
}

export async function getStockPredictionEvents(): Promise<{ events: PredictionEvent[]; partial: boolean }> {
    let failed = 0;
    const poly = await Promise.all(POLYMARKET_TAGS.map(async (tag) => {
        const body = await getJSON(`${POLY}/events?tag_id=${tag.id}&closed=false&limit=25&order=volume24hr&ascending=false`);
        if (!Array.isArray(body)) { failed++; return []; }
        return body.map((e) => normalizePolymarket(e as Row));
    }));
    // Kalshi rate-limits bursts: one series at a time.
    const kalshi: (PredictionEvent | null)[] = [];
    for (const s of KALSHI_SERIES) {
        const body = (await getJSON(`${KALSHI}/events?series_ticker=${s}&status=open&with_nested_markets=true&limit=3`)) as Row | null;
        if (!body || !Array.isArray(body.events)) { failed++; continue; }
        kalshi.push(...(body.events as Row[]).map(normalizeKalshi));
    }
    const byId = new Map<string, PredictionEvent>();
    for (const e of [...poly.flat(), ...kalshi]) if (e && !byId.has(e.id)) byId.set(e.id, e);
    const events = [...byId.values()].sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
    return { events, partial: failed > 0 };
}

export function filterEvents(events: PredictionEvent[], q: string, topic: string): PredictionEvent[] {
    const needle = q.trim().toLowerCase();
    return events.filter((e) =>
        (!topic || e.topics.includes(topic as StockTopic)) &&
        (!needle || e.title.toLowerCase().includes(needle) || e.markets.some((m) => m.question.toLowerCase().includes(needle))));
}
