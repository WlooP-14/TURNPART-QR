# TURNPART-QR · Mould & Crate

An installable PWA for checking mould-part progress and documenting turnpart handovers from Google Sheets. Each crate QR opens one mould using its full identifier, e.g. `1423-TNRV-0926` (job 1423, customer TNRV, received September 2026).

## Architecture

- **Data:** both `Sheet5` and `JobDispatched` in the existing Google Sheet. Shared handovers use a dedicated table and validating Edge Function in the existing `mapel_storeroom` Supabase project.
- **Frontend:** static HTML/CSS/JavaScript; no framework runtime or server required.
- **Hosting:** Vercel, with automatic deployment from GitHub.
- **PWA:** manifest, local icons, service worker, install help, and saved job records for offline viewing.
- **Supabase:** the existing `mapel_storeroom` project stores shared marks in `turnpart_handover_records`. Its `store_*` tables, Auth settings and policies are not changed.

The approved Vercel audience is **anyone with the link**. All jobs in the mould directory can be browsed. A QR identifier is a navigation key, not access control. Vercel does not inherit the previous private Sites preview permissions. No Vercel environment variables are needed. `dist/handover-config.js` contains browser-safe Supabase publishable/anon credentials only. The service-role credential stays inside the Edge Function environment and is never bundled in this app.

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

## Home overview and progress

The root URL opens a searchable vertical list of moulds, each with a work-completion percentage and its B.O.M. date from column C. B.O.M. dates are also shown in the mould dropdown and details header. Missing dates display an em dash. Selecting a mould opens its existing part details; **All moulds** returns to the overview. Existing `?job=...` QR links still open the matching details directly. Browser history and automatic refresh preserve the current view. On the details screen, the mould directory is a searchable dropdown, collapsed after selection. Its summary shows the selected mould and percentage; each expanded entry includes the same percentage and a progress bar. The dropdown stays open during automatic sheet refreshes and its list scrolls vertically on mobile.

Progress counts each applicable turning, hardening, and grinding stage once per part entry: `DONE stages / applicable stages × 100`, rounded down. `NOT APPLICABLE` stages are excluded. In-process, to-plan, delayed, blank, and unknown stages are unfinished. No partial credit or quantity/time weighting is inferred. A job with no applicable stages shows 100% only if every part is explicitly assembly-ready; otherwise it shows 0%. This machining progress is separate from the dispatched/completed mould list.

## Both source sheets and handover status

The overview, directory, part table, direct QR routes and batch labels include both `Sheet5` and `JobDispatched`. Dispatched jobs now open the same detailed table as live jobs. Duplicate identifiers use the dispatched record once. Both feeds refresh every 15 seconds while visible and retain separate timestamped offline tables. The home Jobs selector filters live/dispatched/all jobs.

The home filters distinguish **Ongoing**, **Partially handed over**, and **Fully handed over**, independently of machining percentages or the source sheet's dispatched state. Shared records cover stable part-entry keys; repeated partial handovers count each entry only once. Covering every current part entry gives Fully handed over, including several partial handovers. New or changed part identities are not silently covered by old records. Unavailable shared status is never assumed to mean Ongoing.

Shared saving is configured in the existing Supabase project `mapel_storeroom` (`slgcoiufhestfbrrcbuz`). The dedicated `turnpart_handover_records` table allows public reads of shared part marks, with RLS enabled and all browser insert/update/delete permissions revoked. The JWT-protected `turnpart-handover` Edge Function checks each write against the current Google Sheet. Full handover requires every part ready; partial handover accepts an explicit reviewed selection on any mould, including 100%-complete moulds. The function stores no names, signatures, or PDFs. Source process columns, readiness, formatting, and existing storeroom tables are not modified. The app derives permanent whole-row lavender shading from these records across devices and reloads. Part keys do not depend on source row numbers. No Apps Script deployment is needed. See [supabase/README.md](supabase/README.md) for backend details.

## Interface motion

Mould navigation uses short fade/slide entrances; interactive controls have hover/press feedback; dropdowns and dialogs transition open/closed on supporting browsers. Progress bars ease from their previous value when status percentages change. Automatic sheet refreshes do not replay page entrance animations. System reduced-motion preferences disable these effects; print output has transitions disabled. Browsers without the animation APIs retain immediate, functional navigation.

Part names default to light red with the red edge accent when assembly readiness is not Yes/True, and normal colours when ready. Tap a name to cycle **normal → red → green → normal**, with no confirmation or network request. Enter/Space also activates the name button. Only that part-name cell changes. Manual marks override the current default until the sheet readiness changes. A No → Yes change restores normal, and a Yes → No change restores red, clearing the previous manual override. Taps advance from the currently displayed colour, so an automatically red cell changes to green on its next tap. Green selects a part for partial handover. After confirmed shared handover, the whole row has permanent handover shading and its tap control is locked; it is excluded from later green selections. The app never writes colours or readiness to Google Sheets. Marks are saved in this browser on this device and survive filters, refreshes, and reloads when local storage is available. If storage is blocked, tapping still works for the current session. Other devices do not share these marks. Keys use the full mould identifier and the part name/material/quantity plus an occurrence number for repeated identical entries. Changing those identifying values, reordering identical duplicate entries, or clearing browser storage may reset or reassign a mark.

## Mould status list

