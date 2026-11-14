# IDO Finance Supervisor (demo)

A multi-tenant finance supervisor for the Investment & Development Office (IDO), Ras Al Khaimah. It follows each portfolio company's month-end close from the data it sends in to numbers that have been checked, and gives IDO one place to supervise all of them.

All data is mock and generated deterministically. Company names come from ido.ae/portfolio; people, balances, invoices and findings are fictional.

## Scope

### Users and access

| Role | Sign-in | Sees | Theme |
| --- | --- | --- | --- |
| **IDO Group Finance** | Real username and password from `.env`, checked by the local server | All 15 portfolio companies, plus the IDO Portfolio Assistant (chatbot) | IDO logo and colours |
| **CFO, Julphar** | Demo account (details fill in automatically) | Julphar only | Julphar logo and colours |
| **CFO, RAK Ports** | Demo account (details fill in automatically) | RAK Ports only | RAK Ports logo and colours |

- A CFO can never open another company or any IDO page; they are sent back to their own home.
- IDO can open any company's screens read-only, always in IDO colours.
- Companies with a CFO login are set in `CFO_LOGINS` (`src/data/tenants.ts`).

### The finance journey

Every company moves through five stages each month. Each stage has its own screen and its own status (Done, In progress, Blocked, Not started):

1. **Ingest**: data feeds arrive (GL journal extract, bank statements, AR and AP sub-ledgers, payroll file).
2. **Ledger**: journal lines post to the general ledger.
3. **Trial balance**: debits equal credits and the suspense account is clear.
4. **Statements**: P&L and balance sheet are built from the trial balance.
5. **Reconciliation**: accounts are reconciled, and reported revenue is verified against independent sources (see Revenue assurance below).

### Screens

| Screen | IDO | CFO | What it does |
| --- | :---: | :---: | --- |
| Home | ✓ | ✓ | Immediate actions ranked by severity (Critical, High, Medium) and AED at stake, each with owner, due date and a link to fix it; close progress; headline numbers |
| Finance journey | ✓ | ✓ | IDO: company-by-stage board. CFO: the five stages as steps, data feeds and close history |
| Data explorer | ✓ | ✓ | Data feeds (with simulated file upload), journals, general ledger and trial balance |
| Financial statements | ✓ | ✓ | P&L and balance sheet against budget and prior month, with drill-down from any line to ledger accounts and journal lines |
| Revenue assurance | ✓ | ✓ | "Is that number actually true?" checks with evidence |
| Close checklist | | ✓ | Month-end tasks, aging and recent activity |
| Reconciliations | ✓ | ✓ | Match rates, heatmap, account reconciliations, auto-match, submit and sign-off |
| Exceptions | ✓ | ✓ | Exception queue with filters, bulk actions and an audit trail |
| Ask IDO Assistant | ✓ | | Chatbot that answers in plain English with charts, tables and PDF/CSV reports |

### Data covered

- **Companies**: the 15 named on ido.ae/portfolio, across six sectors.
- **Period**: May to October 2026; October is the month being closed, as of 12 Nov 2026 (business day 9 against an 8-day deadline).
- **Accounting**: a 31-account IFRS-style chart of accounts, monthly ledger balances, journal lines, trial balance, P&L, balance sheet and budget. Every trial balance nets to zero, balance sheets balance, and journal lines add up exactly to each account's movement.
- **Reconciliations**: bank, intercompany, AR and AP sub-ledgers, GL to sub-ledger, fixed assets and payroll, with exceptions and aging.
- **Revenue assurance** (October): contracts, invoices, credit notes and bank receipts for every company.

### Out of scope (demo limits)

- **No live connections.** All data is generated in the browser; nothing is read from ERPs, banks or billing systems. Uploads are simulated (only the file name and size are used).
- **Not production security.** The IDO password protects sign-in only; the mock data itself ships to the browser. CFO accounts accept any password.
- **Changes don't persist.** Resolved exceptions, sign-offs, uploads and "Done" marks reset when the page reloads. Reminders are not actually sent.
- **Consolidation is a simple sum.** There are no intercompany eliminations or currency translation.
- **Revenue assurance covers October only.**
- **Two CFO logins.** The other 13 companies are visible to IDO but have no company login.
- **Real logos.** IDO, Julphar and RAK Ports logos are taken from their public websites; confirm they may be used before sharing the demo outside IDO.

### What a pilot would need

- Connectors to each company's ERP, bank feeds and billing system, replacing the generators in `src/data/`.
- A backend database and API so data, actions and sign-offs persist, with data served per user rather than shipped to the browser.
- Sign-in through IDO's identity provider, with roles for each company.
- Notifications (email or Teams) for reminders and overdue actions.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5180 and pick a role on the sign-on page.

- **IDO Group Finance** needs the username and password in `.env` (`IDO_USERNAME`, `IDO_PASSWORD`). The server checks them (`server/core.ts`); they never appear in the browser code. Five wrong attempts lock sign-in for a minute, and sessions end after 12 hours or when the password changes.
- **CFO roles** are demo accounts: selecting one fills in the details.

### Settings in `.env`

Start from the template if you don't have a `.env` yet:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `IDO_USERNAME`, `IDO_PASSWORD` | IDO Group Finance sign-in |
| `OPENROUTER_API_KEY` | Enables the live LLM for the assistant (optional) |
| `OPENROUTER_MODEL` | Any OpenRouter model id (default `anthropic/claude-sonnet-4.5`) |
| `AUTH_SECRET` | Optional fixed key for signing IDO sessions; if unset it is derived from the IDO credentials |

