import { google } from "googleapis";
import "dotenv/config";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

function getAuth() {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) return null;
  return new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * Appends one row to the MyOS backup sheet.
 * Columns: Timestamp | Type | ID | Action | Data (JSON)
 */
export async function appendToSheet(
  type: string,
  id: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  data: Record<string, any>
): Promise<void> {
  const auth = getAuth();
  if (!auth || !SHEET_ID) {
    // Silently skip if not configured — sheets backup is optional
    return;
  }

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const timestamp = new Date().toISOString();
    const row = [timestamp, type, id, action, JSON.stringify(data)];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A:E",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (err) {
    // Fire-and-forget — never block the main request
    console.error("[Google Sheets Backup] Failed to append row:", err);
  }
}

/**
 * Ensures the sheet has a header row on first use.
 * Call once at server startup.
 */
export async function ensureSheetHeaders(): Promise<void> {
  const auth = getAuth();
  if (!auth || !SHEET_ID) return;

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A1:E1",
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A1:E1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["Timestamp", "Type", "ID", "Action", "Data (JSON)"]],
        },
      });
    }
  } catch (err) {
    console.error("[Google Sheets Backup] Failed to set headers:", err);
  }
}

export async function testSheetsConnection(): Promise<{ status: "active" | "failed" | "unconfigured"; error?: string }> {
  if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    return { status: "unconfigured" };
  }
  try {
    const auth = getAuth();
    if (!auth) return { status: "unconfigured" };
    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Sheet1!A1:A1",
    });
    return { status: "active" };
  } catch (err: any) {
    console.error("[Google Sheets Test] Connection failed:", err);
    return { status: "failed", error: err.message || "Authentication or fetch failed" };
  }
}

