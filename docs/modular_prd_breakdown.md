# 🧩 Modular PRD Breakdown – Audafact Demo & Gating Funnel

This document defines 10 lightweight and modular PRDs derived from the original unified PRD. Each PRD focuses on a coherent subset of the feature funnel and is structured to enable **parallel implementation** where possible, while clearly marking **dependencies** where necessary.

---

## ✅ PRD 1 – Demo Mode Foundation & Track Playback

**Scope:**
- Anonymous access via `/studio`
- Random track selection
- Demo autoplay config
- Cue/loop triggering (preset-only)
- Waveform seek only

**Dependencies:** None

**Parallelizable:** Yes

---

## ✅ PRD 2 – Feature Gating Architecture

**Scope:**
- `useUserTier` hook (guest/free/pro)
- Central access control logic (`AccessService`)
- `FeatureGate` component (modal/tooltip/disabled/hidden types)

**Dependencies:** PRD 1 (for user context integration)

**Parallelizable:** Yes

---

## ✅ PRD 3 – Signup Flow & Modal Triggers

**Scope:**
- Signup modal UI with contextual CTA
- Modal configuration per trigger (upload, save, etc.)
- Post-signup action resumption

**Dependencies:** PRD 2 (gate types), PRD 1 (entry point)

**Parallelizable:** Yes

---

## ✅ PRD 4 – Library Panel & Gated Actions

**Scope:**
- Right-hand curated track panel
- Always-on preview button
- "Add to Studio" gated behind signup
- Randomized track switching via UI

**Dependencies:** PRD 1 (track loading logic)

**Parallelizable:** Yes

---

## ✅ PRD 5 – Upload / Save / Record / Download Gate

**Scope:**
- Upload button (modal gate)
- Save session button (disabled/tooltip)
- Record performance (Free: 1 recording, Pro: unlimited)
- Download (Pro-only, hidden)

**Dependencies:** PRD 2 (gating hooks), PRD 3 (signup modal)

**Parallelizable:** Yes

---

## ✅ PRD 6 – Analytics & Funnel Tracking

**Scope:**
- Analytics schema and event emitter
- Funnel stage tracking (demo → signup → pro)
- Local caching and offline sync

**Dependencies:** PRD 1–5 (must emit events)

**Parallelizable:** Yes

---

## ✅ PRD 7 – A/B Testing & Feature Flags

**Scope:**
- A/B test configuration and rollout logic
- Variant distribution by hash
- Feature flag system with tier targeting

**Dependencies:** PRD 2 (access gates), PRD 3 (copy testing), PRD 6 (analytics)

**Parallelizable:** Mostly

---

## ✅ PRD 8 – Visual Gating Cues & Responsive UI

**Scope:**
- Locked UI styles (opacity, lock icons)
- Tooltip styling
- Mobile behavior overlays
- Breakpoint-based behavior hooks

**Dependencies:** PRD 2 (gating), PRD 4/5 (UI integration)

**Parallelizable:** Yes

---

## ✅ PRD 9 – Post-Signup Experience Continuity

**Scope:**
- Post-signup redirect and state resumption
- LocalStorage-based intent caching
- UI updates for tier change

**Dependencies:** PRD 1, 2, 3, 5 (gate trigger → signup → resume)

**Parallelizable:** No (requires coordination)

---

## ✅ PRD 10 – Performance, Monitoring & Error Reporting

**Scope:**
- Performance metrics (load time, gate latency, etc.)
- Global error tracking with context
- Analytics hooks and retry storage

**Dependencies:** PRD 6 (analytics integration), PRD 1 (session start)

**Parallelizable:** Yes

---

## 📌 Summary Table

| PRD | Title                                   | Parallelizable | Dependencies       |
|-----|-----------------------------------------|----------------|--------------------|
| 1   | Demo Mode Foundation                    | ✅             | None               |
| 2   | Feature Gating Architecture             | ✅             | PRD 1              |
| 3   | Signup Flow & Modal Triggers            | ✅             | PRDs 1, 2          |
| 4   | Library Panel & Gated Actions           | ✅             | PRD 1              |
| 5   | Upload / Save / Record / Download Gate | ✅             | PRDs 2, 3          |
| 6   | Analytics & Funnel Tracking             | ✅             | PRDs 1–5           |
| 7   | A/B Testing & Feature Flags             | ⚠️ Partial     | PRDs 2, 3, 6       |
| 8   | Visual Gating Cues & Responsive UI      | ✅             | PRDs 2, 4, 5       |
| 9   | Post-Signup Experience Continuity       | ❌             | PRDs 1, 2, 3, 5    |
| 10  | Performance & Error Monitoring          | ✅             | PRDs 1, 6          |

---

Let me know if you'd like:
- Each of these exported as its own .md file
- GitHub Issues or Notion cards based on this
- Ticket templates generated from each PRD

