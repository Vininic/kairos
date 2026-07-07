# Kairos

**A project & task board from the Chronos suite.**

React + TypeScript · local-first · optional cloud sync via the shared suite backend

In Greek thought, *chronos* is sequential time — *kairos* is the opportune moment. Where [Chronos](../chronos-audit) architects the week, Kairos moves the work: projects, tasks, deadlines, priorities, and a board that shows what matters now.

---

## The suite connection

Kairos is a sibling app, not a module. It shares with Chronos:

- **The account.** Both apps point at the same Supabase project — one email/password works across the suite, and the local "guest" mode works with no account at all.
- **The backend.** The board syncs as one row in the same `user_data` KV table Chronos already uses (RLS-scoped per user, zero new migrations).
- **The design language.** Same parchment surfaces, Fraunces + Inter type, card system, shadows and motion — but where Chronos is midnight blue + polished bronze, Kairos is viridian ink + **verdigris**: the patina time leaves on bronze. The hourglass gives way to the kite-diamond mark with Kairos' forelock — the moment you seize or miss.

## Features

- **Projects** with tone, description, progress, archive and cascade delete
- **Board** per project — Backlog / To do / In progress / Done, with native drag & drop, live drop indicators and per-column reordering
- **Tasks** with priority (spine-coded on the card, echoing Chronos' timeline blocks), deadline (overdue states), labels and descriptions
- **Local-first**: everything lives in `localStorage`; a cloud sign-in adds debounced push, pull-on-login and realtime cross-device convergence — remote changes re-hydrate the board in place, no reload
- **Light / dark** — "Parchment & Patina" and "Patina Atelier" themes, shared suite toggle

## Architecture

```
src/
├─ lib/board/    # domain core: types, pure service (move/reorder/migrate), store
├─ lib/sync/     # localStorage ⇄ Supabase user_data mirror (single domain)
├─ lib/supabase/ # shared-suite client (namespaced local session)
├─ lib/auth.tsx  # cloud account or local guest — same contract as Chronos
├─ components/board/  # TaskCard, BoardColumn (DnD), Task/Project dialogs
└─ pages/        # Login, Projects, Board
```

Design rule inherited from the sibling: **pure functions own the domain, the store is a thin wrapper, renderers are generic.** All board mutations live in `lib/board/service.ts` and are covered by the Vitest suite.

## Running locally

Requirements: **Node 20+**, **pnpm** via Corepack.

```bash
corepack pnpm install
corepack pnpm dev        # → http://localhost:8090
corepack pnpm test       # domain test suite
corepack pnpm typecheck  # tsc --noEmit
corepack pnpm build      # production build
```

Runs fully offline with no configuration. To enable the suite account, copy `.env.example` to `.env` and point it at the same Supabase project as Chronos (anon key + URL are client-safe; RLS does the enforcement).

---

*Local-first by design: your boards live in the browser. Cloud sync is opt-in and rides the suite's existing backend.*
