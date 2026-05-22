import { google } from "googleapis";
import { Readable } from "stream";
import "dotenv/config";

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

function getAuth() {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) return null;
  return new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Uploads a file buffer to Google Drive.
 * Returns file metadata including shareable URL.
 */
export async function uploadFileToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DriveFile | null> {
  const auth = getAuth();
  if (!auth) {
    console.warn("[Google Drive] Service account not configured. File upload skipped.");
    return null;
  }

  try {
    const drive = google.drive({ version: "v3", auth });
    const stream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : [],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: "id,name,webViewLink,webContentLink,mimeType,size",
    });

    const file = response.data;

    // Make the file viewable by anyone with the link
    await drive.permissions.create({
      fileId: file.id!,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Re-fetch with sharing link
    const fileData = await drive.files.get({
      fileId: file.id!,
      fields: "id,name,webViewLink,webContentLink,mimeType,size",
    });

    return {
      id: fileData.data.id!,
      name: fileData.data.name!,
      webViewLink: fileData.data.webViewLink!,
      webContentLink: fileData.data.webContentLink!,
      mimeType: fileData.data.mimeType!,
      sizeBytes: parseInt(fileData.data.size || "0"),
    };
  } catch (err) {
    console.error("[Google Drive] Upload failed:", err);
    throw err;
  }
}

/**
 * Deletes a file from Google Drive by its Drive file ID.
 */
export async function deleteFileFromDrive(driveFileId: string): Promise<void> {
  const auth = getAuth();
  if (!auth) return;

  try {
    const drive = google.drive({ version: "v3", auth });
    await drive.files.delete({ fileId: driveFileId });
  } catch (err) {
    console.error("[Google Drive] Delete failed:", err);
    throw err;
  }
}

export async function testDriveConnection(): Promise<{ status: "active" | "failed" | "unconfigured"; error?: string }> {
  if (!DRIVE_FOLDER_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    return { status: "unconfigured" };
  }
  try {
    const auth = getAuth();
    if (!auth) return { status: "unconfigured" };
    const drive = google.drive({ version: "v3", auth });
    await drive.files.get({
      fileId: DRIVE_FOLDER_ID,
      fields: "id,name",
    });
    return { status: "active" };
  } catch (err: any) {
    console.error("[Google Drive Test] Connection failed:", err);
    return { status: "failed", error: err.message || "Authentication or folder fetch failed" };
  }
}

