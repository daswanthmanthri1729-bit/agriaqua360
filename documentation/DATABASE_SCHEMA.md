# Database Schema

Migrations: `supabase/migrations/20261122000001_initial_schema.sql`, `20261122000002_reminders_and_prevention.sql` (adds `crop_records.notification_id`, `treatment_type = 'prevention'`)

| Group | Tables |
|---|---|
| Users | `profiles` (1:1 with auth.users; created by trigger from validated sign-up metadata) |
| Farms | `farms`, `farm_members` |
| Agriculture | `crops`, `crop_records`, `crop_scans`, `disease_reports`, `treatment_records` |
| Aquaculture | `ponds`, `water_quality_records`, `fish_records`, `fish_health_reports` |
| Livestock | `livestock` (cow/buffalo/sheep/goat/pig), `animal_health_records`, `vaccination_records` |
| AI | `ai_conversations`, `ai_messages` |
| Shared | `uploaded_media`, `notifications`, `saved_records`, `activity_logs` |

Every table has a UUID (or identity) PK, `owner_id → profiles`, timestamps, CHECK constraints on enums/ranges, and indexes on owner + parent FK.

## Security
- RLS enabled on all 21 tables. Rows are visible only to `owner_id = auth.uid()`; farms and crops are also readable by `farm_members` via `can_access_farm()` (security definer, avoids policy recursion).
- Insert/update policies verify the parent row (farm, crop, pond, animal, conversation) belongs to the caller, so nobody can attach records to someone else's data.
- `activity_logs` is append-only for clients.
- Storage: private buckets `avatars` (5 MB, images) and `media` (10 MB, images/audio); object path must start with the caller's uid.
- Water-quality values are farmer-entered readings only; nothing is estimated from photos.
