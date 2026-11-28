# TURNPART-QR backend

Connected project: **mapel_storeroom**, ref `slgcoiufhestfbrrcbuz`.

The only new database object is `public.turnpart_handover_records` and its own index/policy. Existing `store_*` tables, functions, policies and authentication settings are unchanged. The existing project and its usage limits are shared; the applications' records are separate.

## Access and data

The approved TURNPART-QR audience is anyone with the link/QR. Shared handover marks are readable by those visitors. The table contains request IDs, mould identifiers, source sheet, partial/full type, part keys and recording time. It contains no people names, signatures or PDFs.

RLS is enabled. `anon` and `authenticated` can select this new table, but cannot insert, update or delete it directly. Only the dedicated `turnpart-handover` Edge Function writes, with the service-role credential supplied by Supabase's server environment. JWT verification remains enabled. The browser's public anon JWT invokes that function; it grants no service-role access.

Each submission is checked against the current `Sheet5` or `JobDispatched` feed, using the same parsing and stable part-key code as the client. Unknown moulds, forged/changed parts, duplicate selections and request-ID conflicts are rejected. Full handover requires the complete ready set. Partial handover supports any nonempty explicit green selection, even when the mould is 100% complete. The receiving person still performs the physical review and signs locally.

Requests are append-only and idempotent. Source changes return a conflict that requires a fresh review; transient network/server failures stay queued and retry. A row is permanently shaded only after the corresponding record is confirmed. Historic PDFs are not automatically imported.

## Source and validation

- `turnpart-schema.sql` records the dedicated schema applied through Supabase's migration API (`add_turnpart_handover_records`). It is a schema snapshot, not a script to rerun on an existing installation.
- `functions/turnpart-handover` contains the deployed endpoint and input validator.
- `functions/_shared` contains exact copies of the client parser and part-key rules. The build rejects drift; copy and redeploy both files whenever those rules change.
- `config.toml` keeps JWT verification enabled for this function.
- `dist/handover-config.js` holds public client credentials only. Never add a secret or service-role key there.

`npm test` checks rules, queues, multi-device reading, 100%-complete partial handovers and pagination. `node scripts/verify-supabase.mjs` checks live reads, denied direct writes, CORS, and server validation using `validation_only`; it creates no handover records. If the local network requires its configured proxy, use Node's `--use-env-proxy` flag. No Apps Script setup is required.
