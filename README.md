# Schedule Sync website

Receives Revit schedules from the add-in, shows them as editable tables (columns come from the schedule itself), and queues your edits for the add-in to apply back in Revit.

## Deploy (Vercel + Neon)
1. Create a free Postgres database at neon.tech and copy its connection string.
2. Push this folder to a GitHub repo and import it in Vercel.
3. Add environment variables in Vercel:
   - `DATABASE_URL` = the Neon connection string
   - `API_KEY` = a long random string (the add-in sends it as `x-api-key`)
   - `SITE_PASSWORD` = the password you type when opening the site (any username)
4. Deploy. Tables are created automatically on first request.

## Add-in API (header `x-api-key: <API_KEY>`)
- `POST /api/addin/upload`: `{ id, name, hash, columns:[{name, type:"bool"|"number"|"text", readOnly, unit?}], rows:[{elementId, values:{<column>:value}}] }`. Skipped if `hash` is unchanged.
- `GET  /api/addin/pending`: `{ edits:[{id, scheduleId, elementId, column, value}] }`
- `POST /api/addin/ack`: `{ applied:[id], failed:[{id, note}] }`

Numbers are sent and received in the units shown in the schedule.