Choose **Mould status** next to **Open Google Sheet** in the header to view a searchable list of mould identifiers and Done/Ongoing status. It opens on **Done**. Completed names come from the `JobDispatched` tab; ongoing names come from `Sheet5`. The completed view displays merged job-header names and no part history. If a job occurs in both sources, the archive marks it Done once. The completed-name list has independent refresh/error handling and a timestamped offline copy. Assembly readiness alone does not mark a mould dispatched.

**Open Google Sheet** is visible in the header on desktop and mobile. Mobile search fields use a readable input size, and the directory scrolls vertically within its own area.

## Batch label printing

Open **Crate QR label → Add more moulds to print**, select moulds and copy counts, review the page preview, then choose **Print labels**. The A4 layout preserves the existing 65 mm QR size, places up to four labels per page with cut borders, and creates further pages automatically. Two labels use landscape; other quantities use portrait.

Print actions suggest a PDF filename containing the unique mould numbers and the print date in India, for example `Mould-QR_1423_1403_2026-11-15.pdf`. The browser uses the temporary print document title for its Save as PDF filename; the normal app title is restored after printing or cancellation. Very long batches abbreviate the remaining moulds as `plus-N` to keep the filename within common filesystem limits.

## Turnpart handover proof

**Full handover:** when every turnpart is explicitly ready to assemble, **Handover turnparts** opens the existing flow. Confirm the handover, enter the Die maker and person handing over, and confirm physical self-review. The full proof keeps its original wording, full-set scope and filename, e.g. `1420BAEM turnpart handover proof.pdf`, without a part list.

**Partial handover:** tap names to green, optionally use the **Green parts** table filter, then choose **Partial handover (N)**. All green entries not previously handed over are selected, including entries hidden by a current table search/filter. The partial proof includes only these part names and quantities in a table. Quantities are taken from the sheet; missing quantities display an em dash. This transfers complete listed entries, not an editable subset of an entry's quantity. Green may select a part before its sheet ready flag is updated; the person's physical self-review confirms those entries are ready. Full handover still requires every sheet ready flag to be Yes/True.

Both proofs use Times New Roman (with Times/serif fallbacks), bold important details, whole-word wrapping, and the Die maker's actual freehand signature. PDFs use A4; long partial lists continue onto more pages with table headings and the signature on the final page. Partial filenames include `partial turnpart handover proof.pdf`. Names, signatures and PDF bytes stay on the device and are cleared from the form on closing; none are sent to the shared log.

A recent online fetch of the job's own source is required. Changed parts/readiness, changed green selection or a new date require preparing/signing again. After a signed PDF is generated and its browser download triggered, the Supabase function records the part keys using an idempotent request ID. Permanent shading and shared home status appear only after the log confirms the write. Failed/offline writes remain visibly pending and retry without duplicates. Pending packets contain no names, signature, or PDF. If the shared connection is unavailable, success is not claimed until a record is confirmed. Previously downloaded PDFs are not retroactively imported as handovers. Clearing saved job data does not delete shared permanent handover records.

## Install and use offline

- **Android / Chrome or Edge:** use **Install app** or the browser's install menu.
- **iPhone / iPad:** open in Safari → Share → **Add to Home Screen**.
- **Desktop:** use Chrome or Edge's address-bar install action when available.

Visit online once to install the app shell and save a successful sheet fetch. When offline, the app opens its shell and shows the last saved records for this browser and origin, with the full retrieval date/time and a stale-data warning. A new device without saved data cannot view statuses offline. Local storage may be denied, full, cleared, or evicted by the browser; those cases are handled without claiming offline data is available.

The live sheet is read on opening, on **Refresh**, when connectivity returns, and every 15 seconds while visible. Google may cache its feed, so changes can take a short time to appear. Fetched time means retrieval time, not the source edit time. A failed refresh keeps the old records visibly marked stale. Offline records are stored on the device; **Clear saved job data** removes the saved copy, and the next successful fetch saves a new one.

The service worker precaches only this app's static files. It never intercepts or caches the external Google Sheet feed. New app versions display an **Update available** popup with **Update now** and **Later**. Later leaves a visible bottom reminder. The app checks for updates while open and when brought back into view. Updating activates the waiting version and reloads. Increment `CACHE` in `dist/sw.js` whenever a cached app-shell file changes.

## Sheet mapping

Job headers: B full identifier, C BOM date, S trial date. Part rows: D name, E quantity, F material, G material-acquired checkbox, H dispatch date, I deadline, J/K turning vendor/status, L/M hardening vendor/status, N/O grinding vendor/status, P assembly readiness. Merged job fields are filled forward until the next header. Keep each part beneath its own job header. Duplicate identifiers or changed required headers produce an error instead of mixing jobs.

Summary counts represent part entries, not summed quantities. In-process and to-plan counts can overlap across different stages. Assembly readiness uses the explicit sheet value. All data text is rendered with `textContent`.

## Dependencies and assets

QR generation runs on the device using qrcode-generator 1.4.4 (MIT, Kazuhiko Arase); the license notice is retained in `dist/qrcode.js`. Icons are local. System fonts avoid external font requests. No job snapshots, credentials, or tokens are committed.

PDF creation runs on the device using pdf-lib 1.17.1 (MIT), vendored with its license in `dist/vendor/`. The letter and actual drawn signature are rendered into the PDF locally, including browser-supported Unicode names.
