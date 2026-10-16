# Overseed

A global platform connecting brands with influencers and content creators for cross-border marketing collaborations.

## Features

- **Dual User System** — Separate dashboards and workflows for Brands and Creators
- **Campaign Management** — Create, browse, apply to, and manage collaboration campaigns
- **In-app Messaging** — Real-time conversations between brands and creators (Pusher)
- **AI Assistant** — AI-powered chat for marketing strategy and content advice
- **Payments** — Stripe-integrated payment flow with platform fee handling
- **Multi-language Support** — English and Chinese UI with AI-powered content translation
- **Saved Searches & Alerts** — Get notified when new opportunities match your criteria
- **Social Account Verification** — Link and verify social media profiles
- **OAuth Authentication** — Google and Facebook sign-in
- **Responsive Design** — Mobile-friendly interface with dark/light theming

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbopack)
- **Language**: TypeScript, React 18
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (Google, Facebook OAuth)
- **Payments**: Stripe
- **Real-time**: Pusher
- **AI**: OpenAI + Anthropic SDK
- **Storage**: AWS S3
- **Email**: Nodemailer (SMTP)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm

### Installation

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd Overseed
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in the required values — see `.env.example` for all available options.

3. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
Overseed/
├── app/
│   ├── api/                  # API routes (~50 endpoints)
│   ├── admin/                # Admin dashboard
│   ├── ai-assistant/         # AI chat interface
│   ├── alerts/               # Saved searches & alerts
│   ├── auth/                 # Sign in / sign up
│   ├── browse/               # Campaign browsing
│   ├── campaign/[id]/        # Campaign detail & apply
│   ├── dashboard/
│   │   ├── brand/            # Brand dashboard (campaigns, profile)
│   │   ├── influencer/       # Creator dashboard (accounts, applications)
│   │   ├── messages/         # Messaging inbox
│   │   └── upgrade/          # Subscription upgrade
│   ├── pricing/              # Pricing pages
│   ├── contact/              # Contact page
│   ├── faq/                  # FAQ
│   ├── terms/                # Terms of service
│   ├── privacy/              # Privacy policy
│   └── page.tsx              # Home page
├── components/               # React components (~50 files)
├── lib/                      # Utilities & services
│   ├── auth.ts               # NextAuth config
│   ├── prisma.ts             # Prisma client
│   ├── stripe.ts             # Stripe integration
│   ├── openai.ts             # AI provider integration
│   ├── pusher.ts             # Pusher server
│   ├── pusher-client.ts      # Pusher client
│   ├── db/                   # Database helpers & types
│   └── i18n/                 # UI translations (TypeScript)
├── prisma/
│   └── schema.prisma         # Database schema
├── docs/                     # Database setup & i18n docs
└── public/                   # Static assets
```

## Key Routes

| Route | Description |
|---|---|
| `/` | Home page |
| `/browse` | Browse campaigns with filters |
| `/campaign/[id]` | Campaign detail |
| `/auth/signin` | Sign in |
| `/auth/signup` | Sign up |
| `/dashboard/brand` | Brand dashboard |
| `/dashboard/influencer` | Creator dashboard |
| `/dashboard/messages` | Messaging inbox |
| `/ai-assistant` | AI assistant |
| `/pricing/brand` | Brand pricing |
| `/admin` | Admin panel |

## Database

Full setup guide: [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md)

```bash
npx prisma studio              # Browse data in browser
npx prisma migrate dev          # Apply schema changes
npx prisma db push --force-reset  # Reset database (destructive)
npx prisma generate             # Regenerate client
```

### Sync production data to local

Pull a snapshot of the production Neon database into your local PostgreSQL. This gives you real users, campaigns, search history, and credits locally without affecting production.

```bash
./scripts/sync-from-prod.sh
```

Requires `pg_dump` and `psql` (included with Postgres.app or any PostgreSQL installation). Local changes stay local — production is never affected.

## Internationalization

The app supports English and Chinese at two levels:

1. **UI translations** — Static text is managed in `lib/i18n/translations.ts` as a TypeScript object. The `LanguageContext` provider handles locale switching.

2. **Content translations** — User-generated content uses a Translation Table pattern in the database. See [`docs/DATABASE_MULTILINGUAL.md`](docs/DATABASE_MULTILINGUAL.md).

## OAuth Setup

### Google
1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/)
2. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Copy Client ID and Secret to `.env`

### Facebook
1. Create an app at [Facebook Developers](https://developers.facebook.com/)
2. Add redirect URI: `http://localhost:3000/api/auth/callback/facebook`
3. Copy App ID and Secret to `.env`

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Database Hosting
- **Neon** — Serverless PostgreSQL (current setup)
- **Supabase** — Free PostgreSQL hosting
- **Vercel Postgres** — Integrated with Vercel

## License

Copyright 2026 Overseed. All rights reserved.
