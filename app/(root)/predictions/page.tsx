import Link from 'next/link';
import { ExternalLink, Scale } from 'lucide-react';
import Panel from '@/components/Panel';
import { filterEvents, getStockPredictionEvents, type PredictionEvent } from '@/lib/prediction-markets/fetch';
import { STOCK_TOPICS } from '@/lib/prediction-markets/relevance';

export const revalidate = 300;

const pct = (p: number | null) => (p == null ? '—' : `${Math.round(p * 100)}%`);
const money = (v: number | null) =>
    v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}m` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v.toFixed(0);
const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/London' }) : '—';

function EventCard({ e }: { e: PredictionEvent }) {
    const shown = e.markets.slice(0, 6);
    return (
        <li className="card flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-semibold leading-snug text-foreground">{e.title}</h3>
                <span className="pill shrink-0 capitalize">{e.provider}</span>
            </div>
            <ul className="flex flex-col gap-1">
                {shown.map((m, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-muted-foreground" title={m.question}>{m.label ?? m.question}</span>
                        <span className="num shrink-0 font-semibold text-foreground">{pct(m.yes)}</span>
                    </li>
                ))}
            </ul>
            {e.markets.length > shown.length && (
                <p className="text-[12px] text-faint">+{e.markets.length - shown.length} more on the source page</p>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-[12px] text-faint">
                <span>Ends {day(e.endDate)} · 24h vol {money(e.volume24h)}</span>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-brand-ink">
                    Rules & source <ExternalLink className="size-3" />
                </a>
            </div>
        </li>
    );
}

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
    const { q = '', topic = '' } = await searchParams;
    const query = q.slice(0, 80);
    const validTopic = STOCK_TOPICS.some((t) => t.id === topic) ? topic : '';
    const { events, partial } = await getStockPredictionEvents();
    const shown = filterEvents(events, query, validTopic).slice(0, 60);
    const href = (t: string) => `/predictions?${new URLSearchParams({ ...(query && { q: query }), ...(t && { topic: t }) })}`;

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Prediction markets</h1>
                    <p className="page-sub">
                        Stock-relevant questions from Polymarket and Kalshi: Fed, inflation, earnings, tariffs, AI, IPOs. Sport and
                        celebrity bets are filtered out. Read-only; percentages are the market&apos;s implied chance, not a forecast.
                    </p>
                </div>
            </header>

            <Panel
                title="Search"
                sub={partial ? 'Some sources didn’t answer; showing what loaded. Refreshes every 5 minutes.' : 'Refreshes every 5 minutes.'}
            >
                <form action="/predictions" className="flex flex-wrap items-center gap-2 p-3">
                    <input
                        name="q"
                        defaultValue={query}
                        maxLength={80}
                        placeholder="e.g. Nvidia, Fed, tariffs"
                        aria-label="Search prediction markets"
                        className="h-9 min-w-[220px] flex-1 rounded-[10px] border border-border bg-transparent px-3 text-[14px]"
                    />
                    {validTopic && <input type="hidden" name="topic" value={validTopic} />}
                    <button type="submit" className="btn btn-primary">Search</button>
                </form>
                <nav aria-label="Topics" className="flex flex-wrap gap-1.5 px-3 pb-3">
                    <Link href={href('')} className={`btn btn-ghost ${!validTopic ? 'is-on' : ''}`}>All</Link>
                    {STOCK_TOPICS.map((t) => (
                        <Link key={t.id} href={href(t.id)} className={`btn btn-ghost ${validTopic === t.id ? 'is-on' : ''}`}>{t.label}</Link>
                    ))}
                </nav>
            </Panel>

            {shown.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon"><Scale className="size-5" /></span>
                    <h3>Nothing matched</h3>
                    <p className="text-[13px]">Try a company name or a broader topic.</p>
                </div>
            ) : (
                <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {shown.map((e) => <EventCard key={e.id} e={e} />)}
                </ul>
            )}

            <p className="mt-4 text-[12px] text-faint">
                Kalshi doesn&apos;t accept UK customers and Polymarket is close-only from the UK. Relevance rules adapted from
                zandy700/Ultimate-Tracker (MIT). Not financial advice.
            </p>
        </>
    );
}
