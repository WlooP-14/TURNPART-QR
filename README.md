# TURNPART-QR · Mould & Crate

An installable, read-only PWA for checking mould-part progress from Google Sheets. Each crate QR opens one mould using its full identifier, e.g. `1423-TNRV-0926` (job 1423, customer TNRV, received September 2026).

## Architecture

- **Data:** the existing Google Sheet, `Sheet5`, through its currently unauthenticated Google Visualization feed.
- **Frontend:** static HTML/CSS/JavaScript; no framework runtime or server required.
- **Hosting:** Vercel, with automatic deployment from GitHub.
- **PWA:** manifest, local icons, service worker, install help, and saved job records for offline viewing.
- **Supabase:** not required for this version. Add it later if the app needs staff accounts, its own editable records, scan history, or durable crate assignments. It would otherwise duplicate the spreadsheet without adding needed functionality.

The approved Vercel audience is **anyone with the link**. All jobs in the mould directory can be browsed. A QR identifier is a navigation key, not access control. Vercel does not inherit the previous private Sites preview permissions. No API keys or environment variables are needed for this public-sheet version.

## Run and check

Requires Node.js 22 or newer. There are no npm dependencies.

```sh
npm run dev
# Open http://localhost:3000
npm test
npm run build
```

The build checks JavaScript syntax, HTML references, the manifest, icons, and every precached file. The deployable assets are already in `dist/`. Tests cover source grouping, offline records and rejection of invalid snapshots, service-worker offline navigation, cache isolation/update handling, and PNG dimensions. Browser installation and a real device scan still need to be checked on the final deployed URL.

## Deploy to Vercel

1. Push this project to https://github.com/WlooP-14/TURNPART-QR.
2. In Vercel, choose **Add New → Project** and import **WlooP-14/TURNPART-QR**.
3. Keep the root directory as the repository root. `vercel.json` supplies the settings: framework **Other**, build command **npm run build**, output **dist**. Use Node 22 or newer. No environment variables are needed.
4. Deploy, then check that the production URL is accessible in a signed-out browser. Preview deployments may have separate Vercel deployment protection.
5. Open the production URL on a phone, load a job, choose **Crate QR label**, then print and scan the QR.

The `.openai/hosting.json` file records the earlier Sites preview identity; Vercel does not use it. The application works independently of Sites and ChatGPT.

### Keep the QR hostname stable

QRs use the origin where they are generated. **Choose the final Vercel URL or a permanent custom domain before printing production crate labels.** Labels printed from the earlier Sites preview continue to point to that preview; moving the code does not rewrite printed labels. Query identifiers remain stable as statuses or row positions change, provided the full job identifier stays unchanged.

## Batch label printing

Open **Crate QR label → Add more moulds to print**, select moulds and copy counts, review the page preview, then choose **Print labels**. The A4 layout preserves the existing 65 mm QR size, places up to four labels per page with cut borders, and creates further pages automatically. Two labels use landscape; other quantities use portrait.

## Install and use offline

- **Android / Chrome or Edge:** use **Install app** or the browser's install menu.
- **iPhone / iPad:** open in Safari → Share → **Add to Home Screen**.
- **Desktop:** use Chrome or Edge's address-bar install action when available.

Visit online once to install the app shell and save a successful sheet fetch. When offline, the app opens its shell and shows the last saved records for this browser and origin, with the full retrieval date/time and a stale-data warning. A new device without saved data cannot view statuses offline. Local storage may be denied, full, cleared, or evicted by the browser; those cases are handled without claiming offline data is available.

The live sheet is read on opening, on **Refresh**, when connectivity returns, and every 60 seconds while visible. Google may cache its feed, so changes can take a short time to appear. Fetched time means retrieval time, not the source edit time. A failed refresh keeps the old records visibly marked stale. Offline records are stored on the device; **Clear saved job data** removes the saved copy, and the next successful fetch saves a new one.

The service worker precaches only this app's static files. It never intercepts or caches the external Google Sheet feed. New app versions offer **Update app**; clicking it activates the waiting version and reloads. Increment `CACHE` in `dist/sw.js` whenever a cached app-shell file changes.

## Sheet mapping

Job headers: B full identifier, C BOM date, S trial date. Part rows: D name, E quantity, F material, G 2D-ready checkbox, H dispatch date, I deadline, J/K turning vendor/status, L/M hardening vendor/status, N/O grinding vendor/status, P assembly readiness, Q remarks. Merged job fields are filled forward until the next header. Keep each part beneath its own job header. Duplicate identifiers or changed required headers produce an error instead of mixing jobs.

Mould remarks from merged cells are also shown below the table. Summary counts represent part entries, not summed quantities. In-process and to-plan counts can overlap across different stages. Assembly readiness uses the explicit sheet value. All data text is rendered with `textContent`.

## Dependencies and assets

QR generation runs on the device using qrcode-generator 1.4.4 (MIT, Kazuhiko Arase); the license notice is retained in `dist/qrcode.js`. Icons are local. System fonts avoid external font requests. No job snapshots, credentials, or tokens are committed.
