import { ItemType } from "@/src/types";

const BASE = "/api";

// ============================================================
// AUTH SEGMENT & NETWORK WRAPPER
// ============================================================

function sanitizeSessionString(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/[<>]/g, ""); // strip standard HTML tag symbols
}

function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("myos_session_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const id = user.id || null;
        if (id && isValidUuid(id)) {
          return id;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getCurrentSession(): any | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem("myos_session_user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.id && isValidUuid(user.id)) {
          return {
            id: user.id,
            username: sanitizeSessionString(user.username),
            email: sanitizeSessionString(user.email),
            dob: sanitizeSessionString(user.dob),
            display_name: sanitizeSessionString(user.display_name),
            role_title: sanitizeSessionString(user.role_title),
            avatar_url: sanitizeSessionString(user.avatar_url),
          };
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function login(username: string, password: string): Promise<any> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-MyOS-CSRF": "myos-secure-spa"
    },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Login failed");
  }
  const user = await res.json();
  localStorage.setItem("myos_session_user", JSON.stringify(user));
  
  // Clear caches to refresh with user data
  cache.items.clear();
  cache.singleItems.clear();
  cache.stats = null;
  cache.settings = null;
  broadcastChange();
  return user;
}

export async function register(
  username: string,
  password: string,
  displayName: string,
  roleTitle?: string,
  avatarUrl?: string,
  email?: string,
  dob?: string
): Promise<any> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-MyOS-CSRF": "myos-secure-spa"
    },
    body: JSON.stringify({ username, password, displayName, roleTitle, avatarUrl, email, dob }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Registration failed");
  }
  const user = await res.json();
  localStorage.setItem("myos_session_user", JSON.stringify(user));

  // Clear caches
  cache.items.clear();
  cache.singleItems.clear();
  cache.stats = null;
  cache.settings = null;
  broadcastChange();
  return user;
}

export function logout() {
  localStorage.removeItem("myos_session_user");
  cache.items.clear();
  cache.singleItems.clear();
  cache.stats = null;
  cache.settings = null;
  broadcastChange();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<any> {
  const res = await apiFetch(`${BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Password change failed");
  }
  return res.json();
}

export async function getAllUsers(): Promise<any[]> {
  const res = await apiFetch(`${BASE}/users`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function lookupUserByEmail(email: string): Promise<any> {
  const res = await apiFetch(`${BASE}/users/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "User not found");
  }
  return res.json();
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {}),
    "X-Requested-With": "XMLHttpRequest",
    "X-MyOS-CSRF": "myos-secure-spa",
  } as any;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

// ============================================================
// IN-MEMORY REACTIVE CACHE STORE & HELPERS
// ============================================================

const cache = {
  items: new Map<string, any[]>(),
  singleItems: new Map<string, any>(),
  stats: null as any,
  settings: null as any,
};

const inFlightGets = new Map<string, Promise<any>>();

// Hydrate from localStorage on boot for ZERO latency
try {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("myos_api_cache_items");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach(k => {
          if (/^[a-zA-Z0-9_-]+$/.test(k) && Array.isArray(parsed[k])) {
            cache.items.set(k, parsed[k]);
          }
        });
      }
    }
  }
} catch (err) {
  console.warn("Failed to hydrate api cache", err);
}

function persistCache() {
  try {
    if (typeof window !== "undefined") {
      const obj = Object.fromEntries(cache.items);
      localStorage.setItem("myos_api_cache_items", JSON.stringify(obj));
    }
  } catch (err) {
    console.warn("Failed to persist api cache. Quota exceeded?", err);
  }
}

// Deep cloning helper to prevent reactive component mutation of cache
function clone<T>(val: T): T {
  if (val === undefined) return undefined as any;
  return typeof structuredClone === "function" ? structuredClone(val) : JSON.parse(JSON.stringify(val));
}

// Global event broadcaster
function broadcastChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("myos:data-changed"));
  }
}

