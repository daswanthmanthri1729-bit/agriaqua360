# AgriAqua 360 — Level 1 Performance Audit (22 Nov 2026)

Scope: existing Level 1 only (40 screens, Android + Windows). No new features, no redesign.
Measurements: live Gemini API from this sandbox, live Supabase tests earlier today, code inspection.

## 1. Findings (ranked by user impact)

| # | Area | Finding | Evidence | Impact |
|---|---|---|---|---|
| 1 | **AI latency & reliability** | Primary model `gemini-3.5-flash` is mostly overloaded; each call waits for a 503/timeout, then falls back. Per-model timeout 45 s, no memory of failures | Live: 3.5-flash 503 / 40 s timeouts; 3.8/3.7/3.6 same; `3.1-flash-lite` 200 every time, 1.5–5 s, correct Telugu. Live app: AI 20–25 s | Every AI feature (chat, voice, photo, crop/fish scan) |
| 2 | **No streaming** | Chat shows nothing until the full answer is generated | Stream first-chunk ≈ 0.5 s when model available | Perceived wait = full generation time |
| 3 | **Voice round trips** | Recording → upload to Storage → function downloads → Gemini → function deletes file | 3 extra network hops per question | +1–3 s on rural networks, storage writes |
| 4 | **Rate limit / cost** | Key hit 429 under load; no output-token cap; failed calls retried on every request | Live 429 during test | Quota exhaustion, wasted calls |
| 5 | **Image size** | Photos sent at 1600 px / q0.7 (~300–500 KB each, up to 5) | `services/media.ts` | Slow uploads on 2G/3G, more AI input tokens |
| 6 | **Image re-downloads** | Private images use short-lived signed URLs; URL changes → image cache miss | `StorageImage` has no `cacheKey` | Same photo downloaded repeatedly |
| 7 | **Home screen load** | 6 queries on open; ponds query pulls up to 500 water readings just to find the latest per pond | `usePonds` limit(500) | Slow dashboard as data grows |
| 8 | **Reports** | 9 tables × up to 2000 rows downloaded and summed on the phone | `reports/api.ts` | Slow & data-heavy on large farms |
| 9 | **Weather API** | Every app open calls the Edge Function → 2 OpenWeather calls; no server cache | `weather/index.ts` | API quota, latency |
| 10 | **Offline** | No persisted cache: offline or on restart without signal, every screen shows errors | No query persistence / network detection | Unusable in poor coverage |
| 11 | **Startup** | Splash waits a fixed 1.8 s minimum; header logo PNG 236 KB (shown at 34 px), full logo 512 KB | `MIN_SPLASH_MS`, asset sizes | Slower cold start, larger APK |

Already good: Hermes, FlatList for long lists, parallel photo uploads, DB indexes, RLS, AI thinking=low, structured JSON output, weather client cache 15 min.
Not applicable: Level 1 has no sensors (no sensor code to optimise).

## 2. Proposed stages (each implemented and tested separately, after approval)

| Stage | Change | Expected result |
|---|---|---|
| **S1 AI routing** | Fast failover: short first-try timeout (~12 s), remember overloaded models for 2 min per server instance, fallback chain ending in `gemini-3.1-flash-lite`; cap output tokens; log latency per model | AI 20–25 s → typically 2–6 s; bounded worst case; fewer wasted calls |
| **S2 Streaming chat** | Edge Function streams Gemini (SSE); app shows the answer word-by-word (`expo/fetch` streaming); saved when complete; non-stream fallback | First words in ~1 s |
| **S3 Voice** | Send the recording inline to `transcribe` (no Storage upload/download/delete) | −3 network hops per voice question |
| **S4 Images** | AI photos 1280 px / q0.6 (~150–250 KB); `cacheKey` = storage path so photos load from disk cache | ~50% less upload; no repeat downloads |
| **S5 Weather cache** | Server-side cache table keyed by ~10 km grid, 30 min TTL | Most opens skip OpenWeather entirely |
| **S6 Offline & startup** | Persist query cache (last data readable offline), offline banner, clear "needs internet" on saves; splash until ready (no fixed 1.8 s); compress logo PNGs | Usable without signal; faster start; smaller APK |
| **S7 Database** | SQL view for latest reading per pond; SQL function for report totals (1 call instead of 9) | Faster Home, Aqua and Reports; less data |
| **S8 Verify & ship** | Before/after benchmarks (live AI latency, payload sizes, cold start), all tests + E2E, new APK + Windows zip | Measured proof |

Decisions needed: which stages; whether crop/fish **image diagnosis** may use the lite model when stronger models are overloaded (faster/always available, slightly less accurate) — chat and transcription use it either way.
Offline **writes** (queue and sync later) are not proposed: it needs conflict handling and is closer to a new feature; saves will clearly say "needs internet".
