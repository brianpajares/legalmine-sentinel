# Google Drive database

LegalMine Sentinel can persist projects, assessments, dossier events, leads and pilot feedback in a JSON database stored in Google Drive. This is intended for the personal-owner deployment where the durable record should live in `brian.d.pajares@gmail.com`.

## Production variables

Set these variables in the production host:

```bash
GOOGLE_DRIVE_OWNER_EMAIL=brian.d.pajares@gmail.com
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_DB_FILE_ID=1GY2Wak6RbTNdbaOtvp79WnDX6gQ9FmDu
GOOGLE_DRIVE_DB_FOLDER_NAME="LegalMine Sentinel Database"
GOOGLE_DRIVE_DB_FILE_NAME=legalmine-sentinel-db.json
```

`GOOGLE_DRIVE_DB_FILE_ID` points to the Drive JSON database already created for this app. If it is blank, `GOOGLE_DRIVE_DB_FOLDER_ID` is optional and the app creates or reuses a folder named `LegalMine Sentinel Database` in the authenticated account's Drive.

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are also configured, Supabase is used instead of Drive because it handles concurrent writes better.

## OAuth setup

1. Create a Google Cloud OAuth client for a web or desktop app.
2. Authorize the personal account that owns the database: `brian.d.pajares@gmail.com`.
3. Request a refresh token with Drive file access. The app needs to create/read/update one JSON file in Drive.
4. Put the client id, client secret and refresh token into production environment variables.
5. Open `/api/health/sources` and confirm `storage.kind` is `drive` and `storage.ephemeral` is `false`.

## What is stored

The Drive file is JSON with immutable evidence payloads as emitted by the assessment engine:

- `projects`
- `assessments`
- `feedback`
- `leads`
- `reportEvents`

This keeps the dossier re-openable because the assessment contains its evidence IDs, source status, corpus basis and geometry fingerprint. Missing source data remains explicit; Drive persistence does not fabricate source answers.