// Synchronizes the item lists and single caches when an item is modified
function updateCachesWithItem(item: any, isDelete = false) {
  if (!item || !item.id) return;

  // 1. Update single item cache
  if (isDelete) {
    cache.singleItems.delete(item.id);
  } else {
    cache.singleItems.set(item.id, item);
  }

  // 2. Update item lists cache
  for (const [key, list] of cache.items.entries()) {
    if (isDelete) {
      const updatedList = list.filter(i => i.id !== item.id);
      cache.items.set(key, updatedList);
    } else {
      const index = list.findIndex(i => i.id === item.id);
      if (index > -1) {
        list[index] = item;
      } else {
        if (key === "all" || key === item.type) {
          list.unshift(item);
        }
      }
      cache.items.set(key, [...list]);
    }
  }
  persistCache();
}

// Optimistically increments or decrements dashboard stats
function adjustStats(type: string, amount: number) {
  if (!cache.stats) return;
  if (type === "task") cache.stats.tasks = Math.max(0, (cache.stats.tasks || 0) + amount);
  else if (type === "note") cache.stats.notes = Math.max(0, (cache.stats.notes || 0) + amount);
  else if (type === "workspace") cache.stats.workspaces = Math.max(0, (cache.stats.workspaces || 0) + amount);
}

// Global error notifications dispatcher
function triggerSystemError(title: string, message: string, category: string = "system") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("myos:notification", {
        detail: {
          title: `System Alert: ${title}`,
          message: `${message}. State recovered successfully.`,
          category,
          created_at: new Date().toISOString()
        }
      })
    );
  }
}

// ============================================================
// ITEMS (Notes, Tasks, Workspaces, Events, Transactions, Links)
// ============================================================

