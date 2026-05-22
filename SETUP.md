# MyOS — System Integration Guide (Supabase + Google APIs)

This system is fully structured to leverage **Supabase** for high-velocity core operations, **Google Sheets** for append-only audit & data backup logging, and **Google Drive** for high-volume file storage.

Follow these clinical instructions to activate all components.

---

## 1. Setup Supabase (Primary Database)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the **SQL Editor**, paste and run the following schema definitions to initialize your tables:

```sql
-- items table (core schema)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- files metadata table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  drive_download_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - or configure to allow authenticated users
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON items FOR ALL USING (true);
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON files FOR ALL USING (true);

-- Auto-update updated_at on modify
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 2. Setup Google Service Account (Drive & Sheets Access)

To let the backend save backups to Sheets and upload to Drive:

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project.
3. Enable the following APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Go to **IAM & Admin → Service Accounts** → Click **Create Service Account**.
5. Give it a name and click **Done**.
6. Select the created Service Account, go to **Keys** tab → **Add Key → Create New Key** (select **JSON**).
7. Save the JSON file. You will need:
   - `client_email` (e.g. `myos-backup@yourproject.iam.gserviceaccount.com`)
   - `private_key` (the multi-line RSA key)

---

## 3. Setup Backup Google Sheet & Drive Folder

### Backup Google Sheet
1. Create a new Google Sheet.
2. Share the Google Sheet with the `client_email` of your service account as an **Editor**.
3. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### Google Drive Storage Folder
1. Create a folder in Google Drive where MyOS will store images, videos, and files.
2. Share the folder with the `client_email` of your service account as an **Editor**.
3. Copy the Folder ID from the URL:
   `https://drive.google.com/drive/folders/[FOLDER_ID]`

---

## 4. Setup `.env` Configuration File

Create a `.env` file in your project root workspace (`c:/Users/darkm/OneDrive/Desktop/KEO MONI/myos---personal-operating-system/.env`) using `.env.example` as a layout:

```env
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

GOOGLE_SERVICE_ACCOUNT_EMAIL="myos-backup@yourproject.iam.gserviceaccount.com"
# Put the private key in quotes, replacing real newlines with \n characters
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"

GOOGLE_SHEET_ID="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
GOOGLE_DRIVE_FOLDER_ID="1xxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 5. Migrate Existing Local SQLite Database (Optional)

If you already have local data inside `myos.db` SQLite and want to upload it to Supabase:

Run the migration script:
```bash
npx tsx migrate.ts
```

Your data will be parsed, validated, and ingested into Supabase dynamically.

---

## 6. Run the Application

Start the local operational stack:
```bash
npm run dev
```

Visit the dashboard at `http://localhost:3000`. Full sync state is now established!
