# Mould & Crate

Read-only mould tracking connected directly to the supplied Google Sheet, `Sheet5`.

## Usage

Select a job, choose **Crate QR label**, and print the label. Attach it to the crate for that mould. The QR contains the permanent site URL and full normalized `job-customer-MMyy` identifier, never a row number. Keep the job identifier unchanged for existing labels. Reordering rows within a complete job group does not change its link; every part must remain under its job header.

The tracker reads Google Sheets on opening, manual Refresh, and every 60 seconds while visible. Google may cache its visualization feed, so a sheet edit may take a short time to appear. Fetched time is the retrieval time, not a source edit timestamp. Failed refreshes retain existing data with an explicit stale warning. No snapshot or Sheet write access is embedded.

The site starts owner-private. Company access needs to be configured in Sites before other people can use the labels. Sheet access is independent: its current Google visualization feed is readable without authentication and must remain available for the connection to work. Do not make sensitive sheets public to repair a connection; migrate to an authenticated server integration instead if that becomes necessary.

## Columns

Validated on 15 November 2026. Job headers: B full identifier, C BOM, S trial date. Part rows: D name, E quantity, F material, G 2D ready, H dispatch date, I deadline, J/K turning vendor/status, L/M hardening vendor/status, N/O grinding vendor/status, P assembly readiness, Q remarks. Merged job fields are filled forward until the next header. Unknown or duplicate QR identifiers never select another mould automatically.

Job-level remarks from merged cells are also displayed below the table. Counts are part entries, not summed quantities. In-process and to-plan counts can overlap across different stages. Assembly readiness follows the explicit sheet value.

## Implementation

Buildless HTML/CSS/JavaScript. Google Visualization JSONP supplies the public feed. All data text is rendered with textContent. QR generation runs locally using qrcode-generator 1.4.4 (MIT, Kazuhiko Arase); its license notice is retained in dist/qrcode.js. Fonts are served by Google Fonts with system fallbacks.

Hosting manifest: `.openai/hosting.json`; assets: `dist/`. No server, provider credentials, or database required. The Sites shell helpers were unavailable in this environment; source was synchronized with Git credentials passed only through stdin and process environment, and the exact committed assets were packaged for deployment.
