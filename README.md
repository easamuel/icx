# ICX Studios Platform — Self-Hosted Enterprise Monorepo

**Product Owner:** LearnArk Technology Limited  
**Architecture:** Self-Hosted PostgreSQL 16+, Redis 7+, Node.js (Express + TypeScript + `sharp` + TUS v1.0.0), Next.js 15 App Router (React 19 + Tailwind CSS), and Reserved Expo React Native Mobile Target.  
**Zero Supabase Dependencies:** All authentication, RBAC, row-level concurrency locks, private file storage, and burned-in image watermarking run natively on self-hosted infrastructure.

---

## 1. Monorepo Topology

```text
icx-monorepo/
├── apps/
│   ├── web/                     # Next.js App Router (Customer, Photographer, Editor & Admin Interfaces)
│   ├── server/                  # Self-Hosted Node.js API Engine (TUS, Sharp Watermarker, Paystack Webhooks)
│   └── mobile/                  # Reserved React Native / Expo Workspace consuming shared packages
├── packages/
│   ├── shared-types/            # Canonical Zod schemas, TypeScript interfaces, state transition matrices
│   ├── database/                # Native PostgreSQL 16+ migrations, connection pooler, ACID transactions & seeder
│   └── ui-core/                 # ICX Studios Design System tokens (#2A3439 Deep Slate & #E8DEC8 Warm Sand)
├── docker-compose.yml           # Self-hosted PostgreSQL 16 & Redis 7 containers
└── .env.example                 # Production & local environment template
```

---

## 2. Quick Start & Production Deployment

### Step 1: Configure Environment Variables
```bash
cp .env.example .env
```

### Step 2: Launch Self-Hosted PostgreSQL 16 & Redis 7
```bash
docker compose up -d
```

### Step 3: Install Dependencies & Run Native SQL Migrations + Seeder
```bash
npm install
npm run db:migrate
npm run db:seed
```

### Step 4: Run Phase 5 Security & Content Protection Verification
```bash
npm run verify:security
```

### Step 5: Start the Full-Stack Platform
```bash
npm run dev
```
* **Web Application:** `http://localhost:3000`
* **Self-Hosted API Engine:** `http://localhost:4000/api/v1/health`

---

## 3. Seeded Role Accounts (Default Password: `IcxStudios#2026!`)

| Role | Email | Portal Route |
| :--- | :--- | :--- |
| **Admin** | `admin@icxstudios.com` | `/admin` |
| **Editor** | `editor@icxstudios.com` | `/workspace/editor` |
| **Photographer** | `photographer@icxstudios.com` | `/portal/photographer` |
| **Customer** | `customer@icxstudios.com` | `/dashboard` |

