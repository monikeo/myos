# Premium Integration Guide — Supabase, Google Sheets & Google Drive

Welcome to your comprehensive operational guide for integrating and maintaining **MyOS — Personal Operating System** cloud services. This setup enables a unified sync pipeline using **Supabase** as your lightning-fast database core, **Google Sheets** as a permanent, non-blocking mutation audit-logger, and **Google Drive** for large-scale media & document vault storage.

---

## 🟥 Step 1: Supabase Setup (Core Relational Database)

### 1. Project Initialization
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and log in.
2. Click **New Project** and select/create your organization.
3. Give your project a name (e.g. `MyOS-Prod`) and set a secure database password. Save this password.
4. Select a region close to your physical location (e.g., `Southeast Asia (Singapore)` or `US East`).
5. Click **Create new project** and wait ~2 minutes for provision setup.

### 2. Schema Definition (SQL Editor)
1. In the left navigation, click on the **SQL Editor** icon (represented by `SQL` or `>` icon).
2. Click **New query** to open a fresh command runner.
3. Paste the following schema commands into the workspace:

```sql
-- Create items table (core workspace storage)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create files metadata table (for Google Drive uploads)
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  drive_download_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on both tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Create direct read/write permission bypass policy for authenticated connections
CREATE POLICY "Allow operations" ON items FOR ALL USING (true);
CREATE POLICY "Allow operations" ON files FOR ALL USING (true);

-- Automate updated_at trigger for items table
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_modified_timestamp();
```
4. Click **Run** on the bottom right. Verify "Success" message appears.

### 3. Retrieve Credentials
1. Go to **Project Settings** (gear icon on bottom left) → **API**.
2. Locate the following keys and copy them:
   * **Project URL** (under API URL) -> Maps to `SUPABASE_URL`
   * **`anon` `public`** key (under Project API keys) -> Maps to `SUPABASE_ANON_KEY`
   * **`service_role` `secret`** key (under Project API keys) -> Maps to `SUPABASE_SERVICE_ROLE_KEY`
     * ⚠️ *Security note: Keep this key private. It bypasses RLS rules to allow backend administration.*

---

## 🟩 Step 2: Google Cloud Platform Setup (Service Account)

To communicate with Google APIs programmatically, you need a Google Service Account credentials key.

### 1. Create a Google Cloud Console Project
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Click the project dropdown at the top and select **New Project**.
3. Name the project (e.g. `myos-cloud-integration`) and click **Create**.

### 2. Enable Required APIs
You must explicitly turn on the Sheets and Drive API portals:
1. In the search bar at the top, type **Google Sheets API**. Select it and click **Enable**.
2. Go back to the search bar, type **Google Drive API**. Select it and click **Enable**.

### 3. Generate Service Account Key
1. Go to **Navigation Menu (top left) → IAM & Admin → Service Accounts**.
2. Click **+ Create Service Account** at the top.
3. Fill in the **Service account details**:
   * Name: `myos-sync-agent`
   * ID: will auto-fill (e.g., `myos-sync-agent@yourproject.iam.gserviceaccount.com`)
   * Description: `Backend sync and storage manager for MyOS`
4. Click **Create and Continue**, then click **Done** (leave roles default/blank).
5. Locate the newly created service account in the table list. Under the **Actions** column, click the **three dots** → **Manage keys**.
6. Click **Add Key → Create new key**. Select **JSON** format, then click **Create**.
7. A JSON credentials file will download automatically. Rename this file `google-credentials.json` or keep it safe. Open it in a text editor to view:
   * `"client_email"`: Copy this email address (we will share Google assets with it).
   * `"private_key"`: Copy this multi-line private key.

---

## 🟨 Step 3: Google Sheets Setup (Audit mutations backup)

### 1. Create a Dedicated Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet.
2. Title it something clear, like `MyOS Transaction Ledger`.

### 2. Assign Permissions
1. Click the **Share** button in the top right corner.
2. In the share window, paste your Service Account **`client_email`** (copied in Step 2).
3. Ensure the permission level is set to **Editor** and untick "Notify people".
4. Click **Share**.

### 3. Obtain Sheet ID
1. Look at the browser address bar while inside the sheet.
2. Copy the long character string located between `/d/` and `/edit` in the URL:
   `https://docs.google.com/spreadsheets/d/[SHEET_ID_HERE]/edit`

---

## 🟦 Step 4: Google Drive Setup (Document Storage Vault)

### 1. Create a Vault Folder
1. Open [Google Drive](https://drive.google.com).
2. Create a new folder. Title it `MyOS_Vault`.

### 2. Assign Permissions
1. Right-click the folder → **Share → Share**.
2. Paste the Service Account **`client_email`** (from Step 2).
3. Ensure permission is set to **Editor** and untick "Notify people".
4. Click **Share**.

### 3. Obtain Folder ID
1. Double-click the folder to open it.
2. In the browser address bar, copy the long character string at the end of the URL path:
   `https://drive.google.com/drive/folders/[FOLDER_ID_HERE]`

---

## ⚙️ Step 5: Configure Your `.env` File

Create a `.env` file at your workspace root (`c:\Users\darkm\OneDrive\Desktop\KEO MONI\myos---personal-operating-system\.env`) and fill in your collected tokens:

```env
# SUPABASE PARAMETERS
SUPABASE_URL="https://yourproject.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# GOOGLE SERVICE ACCOUNT CREDENTIALS
GOOGLE_SERVICE_ACCOUNT_EMAIL="myos-sync-agent@yourproject.iam.gserviceaccount.com"
# Put the exact multiline private key inside quotes, representing real newlines with \n
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDh...\n-----END RSA PRIVATE KEY-----\n"

# INTEGRATION IDENTIFIERS
GOOGLE_SHEET_ID="your_google_sheet_id_here"
GOOGLE_DRIVE_FOLDER_ID="your_google_drive_folder_id_here"
```

---

## 📈 Step 6: Testing & Validation

### 1. Launch the Server Stack
Open your terminal inside the workspace and run:
```bash
npm run dev
```

### 2. Verify Google Sheets Connection
When the backend starts up, it automatically queries and appends standard header labels to Sheet1 if the sheet is empty.
Check your Google Sheet; you should see columns:
`Timestamp` | `Type` | `ID` | `Action` | `Data (JSON)`

### 3. Perform a Test Mutation
1. Open the local dashboard (`http://localhost:3000`).
2. Go to **Todo List** page.
3. Deploy a new objective (e.g. `System Integration Test`).
4. Switch back to your Google Sheet. You should immediately see a **CREATE** row logged inside the table, documenting your task!

### 4. Upload a Vault Document
1. Go to the **File Vault** panel.
2. Drag and drop any image, video, or PDF file into the upload zone.
3. Monitor progress completion. Once uploaded, check:
   * **Supabase**: Look at the `files` metadata table in Supabase dashboard. You will see a new record with details.
   * **Google Drive**: Open your `MyOS_Vault` folder. The file will be uploaded there, shared publicly so you can click preview inside the app!

---
🏆 Congratulations, your Cloud-Synced personal operating system is now fully operational and ready for use!
