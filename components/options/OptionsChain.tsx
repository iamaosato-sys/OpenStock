import Link from 'next/link';
import Panel from '@/components/Panel';
import { getChain, type ChainSide } from '@/lib/options-chain';

const f = (n: number | null | undefined, d = 2) => (n == null ? '—' : n.toFixed(d));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);

function Cells({ s }: { s: ChainSide | null }) {
    return (
        <>
            <td className="is-num num">{f(s?.bid)}</td>
            <td className="is-num num">{f(s?.ask)}</td>
            <td className="is-num num">{pct(s?.iv)}</td>
            <td className="is-num num">{f(s?.greeks?.delta)}</td>
            <td className="is-num num text-faint">{f(s?.greeks?.theta, 3)}</td>
        </>
    );
}

// Server component: shows nothing at all when Alpaca keys aren't configured or there is no chain.
export default async function OptionsChain({ symbol, expiry }: { symbol: string; expiry?: string }) {
    const chain = await getChain(symbol, expiry);
    if (chain.status !== 'ok') return null;

    return (
        <Panel
            title="Options"
            sub={`Spot ${chain.spot.toFixed(2)} · IV and Greeks worked out from indicative mid prices (Alpaca, delayed). Theta per day.`}
        >
            <nav aria-label="Expiry" className="flex flex-wrap gap-1.5 p-3">
                {chain.expiries.slice(0, 8).map((e) => (
                    <Link
                        key={e}
                        href={`/stocks/${encodeURIComponent(chain.symbol)}?exp=${e}`}
                        scroll={false}
                        className={`btn btn-ghost ${e === chain.expiry ? 'is-on' : ''}`}
                    >
                        {new Date(`${e}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Link>
                ))}
            </nav>
            <div className="overflow-x-auto rounded-[14px]">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="is-num" colSpan={5}>Calls: bid · ask · IV · delta · theta</th>
                            <th className="is-num">Strike</th>
                            <th className="is-num" colSpan={5}>Puts: bid · ask · IV · delta · theta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chain.rows.map((r) => (
                            <tr key={r.strike} className={Math.abs(r.strike - chain.spot) / chain.spot < 0.005 ? 'font-semibold' : undefined}>
                                <Cells s={r.call} />
                                <td className="is-num num font-semibold text-foreground">{r.strike.toFixed(2)}</td>
                                <Cells s={r.put} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="px-3 pb-3 pt-2 text-[12px] text-faint">
                European Black-Scholes, 4% rate, no dividends; real US options are American. Indicative quotes aren&apos;t
                executable. Not financial advice.
            </p>
        </Panel>
    );
}
