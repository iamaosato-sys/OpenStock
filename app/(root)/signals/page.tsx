import Link from 'next/link';
import { Activity, Lock, ArrowDownRight, ArrowUpRight, LogOut, Minus } from 'lucide-react';
import { getSignals, type SignalRow } from '@/lib/actions/signal.actions';
import Panel from '@/components/Panel';

export const dynamic = 'force-dynamic';

const SideBadge = ({ side }: { side: SignalRow['side'] }) => {
    if (side === 'long') return <span className="pill is-up"><ArrowUpRight /> Long</span>;
    if (side === 'short') return <span className="pill is-down"><ArrowDownRight /> Short</span>;
    if (side === 'exit') return <span className="pill is-brand"><LogOut /> Exit</span>;
    return <span className="pill"><Minus /> Flat</span>;
};

const fmt = (n: number | null, digits = 2) => (n == null ? '—' : n.toFixed(digits));

const when = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

function SignalTable({ rows }: { rows: SignalRow[] }) {
    return (
        <div className="overflow-x-auto rounded-[14px]">
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Bot</th>
                        <th>Signal</th>
                        <th className="is-num">Strength</th>
                        <th className="is-num">Price</th>
                        <th className="is-num">Stop</th>
                        <th>Note</th>
                        <th className="is-num">Time (UK)</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((s) => (
                        <tr key={s.id}>
                            <td>
                                <Link href={`/stocks/${encodeURIComponent(s.symbol)}`} className="mono font-semibold text-foreground hover:text-brand-ink">
                                    {s.symbol}
                                </Link>
                                {s.pairSymbol && (
                                    <>
                                        <span className="text-faint"> / </span>
                                        <Link href={`/stocks/${encodeURIComponent(s.pairSymbol)}`} className="mono font-semibold text-foreground hover:text-brand-ink">
                                            {s.pairSymbol}
                                        </Link>
                                    </>
                                )}
                            </td>
                            <td className="mono text-[12px] text-faint">{s.bot}</td>
                            <td><SideBadge side={s.side} /></td>
                            <td className="is-num num">{fmt(s.strength)}</td>
                            <td className="is-num num">{fmt(s.price)}</td>
                            <td className="is-num num">{fmt(s.stop)}</td>
                            <td className="max-w-[260px] truncate text-[13px] text-muted-foreground" title={s.note ?? ''}>{s.note ?? ''}</td>
                            <td className="is-num num text-[12px] text-faint">{when(s.createdAt)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default async function SignalsPage() {
    const result = await getSignals();

    return (
        <>
            <header className="page-head">
                <div>
                    <h1 className="page-title">Signals</h1>
                    <p className="page-sub">Output from momentum_bot and pairs_bot. Read-only: nothing here places trades.</p>
                </div>
            </header>

            {result.status === 'forbidden' && (
                <div className="empty-state">
                    <span className="empty-icon"><Lock className="size-5" /></span>
                    <h3>Signals are private</h3>
                    <p className="max-w-sm">This account isn&apos;t on the signals allowlist (SIGNALS_ALLOWED_EMAILS).</p>
                </div>
            )}

            {result.status === 'error' && (
                <div className="empty-state">
                    <span className="empty-icon"><Activity className="size-5" /></span>
                    <h3>Couldn&apos;t load signals</h3>
                    <p className="max-w-sm">{result.message}</p>
                </div>
            )}

            {result.status === 'ok' && result.history.length === 0 && (
                <div className="empty-state">
                    <span className="empty-icon"><Activity className="size-5" /></span>
                    <h3>No signals yet</h3>
                    <p className="max-w-sm">Run a bot with signals_writer.py enabled and its signals appear here.</p>
                </div>
            )}

            {result.status === 'ok' && result.history.length > 0 && (
                <div className="flex flex-col gap-3">
                    <Panel title="Current view" sub="Newest signal for each bot and symbol">
                        <SignalTable rows={result.latest} />
                    </Panel>
                    <Panel title="History" sub={`Last ${result.history.length} signals`}>
                        <SignalTable rows={result.history} />
                    </Panel>
                </div>
            )}
        </>
    );
}
