# CM-Ed

An AI-powered chatbot built for CME Group that teaches users about CME Group, its products, services, and the broader financial markets.

## Features

- **Conversational AI** — Ask questions about CME Group, futures, options, derivatives, risk management, and market structure. Powered by models via the Vercel AI Gateway (GPT-4.1 Mini, Gemini 2.5 Flash Lite).
- **Web Search** — Real-time web search for current market data, news, and CME Group announcements.
- **Macro Data Charts** — Interactive charts powered by FRED (Federal Reserve Economic Data) covering Fed Funds Rate, CPI, unemployment, Treasury yields, WTI crude oil, and the S&P 500.
- **Artifacts** — Create and edit documents, code snippets, spreadsheets, images, and charts in a side panel alongside the conversation.
- **Chat History** — Persistent chat storage with public/private visibility controls.
- **Authentication** — User accounts via NextAuth.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) with AI Gateway
- **Database**: [Convex](https://convex.dev/)
- **Auth**: [NextAuth v5](https://authjs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://radix-ui.com/), [HeroUI](https://heroui.com/)
- **File Storage**: [Vercel Blob](https://vercel.com/docs/vercel-blob)
- **Deployment**: [Vercel](https://vercel.com/)

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (v10.30.3)

### Setup

1. Clone the repo:

   ```bash
   git clone https://github.com/ogyeet10/CM-Ed.git
   cd CM-Ed
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy the example env file and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   Required environment variables:
   - `AUTH_SECRET` — NextAuth secret ([generate one](https://generate-secret.vercel.app/32))
   - `AI_GATEWAY_API_KEY` — Vercel AI Gateway key
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob token
   - `REDIS_URL` — Redis connection string
   - `EXA_API_KEY` — Exa web search API key
   - `FRED_API_KEY` — FRED API key for macro charts

4. Start the dev server:

   ```bash
   pnpm dev
   ```

   This runs Next.js on port 3002 and the Convex dev server concurrently.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js + Convex dev servers |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Lint with Ultracite |
| `pnpm format` | Auto-fix lint issues |
| `pnpm test` | Run Playwright tests |

## License

Licensed under the [Apache License 2.0](./LICENSE). Copyright 2026 Aidan Leuenberger.
