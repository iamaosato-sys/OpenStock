// Black-Scholes-Merton maths for the options panel. Pure functions, no I/O.
// Conventions follow zandy700/Ultimate-Tracker's options panel (MIT); this is a fresh implementation.
// European formula (US listed options are American), r is an assumption (4%), theta per calendar day,
// vega per 1 vol point. Everything shown is derived from delayed, indicative quotes.

export const RISK_FREE_RATE = 0.04;
export type OptionKind = 'call' | 'put';

// Standard normal CDF via erfc (accurate to ~1e-7, plenty for IV solving).
export function normCdf(x: number): number {
    return 0.5 * erfc(-x / Math.SQRT2);
}

export const normPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// Numerical Recipes erfc (Chebyshev), relative error < 1.2e-7.
function erfc(x: number): number {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
            t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
}

const valid = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x > 0);

export function bsPrice(kind: OptionKind, S: number, K: number, T: number, sigma: number, r = RISK_FREE_RATE, q = 0): number | null {
    if (!valid(S, K, T, sigma)) return null;
    const vt = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
    const d2 = d1 - vt;
    const dq = Math.exp(-q * T), dr = Math.exp(-r * T);
    return kind === 'call'
        ? S * dq * normCdf(d1) - K * dr * normCdf(d2)
        : K * dr * normCdf(-d2) - S * dq * normCdf(-d1);
}

export type Greeks = { delta: number; gamma: number; theta: number; vega: number };

export function greeks(kind: OptionKind, S: number, K: number, T: number, sigma: number, r = RISK_FREE_RATE, q = 0): Greeks | null {
    if (!valid(S, K, T, sigma)) return null;
    const sq = Math.sqrt(T), vt = sigma * sq;
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
    const d2 = d1 - vt;
    const dq = Math.exp(-q * T), dr = Math.exp(-r * T), n1 = normPdf(d1);
    const decay = -S * dq * n1 * sigma / (2 * sq);
    const theta = kind === 'call'
        ? decay - r * K * dr * normCdf(d2) + q * S * dq * normCdf(d1)
        : decay + r * K * dr * normCdf(-d2) - q * S * dq * normCdf(-d1);
    return {
        delta: kind === 'call' ? dq * normCdf(d1) : -dq * normCdf(-d1),
        gamma: dq * n1 / (S * vt),
        theta: theta / 365,
        vega: S * dq * n1 * sq / 100,
    };
}

/** Volatility that reproduces `price` (bisection, robust). Null outside no-arbitrage bounds. */
export function impliedVol(kind: OptionKind, price: number, S: number, K: number, T: number, r = RISK_FREE_RATE, q = 0): number | null {
    if (!valid(price, S, K, T)) return null;
    let lo = 1e-4, hi = 5;
    const f = (v: number) => (bsPrice(kind, S, K, T, v, r, q) as number) - price;
    if (f(lo) > 0 || f(hi) < 0) return null;
    for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0) hi = mid; else lo = mid;
        if (hi - lo < 1e-7) break;
    }
    return (lo + hi) / 2;
}

/** OCC symbol, e.g. AAPL261218C00150000 -> { root, expiry: '2026-12-18', kind: 'call', strike: 150 }. */
export function parseOcc(symbol: string): { root: string; expiry: string; kind: OptionKind; strike: number } | null {
    const m = /^([A-Z.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(symbol);
    if (!m) return null;
    return { root: m[1], expiry: `20${m[2]}-${m[3]}-${m[4]}`, kind: m[5] === 'C' ? 'call' : 'put', strike: Number(m[6]) / 1000 };
}

/** Years until 16:00 New York time on `expiry` (YYYY-MM-DD). */
export function yearsToExpiry(expiry: string, now = Date.now()): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
    if (!m) return null;
    for (const h of [20, 21]) { // 16:00 New York is 20:00 UTC in summer, 21:00 in winter
        const t = Date.UTC(+m[1], +m[2] - 1, +m[3], h);
        const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(t);
        if (Number(hour) === 16) return (t - now) / (365 * 86_400_000);
    }
    return null;
}