Restart `npm run dev` after changing `.env`. Never commit `.env`; it is in `.gitignore`.

## Deploy to Vercel

The pages are static, and the `/api` routes (sign-in and the assistant) run as Vercel serverless functions in `api/`. They use the same code as the local server (`server/core.ts`). `vercel.json` sets the build, gives the assistant up to 60 seconds per answer, and sends page refreshes such as `/ido/journey` to the app.

1. Import the GitHub repository in Vercel. The framework is detected as Vite; no build settings need changing.
2. In the project's **Settings → Environment Variables**, add the same values as your `.env` for Production (and Preview if you use it):
   - `IDO_USERNAME`, `IDO_PASSWORD` (required for IDO sign-in)
   - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (optional, for the live assistant)
   - `AUTH_SECRET` (optional)
3. Redeploy: environment variables only apply to deployments made after they are added.
4. Check `https://<your-app>.vercel.app/api/health`: it should return `{"live":true,...}` when the OpenRouter key is set.

Without `IDO_USERNAME` and `IDO_PASSWORD` on Vercel, IDO sign-in shows "Sign-in is not configured". CFO demo roles work either way.

## How the assistant answers

The assistant is only on **Ask IDO Assistant** (IDO role).

1. **Cached FAQ** (`src/data/faqs.ts`): about 16 common questions answered instantly from the same data as the screens, tagged "Cached answer".
2. **Live LLM**: other questions go to `/api/chat` with a ~37 KB JSON snapshot of the portfolio. The key stays on the server, the snapshot is marked for prompt caching, and answers are cached on disk in `server/.cache/` so repeat questions are instant.
3. **Offline engine** (`src/lib/chatEngine.ts`): used when no key is set or the call fails.

Every answer can be copied or downloaded as a branded **PDF** (text, chart, table) or **CSV**; the whole conversation exports as one PDF. New LLM questions take about 15 to 30 seconds.

## Revenue assurance: "Is that number actually true?"

For each company the agent (`src/lib/assurance.ts`) tests reported October revenue against three independent sources:

| Check | Question | Findings it raises |
| --- | --- | --- |
| General ledger | Do the revenue entries in the accounts match the report? | Report differs from ledger, unsupported journal, credit note not posted |
| Invoices and contracts | Was everything billed at the right amount, with no duplicates or missing invoices? | Price mismatch, duplicate invoice, missing invoice |
| Bank statements | Did the cash actually arrive for what was invoiced? | Unpaid invoice, short payment, unidentified cash |

Findings also appear in the exception queue and as actions on Home. Ledger revenue always equals the invoices booked plus any unsupported journals, so every number ties.

## Demo script (about 10 minutes)

**IDO Group Finance**
1. **Home**: 31 actions ranked by severity. Filter to Critical, open Julphar's "Reported revenue is not supported by the ledger".
2. **Revenue assurance**: re-run the agent for Julphar and click a finding to see its evidence (invoice, contract, bank receipt).
3. **Finance journey**: click Julphar's blocked trial balance cell, then 1999 Suspense in the trial balance to open its ledger.
4. **Financial statements**: click Revenue to drill into ledger accounts, companies and journal lines.
5. **Data explorer**: try **Upload file** on the Data feeds tab.
6. **Ask IDO Assistant**: "Give me a portfolio summary", then "Why is Julphar's verified revenue so low compared with RAK Gas?". Download the PDF report.

**CFO (sign out, pick CFO, Julphar)**
7. The app switches to Julphar's logo and colours. Home shows only Julphar's actions; walk through its journey, statements and assurance.
8. Try `/t/rak-gas` or `/ido` in the address bar: the CFO is sent back to Julphar's home.

## Structure

| Path | Purpose |
| --- | --- |
| `src/data/tenants.ts` | 15 companies with reconciliation and finance profiles; `CFO_LOGINS` |
| `src/data/finance.ts` | Chart of accounts, monthly ledger balances, journals (on demand), data feeds |
| `src/data/generate.ts` | Reconciliations and exceptions (May to Oct 2026) |
| `src/data/faqs.ts` | Cached FAQ answers |
| `src/lib/finance.ts` | P&L, balance sheet, budget, trial balance, pipeline status |
| `src/lib/assurance.ts` | Contracts, invoices, bank receipts and the three revenue checks |
| `src/lib/actions.ts` | Immediate actions for Home (all companies or one) |
| `src/lib/brand.ts` | Company themes (logo, colours, tab title) |
| `src/lib/paths.ts` | Screen links for IDO versus a CFO |
| `src/lib/assistant.ts` | FAQ → LLM → offline routing, LLM data context |
| `src/lib/report.ts` | PDF and CSV export |
| `server/core.ts` | Sign-in check and OpenRouter proxy, shared by the dev server and Vercel (secrets stay server-side) |
| `server/devApi.ts` | Serves the `/api` routes from `npm run dev` |
| `api/*.ts` | Vercel serverless functions: `login`, `verify`, `health`, `chat` |
| `vercel.json` | Vercel build, function timeout and page rewrites |
| `src/pages/ido/*` | IDO screens (also reused, limited to one company, for CFOs) |
| `src/pages/tenant/*` | CFO home, company journey, close checklist, reconciliations, exceptions |
| `public/brands/` | Julphar and RAK Ports logos |
