# Apps Script API

This Google Apps Script project handles Google Drive document storage and readable Google Sheet snapshots.

It should be deployed as a Web App:

- Execute as: **Me**
- Who has access: **Anyone** or **Anyone with the link**

The script verifies the Supabase user access token for protected actions, so the Web App URL itself does not need to know the user's Google account.

## Script Properties

Set these in Apps Script project settings:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
SUPABASE_SECRET_KEY=your-supabase-secret-or-service-role-key
DOCUMENT_LINK_ACCESS=private
```

`SUPABASE_SECRET_KEY` can also be named `SUPABASE_SERVICE_ROLE_KEY` for older Supabase projects.

Never put `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or database URLs in frontend code.

## Drive Folder Setup

Folders can be created automatically. Run `doGet` once from the Apps Script editor or call the deployed Web App URL in the browser.

The script creates:

```text
Social Impact/
  documents/
    donations-in/
      2025/
        Jan/
        Feb/
        ...
      2026/
        Jan/
        Feb/
        ...
    donations-out/
      2025/
        Jan/
        Feb/
        ...
      2026/
        Jan/
        Feb/
        ...
  snapshots/
    database/
  exports/
  admin-notes/
```

When a document is uploaded, the script uses the donation's `donated_at` date and saves the file into the matching year/month folder, for example:

```text
documents/donations-in/2026/Jan/
documents/donations-out/2026/Jan/
```

If the needed year or month folder does not exist, the script creates it automatically.

After creating folders, the script stores these properties automatically:

```text
DRIVE_APP_ROOT_FOLDER_ID
DRIVE_DONATION_IN_FOLDER_ID
DRIVE_DONATION_OUT_FOLDER_ID
DRIVE_SNAPSHOT_FOLDER_ID
```

If you already have a root folder, set `DRIVE_APP_ROOT_FOLDER_ID` first. The script will create the nested folders inside it.

## Actions

### `uploadDocument`

```json
{
  "action": "uploadDocument",
  "accessToken": "supabase-user-access-token",
  "donationType": "donation_in",
  "donatedAt": "2026-01-15T00:00:00.000Z",
  "fileName": "receipt.jpg",
  "mimeType": "image/jpeg",
  "base64": "..."
}
```

`donationId` is optional. If provided, the script also links the uploaded document to that existing donation. If omitted, the script returns a `document.id` that the frontend can use when creating a new donation record.

### `createSnapshot`

Admin-only action. Creates a spreadsheet in the snapshot Drive folder.

```json
{
  "action": "createSnapshot",
  "accessToken": "supabase-user-access-token",
  "name": "2026-05-26-before-schema-update"
}
```
