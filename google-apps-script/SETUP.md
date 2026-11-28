# Connect shared handover marks

This small web app saves handovers in a new `TURNPART_HANDOVERS` tab in the existing spreadsheet. The website reads that log to keep whole handed-over rows coloured across phones and computers, and to calculate the three home-page handover groups. Source readiness and part data are not changed. Names, signatures and PDFs stay on the device.

1. Open the Google Sheet as its owner/editor. Choose **Extensions → Apps Script**.
2. Replace the starter code with the contents of `Handover.gs`, then save.
3. Choose **Deploy → New deployment → Web app**.
4. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and authorize access to this spreadsheet.
5. Send the deployed **Web app URL** ending in `/exec` to Codex to connect it to the website. Do not send an access token or password.

If the sheet already has Apps Script code, create a separate standalone Apps Script project for this file instead. The spreadsheet ID is already in the code, so it works without being bound to the sheet. Do not replace existing automations or existing `doGet`/`doPost` handlers.

The web app uses the site's existing public-link workflow. Anyone who can use its handover flow can append a handover for actual parts in the two allowed sheets. It validates part identities, rejects invalid/full-unready handovers, and handles repeated submission IDs without duplicating them. There is no public endpoint for changing existing handovers, deleting records, writing arbitrary cells, or uploading a signature.

Do not rename or manually remove the log tab: it is the shared record behind the permanent row marks. Existing signed PDFs are not imported as past handovers. If a part's identity/quantity/material changes, it is treated as a changed entry and must be reviewed again.
