const ROOT_FOLDER_NAME = "Gospel VS - Multitracks";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN")!;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google access token: ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function findFolder(name: string, parentId: string | null, accessToken: string): Promise<string | null> {
  const parentClause = parentId ? `and '${parentId}' in parents` : "and 'root' in parents";
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false ${parentClause}`
  );
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Drive folder search failed: ${await response.text()}`);
  const data = await response.json();
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | null, accessToken: string): Promise<string> {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!response.ok) throw new Error(`Drive folder creation failed: ${await response.text()}`);
  const data = await response.json();
  return data.id;
}

async function findOrCreateFolder(name: string, parentId: string | null, accessToken: string): Promise<string> {
  const existing = await findFolder(name, parentId, accessToken);
  if (existing) return existing;
  return createFolder(name, parentId, accessToken);
}

// Finds/creates the root app folder, then the per-song subfolder inside it.
async function ensureSongFolder(artistName: string, songName: string, accessToken: string): Promise<string> {
  const rootId = await findOrCreateFolder(ROOT_FOLDER_NAME, null, accessToken);
  const songFolderName = `${artistName} - ${songName}`;
  return findOrCreateFolder(songFolderName, rootId, accessToken);
}

// Starts a resumable upload session. The caller (browser) then PUTs the file
// bytes directly to the returned URL, so large files never pass through the Edge Function.
async function createResumableUploadSession(
  fileName: string,
  mimeType: string,
  folderId: string,
  accessToken: string
): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
      },
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    }
  );
  if (!response.ok) throw new Error(`Failed to start resumable upload: ${await response.text()}`);
  const location = response.headers.get("Location");
  if (!location) throw new Error("Drive did not return a resumable upload URL");
  return location;
}

async function listPermissions(fileId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,type)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Failed to list Drive permissions: ${await response.text()}`);
  const data = await response.json();
  return data.permissions ?? [];
}

async function deletePermission(fileId: string, permissionId: string, accessToken: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Drive permission: ${await response.text()}`);
  }
}

// Google only sends the "shared with you" notification the first time a
// permission is created - re-sharing with the same email is a silent no-op.
// To force a fresh notification email, drop the existing grant first.
async function resendShareNotification(
  fileId: string,
  email: string,
  accessToken: string,
  expirationTime?: string
) {
  const permissions = await listPermissions(fileId, accessToken);
  const existing = permissions.find(
    (p: any) => p.type === "user" && p.emailAddress?.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    await deletePermission(fileId, existing.id, accessToken);
  }
  return shareFileWithUser(fileId, email, accessToken, expirationTime);
}

async function getFile(fileId: string, accessToken: string, fields = "id,name,webViewLink,size") {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) throw new Error(`Failed to fetch Drive file: ${await response.text()}`);
  return response.json();
}

// Grants a specific buyer read access to a file, which makes Google send
// its own "shared with you" notification email automatically.
async function shareFileWithUser(
  fileId: string,
  email: string,
  accessToken: string,
  expirationTime?: string
) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "user",
        emailAddress: email,
        ...(expirationTime ? { expirationTime } : {}),
      }),
    }
  );
  if (!response.ok) throw new Error(`Failed to share Drive file: ${await response.text()}`);
  return response.json();
}

export const googleDrive = {
  getAccessToken,
  findOrCreateFolder,
  ensureSongFolder,
  createResumableUploadSession,
  getFile,
  shareFileWithUser,
  resendShareNotification,
};
