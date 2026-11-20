// Which prediction-market questions matter for stocks. Editorial keyword rules, not a forecast.
// Adapted from zandy700/Ultimate-Tracker (web/space/panels/prediction-relevance.js), MIT,
// (c) 2026 Xingjian Zhang.

export type StockTopic = 'companies' | 'technology' | 'economy' | 'policy' | 'energy' | 'healthcare' | 'geopolitics';

export const STOCK_TOPICS: { id: StockTopic; label: string }[] = [
    { id: 'companies', label: 'Companies' },
    { id: 'technology', label: 'AI & chips' },
    { id: 'economy', label: 'Economy & Fed' },
    { id: 'policy', label: 'Policy & trade' },
    { id: 'energy', label: 'Energy' },
    { id: 'healthcare', label: 'Healthcare' },
    { id: 'geopolitics', label: 'Geopolitics' },
];

// Public Polymarket tag IDs (gamma-api /tags/slug), checked by the source project on 2026-11-12.
export const POLYMARKET_TAGS = [
    { id: '604', label: 'Stocks' }, { id: '1013', label: 'Earnings' }, { id: '107', label: 'Business' },
    { id: '100328', label: 'Economy' }, { id: '159', label: 'Fed' }, { id: '702', label: 'Inflation' },
    { id: '101758', label: 'Tariffs' }, { id: '439', label: 'AI' }, { id: '1401', label: 'Technology' },
    { id: '404', label: 'Energy' }, { id: '102599', label: 'IPO' },
];

// Kalshi's general event list is mostly sports, so read only these economic/company series.
export const KALSHI_SERIES = [
    'KXFEDDECISION', 'KXCPI', 'KXCPIYOY', 'KXGDP', 'KXU3', 'KXPAYROLLS', 'KXJOBLESSCLAIMS',
    'KXMORTGAGERATE', 'KXIPOANTHROPIC', 'KXIPOOPENAI', 'KXIPOSPACEX',
];

const COMPANY = /\b(?:nvidia|jensen huang|tesla|elon musk|apple|tim cook|microsoft|satya nadella|amazon|andy jassy|alphabet|google|sundar pichai|meta|zuckerberg|amd|lisa su|intel|broadcom|tsmc|asml|openai|anthropic|spacex|palantir|oracle|netflix|disney|nike|boeing|jpmorgan|jamie dimon|goldman sachs|coinbase|robinhood|uber|berkshire|walmart|exxon|chevron)\b/i;
const FINANCIAL = /\b(?:earnings|revenue|profit|stock price|share price|market cap|ipo|acquisition|acquire|merger|bankrupt|buyout|dividend|antitrust|ceo|chief executive|resign|resignation|removal|fired|layoffs|deliveries)\b/i;
const SPORT = /\b(?:basketball|nba|wnba|nfl|nhl|mlb|ncaa|fifa|uefa|tennis|soccer|football|baseball|cricket|golf|hockey|olympics?|super bowl|world cup|stanley cup|champions league|grand slam|esports?|dota|valorant|league of legends|counter.strike|touchdowns?|rebounds?|playoffs?|championship|tournament)\b|\bvs\.?\s/i;
const PERSONAL = /\b(?:divorce|married|marriage|wedding|dating|girlfriend|boyfriend|romance|album|grammys?|oscars?|box office|movie|reality show|celebrity|eurovision|miss universe|mascot)\b/i;
const TRIVIA = /\b(?:tweet|tweets|post the word|say the word|mention the word|wear|eat|smoke|public appearance|be photographed)\b/i;
const CRYPTO_PROP = /\b(?:bitcoin|ethereum|solana|btc|eth|xrp|dogecoin)\b.*\b(?:up or down|price|above|below|reach|hit|all.time high)\b/i;

const PATTERNS: Record<StockTopic, RegExp> = {
    companies: FINANCIAL,
    technology: /\b(?:artificial intelligence|ai model|ai bubble|semiconductor|chips?|data cent(?:er|re)|nvidia|jensen huang|openai|anthropic|gpt[- ]?\d|deepseek|agi|tsmc|asml|cuda)\b/i,
    economy: /\b(?:federal reserve|fed|fomc|interest rates?|rate cuts?|rate hikes?|inflation|cpi|pce|gdp|recession|unemployment|payrolls?|jobless claims|treasury|bond yields?|s&p|nasdaq|dow jones|stock market|housing|mortgage|bank failure|banking crisis|debt ceiling)\b/i,
    policy: /\b(?:tariffs?|sanctions?|export (?:ban|control|restriction)|antitrust|sec approval|corporate tax|regulat(?:ion|or|ory)|government shutdown|stimulus|trade (?:deal|war)|presidential|senate|congress|midterms?|house majority|white house|trump)\b/i,
    energy: /\b(?:energy|crude|brent|wti|oil|opec|natural gas|lng|uranium|nuclear (?:power|energy|reactor)|power grid|electricity|copper|gold price|silver price|rare earth)\b/i,
    healthcare: /\b(?:fda|drug approval|clinical trial|medicare|medicaid|drug pricing|pfizer|eli lilly|novo nordisk|moderna|astrazeneca|vaccine approval)\b/i,
    geopolitics: /\b(?:war|ceasefire|invasion|blockade|strait of hormuz|nato|military strike|nuclear (?:weapon|test))\b/i,
};

/** Topics a question touches, or [] if it isn't stock-relevant (sport, celebrity, crypto price bets...). */
export function stockTopicsFor(title: string, question = '', tags: string[] = []): StockTopic[] {
    const text = [title, question].filter(Boolean).join(' ');
    const tagText = tags.join(' ');
    const specific = question || title;
    const corporate = COMPANY.test(specific) && FINANCIAL.test(specific);
    if ((SPORT.test(text) || /\b(?:sports|games|esports)\b/i.test(tagText)) && !corporate) return [];
    if ((PERSONAL.test(text) || TRIVIA.test(text)) && !corporate) return [];
    if (CRYPTO_PROP.test(text) && !/\b(?:etf|stock|shares|coinbase|microstrategy|strategy inc)\b/i.test(text)) return [];
    if (/\b(?:weather|temperature|rainfall|snowfall)\b/i.test(`${tagText} ${text}`) && !PATTERNS.energy.test(text)) return [];

    const ids = STOCK_TOPICS.filter((t) => PATTERNS[t.id].test(text)).map((t) => t.id);
    if (COMPANY.test(text) && !ids.includes('companies')) ids.unshift('companies');
    if (!ids.length && /\b(?:stocks|equities|earnings|business|finance|economy|fed|technology|ai|energy|trade|tariffs|ipo)\b/i.test(tagText)) {
        ids.push(/econom|fed/i.test(tagText) ? 'economy'
            : /tech|\bai\b/i.test(tagText) ? 'technology'
                : /energy/i.test(tagText) ? 'energy'
                    : /trade|tariff/i.test(tagText) ? 'policy' : 'companies');
    }
    return ids;
}