export async function getItems<T = any>(type?: ItemType): Promise<T[]> {
  const cacheKey = type || "all";
  const cached = cache.items.get(cacheKey);

  const fetchPromise = async () => {
    const url = type ? `${BASE}/items?type=${type}` : `${BASE}/items`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${type || "items"}: ${res.statusText}`);
    const data = await res.json();

    const currentCachedStr = JSON.stringify(cached || []);
    const newFetchedStr = JSON.stringify(data);

    if (currentCachedStr !== newFetchedStr) {
      cache.items.set(cacheKey, data);
      persistCache();
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item && item.id) cache.singleItems.set(item.id, item);
        });
      }
      broadcastChange();
    }
    return clone(data);
  };

  if (cached) {
    // Revalidate in background, catch quietly
    if (!inFlightGets.has(cacheKey)) {
      const p = fetchPromise().catch(err => console.warn("Background revalidation failed for getItems:", err))
        .finally(() => inFlightGets.delete(cacheKey));
      inFlightGets.set(cacheKey, p);
    }
    return Promise.resolve(clone(cached) as T[]);
  }

  if (inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey) as Promise<T[]>;
  }

  const p = fetchPromise().finally(() => inFlightGets.delete(cacheKey));
  inFlightGets.set(cacheKey, p);
  return p as Promise<T[]>;
}

export async function getItem<T = any>(id: string): Promise<T> {
  const cached = cache.singleItems.get(id);

  const fetchPromise = async () => {
    const res = await apiFetch(`${BASE}/items/${id}`);
    if (!res.ok) throw new Error(`Item not found: ${id}`);
    const data = await res.json();

    const currentCachedStr = JSON.stringify(cached || null);
    const newFetchedStr = JSON.stringify(data);

    if (currentCachedStr !== newFetchedStr) {
      cache.singleItems.set(id, data);
      updateCachesWithItem(data);
      broadcastChange();
    }
    return clone(data);
  };

  if (cached) {
    fetchPromise().catch(err => console.warn("Background revalidation failed for getItem:", err));
    return Promise.resolve(clone(cached) as T);
  }

  const freshData = await fetchPromise();
  return freshData as T;
}

export async function createItem(item: { id?: string; type: ItemType; [key: string]: any }) {
  // Generate temporary ID for optimistic render
  const tempId = item.id || "temp_" + Math.random().toString(36).substring(2, 11);
  const optimisticItem = { ...item, id: tempId, created_at: item.created_at || new Date().toISOString() };

  // 1. Write optimistically to cache
  updateCachesWithItem(optimisticItem);
  adjustStats(item.type, 1);
  broadcastChange();

  try {
    const res = await apiFetch(`${BASE}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to create item: ${res.statusText}`);
    const serverItem = await res.json();

    // 2. Swap optimistic temp item with actual server item
    updateCachesWithItem(optimisticItem, true); // remove temp
    updateCachesWithItem(serverItem); // add permanent
    broadcastChange();
    return serverItem;
  } catch (err: any) {
    // 3. Rollback on failure
    updateCachesWithItem(optimisticItem, true);
    adjustStats(item.type, -1);
    broadcastChange();
    if (item.type !== "notification") {
      triggerSystemError(`Create ${item.type} Failed`, err.message || "Unknown communication fault", item.type);
    }
    throw err;
  }
}

export async function updateItem(id: string, item: { type: ItemType; [key: string]: any }) {
  // 1. Back up existing item
  const backup = clone(cache.singleItems.get(id) || (cache.items.get(item.type || "all")?.find(i => i.id === id)));
  const optimisticItem = { ...backup, ...item, id };

  // 2. Write optimistically to cache
  updateCachesWithItem(optimisticItem);
  broadcastChange();

  try {
    const res = await apiFetch(`${BASE}/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to update item: ${res.statusText}`);
    const serverItem = await res.json();

    // 3. Update with official server response
    updateCachesWithItem(serverItem);
    broadcastChange();
    return serverItem;
  } catch (err: any) {
    // 4. Rollback on failure
    if (backup) {
      updateCachesWithItem(backup);
    } else {
      updateCachesWithItem({ id }, true);
    }
    broadcastChange();
    if (item.type !== "notification") {
      triggerSystemError(`Update ${item.type} Failed`, err.message || "Unknown communication fault", item.type);
    }
    throw err;
  }
}

export async function deleteItem(id: string) {
  // 1. Back up existing item to rollback if deletion fails
  const backup = clone(cache.singleItems.get(id) || Array.from(cache.items.values()).flatMap(l => l).find(i => i.id === id));
  if (!backup) {
    // Not found in cache, delete directly
    const res = await apiFetch(`${BASE}/items/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete item: ${res.statusText}`);
    return;
  }

  // 2. Delete optimistically from cache
  updateCachesWithItem(backup, true);
  adjustStats(backup.type, -1);

  // 3. For cascade-parent types, nuke the whole cache so child items (workspaces,
  //    projects, tasks, role_assignments) are refetched fresh from the server
  //    instead of lingering as orphans in every view.
  const cascadeTypes = ["organization", "workspace", "project"];
  if (cascadeTypes.includes(backup.type)) {
    cache.items.clear();
    cache.singleItems.clear();
  }

  broadcastChange();

  try {
    const res = await apiFetch(`${BASE}/items/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete item: ${res.statusText}`);
  } catch (err: any) {
    // 4. Rollback on failure — restore backup and re-populate cache
    updateCachesWithItem(backup);
    adjustStats(backup.type, 1);
    broadcastChange();
    if (backup.type !== "notification") {
      triggerSystemError(`Delete ${backup.type} Failed`, err.message || "Unknown communication fault", backup.type);
    }
    throw err;
  }
}


// ============================================================
// STATS (Dashboard live data)
// ============================================================

export interface DashboardStats {
  tasks: number;
  notes: number;
  workspaces: number;
  balance: number;
  income: number;
  expense: number;
}

export async function getStats(): Promise<DashboardStats> {
  const cached = cache.stats;

  const fetchPromise = async () => {
    const res = await apiFetch(`${BASE}/stats`);
    if (!res.ok) throw new Error("Failed to fetch stats");
    const data = await res.json();

    const currentCachedStr = JSON.stringify(cached || null);
    const newFetchedStr = JSON.stringify(data);

    if (currentCachedStr !== newFetchedStr) {
      cache.stats = data;
      broadcastChange();
    }
    return clone(data);
  };

  if (cached) {
    fetchPromise().catch(err => console.warn("Background revalidation failed for getStats:", err));
    return Promise.resolve(clone(cached));
  }

  const freshData = await fetchPromise();
  return freshData;
}

// ============================================================
// FILES (Google Drive-backed)
// ============================================================

export interface StorageFile {
  id: string;
  name: string;
  drive_file_id: string;
  drive_url: string;
  drive_download_url: string;
  mime_type: string;
  size_bytes: number;
  item_id: string | null;
  created_at: string;
}

export async function getFiles(itemId?: string): Promise<StorageFile[]> {
  const cacheKey = itemId ? `item_${itemId}` : "all_files";
  const cached = cache.items.get(cacheKey);

  const fetchPromise = async () => {
    const url = itemId ? `${BASE}/files?item_id=${itemId}` : `${BASE}/files`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error("Failed to fetch files");
    const data = await res.json();

    if (JSON.stringify(cached || []) !== JSON.stringify(data)) {
      cache.items.set(cacheKey, data);
      broadcastChange();
    }
    return clone(data);
  };

  if (cached) {
    fetchPromise().catch(err => console.warn("Background revalidation failed for getFiles:", err));
    return Promise.resolve(clone(cached) as StorageFile[]);
  }

  const freshData = await fetchPromise();
  return freshData as StorageFile[];
}

export async function uploadFile(
  file: File,
  itemId?: string,
  onProgress?: (percent: number) => void
): Promise<StorageFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (itemId) formData.append("item_id", itemId);

  const token = getAuthToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/upload`);

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status === 201) {
        const fileData = JSON.parse(xhr.responseText);
        // Clear files cache on successful upload so it re-fetches
        const cacheKey = itemId ? `item_${itemId}` : "all_files";
        cache.items.delete(cacheKey);
        cache.items.delete("all_files");
        broadcastChange();
        resolve(fileData);
      } else {
        reject(new Error(`Upload failed: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const res = await apiFetch(`${BASE}/files/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete file: ${res.statusText}`);
  // Invalidate files caches
  for (const key of Array.from(cache.items.keys())) {
    if (key.startsWith("item_") || key === "all_files") {
      cache.items.delete(key);
    }
  }
  broadcastChange();
}

// ============================================================
// SETTINGS
// ============================================================

export interface AppSettings {
  profile_name?: string;
  profile_avatar?: string;
  profile_role?: string;
  email?: string;
  dob?: string;
  theme?: "light" | "dark" | "system";
  accent_color?: string;
  gemini_api_key?: string;
  supabase_url?: string;
  timezone?: string;
  date_format?: string;
  notifications_enabled?: boolean;
  system_name?: string;
  ui_animations_enabled?: boolean;
  ui_grid_enabled?: boolean;
  sound_volume?: number;
  ui_font_preset?: "sans" | "mono" | "cyber" | "futuristic";
  ui_grid_size?: "dense" | "medium" | "wide";
  ui_glass_opacity?: number;
}

export async function getSettings(): Promise<AppSettings> {
  const cached = cache.settings;

  const fetchPromise = async () => {
    const res = await apiFetch(`${BASE}/settings`);
    if (!res.ok) return {};
    const data = await res.json();

    const currentCachedStr = JSON.stringify(cached || null);
    const newFetchedStr = JSON.stringify(data);

    if (currentCachedStr !== newFetchedStr) {
      cache.settings = data;
      broadcastChange();
    }
    return clone(data);
  };

  if (cached) {
    fetchPromise().catch(err => console.warn("Background revalidation failed for getSettings:", err));
    return Promise.resolve(clone(cached));
  }

  const freshData = await fetchPromise();
  return freshData;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const backup = clone(cache.settings);
  cache.settings = { ...cache.settings, ...settings };
  broadcastChange();

  try {
    const res = await apiFetch(`${BASE}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to save settings: ${res.statusText}`);
    const data = await res.json();
    cache.settings = data;
    broadcastChange();
    return data;
  } catch (err: any) {
    cache.settings = backup;
    broadcastChange();
    triggerSystemError("Save Settings Failed", err.message || "Unknown communication fault", "settings");
    throw err;
  }
}
