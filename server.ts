import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";
import multer from "multer";
import dns from "dns";
import { promisify } from "util";
import { supabase } from "./lib/supabase.js";
import { appendToSheet, ensureSheetHeaders, testSheetsConnection } from "./lib/google-sheets.js";
import { uploadFileToDrive, deleteFileFromDrive, testDriveConnection } from "./lib/google-drive.js";

dotenv.config();

const lookup = promisify(dns.lookup);

// SSRF & DNS Rebinding Security Check
async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    
    const hostname = parsed.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return false;
    
    // DNS resolution check to block spoofed/private loopbacks
    const { address } = await lookup(hostname);
    
    const isPrivate = 
      address.startsWith("127.") || 
      address.startsWith("10.") || 
      address.startsWith("192.168.") || 
      address.startsWith("169.254.") ||
      address === "0.0.0.0" ||
      address === "::1" ||
      address.startsWith("fc00:") ||
      address.startsWith("fe80:") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(address);
      
    return !isPrivate;
  } catch {
    return false;
  }
}

// Stored XSS Prevention: Safe Recursive Input Escape & Sanitizer
function sanitizeString(str: string, isRichText = false): string {
  if (isRichText) {
    // Rich text editor support: strip active scripts, iframes, and dangerous attributes
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, "")
      .replace(/javascript\s*:\s*/gi, "no-js:");
  } else {
    // Escape HTML tags to prevent HTML injection while preserving normal text characters like / or '
    return str
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

// Block active protocols like javascript: or data: from links while preserving clean HTTP/HTTPS links
function sanitizeUrl(str: string): string {
  const cleaned = str.trim();
  if (/^(javascript|data):/i.test(cleaned)) {
    return "about:blank";
  }
  return cleaned;
}

function sanitizeObject(
  obj: any,
  isRichTextKey = (key: string) => key === "content",
  isUrlKey = (key: string) => ["url", "host_url", "github_url"].includes(key)
): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item, isRichTextKey, isUrlKey));
  if (typeof obj === "object") {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === "string") {
          if (isRichTextKey(key)) {
            sanitized[key] = sanitizeString(obj[key], true);
          } else if (isUrlKey(key)) {
            sanitized[key] = sanitizeUrl(obj[key]);
          } else {
            sanitized[key] = sanitizeString(obj[key], false);
          }
        } else {
          sanitized[key] = sanitizeObject(obj[key], isRichTextKey, isUrlKey);
        }
      }
    }
    return sanitized;
  }
  return obj;
}

// API Abuse & DoS Protection: Lightweight In-Memory Rate Limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function rateLimiter(limit: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown-client";
    const clientIp = Array.isArray(ip) ? ip[0] : (typeof ip === "string" ? ip.split(",")[0].trim() : "unknown");
    const now = Date.now();
    
    let record = rateLimitStore.get(clientIp);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
    }
    
    record.count++;
    rateLimitStore.set(clientIp, record);
    
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - record.count));
    res.setHeader("X-RateLimit-Reset", Math.round(record.resetTime / 1000));
    
    if (record.count > limit) {
      return res.status(429).json({ 
        error: "Too many requests. Core rate limit exceeded. Please wait and try again." 
      });
    }
    next();
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB max

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Global Input Sanitizer Middleware
  app.use((req, res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }
    next();
  });

  // Security Headers Middleware
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/proxy")) {
      res.setHeader("X-Frame-Options", "DENY");
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Ensure Google Sheets has headers on startup (fire-and-forget)
  ensureSheetHeaders().catch(() => {});

  const apiLimiter = rateLimiter(150, 60 * 1000); // 150 requests per minute
  const uploadLimiter = rateLimiter(15, 60 * 60 * 1000); // 15 uploads per hour

  // ============================================================
  // ITEMS API (Supabase-backed, Sheet-logged)
  // ============================================================

  // ============================================================
  // AUTH HELPER & ENDPOINTS
  // ============================================================

  async function getAuthUser(req: any): Promise<any | null> {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const userId = authHeader.split(" ")[1];
    if (!userId) return null;

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", userId)
      .eq("type", "user")
      .single();

    if (error || !data) return null;
    const u = {
      ...data.data,
      id: data.id,
      type: data.type,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
    delete u.password_hash;
    return u;
  }

  function filterItemsForUser(items: any[], user: any, roleAssignments: any[]): any[] {
    // If no user, only show items with no user_id (public compatibility)
    if (!user) {
      return items.filter(item => !item.user_id);
    }

    const myRoles = roleAssignments.filter((r: any) => r.user_id === user.id && r.status !== "pending");
    const myPendingRoles = roleAssignments.filter((r: any) => r.user_id === user.id && r.status === "pending");

    // Helper to check workspace visibility
    const canSeeWorkspace = (workspaceId: string): boolean => {
      const ws = items.find(i => i.id === workspaceId && i.type === "workspace");
      if (!ws) return false;

      // Creator is always allowed
      if (ws.user_id === user.id) return true;

      // Explicit role in workspace
      const hasWsRole = myRoles.some(r => r.scope_type === "workspace" && r.scope_id === workspaceId);
      if (hasWsRole) return true;

      // Explicit pending role in workspace (for invitations to load details)
      const hasPendingWsRole = myPendingRoles.some(r => r.scope_type === "workspace" && r.scope_id === workspaceId);
      if (hasPendingWsRole) return true;

      // If it belongs to an organization, check guest isolation or admin/owner/member status
      if (ws.organization_id) {
        const isOrgGuest = myRoles.some(
          r => r.scope_type === "organization" && 
               r.scope_id === ws.organization_id && 
               r.role === "Guest"
        );
        if (isOrgGuest) {
          // Strict guest isolation: only workspaces explicitly assigned
          return hasWsRole || hasPendingWsRole;
        }

        const hasOrgRole = myRoles.some(
          r => r.scope_type === "organization" && 
               r.scope_id === ws.organization_id && 
               ["Owner", "Admin", "Member"].includes(r.role)
        );
        if (hasOrgRole) return true;
      }

      // Public compatibility
      if (!ws.user_id) return true;

      return false;
    };

    // Helper to check project visibility
    const canSeeProject = (projectId: string): boolean => {
      const proj = items.find(i => i.id === projectId && i.type === "project");
      if (!proj) return false;

      // Creator is always allowed
      if (proj.user_id === user.id) return true;

      // Explicit role in project
      const hasProjRole = myRoles.some(r => r.scope_type === "project" && r.scope_id === projectId);
      if (hasProjRole) return true;

      // Explicit pending role in project (for invitations to load details)
      const hasPendingProjRole = myPendingRoles.some(r => r.scope_type === "project" && r.scope_id === projectId);
      if (hasPendingProjRole) return true;

      // If it has a workspace_id, check workspace roles
      if (proj.workspace_id) {
        // User must be able to see the workspace
        if (canSeeWorkspace(proj.workspace_id)) {
          // Fetch workspace role
          const wsRoleAss = myRoles.find(r => r.scope_type === "workspace" && r.scope_id === proj.workspace_id);
          const wsRole = wsRoleAss ? wsRoleAss.role : null;

          // Also check organization Owner/Admin roles
          const wsItem = items.find(i => i.id === proj.workspace_id && i.type === "workspace");
          let isOrgAdmin = false;
          if (wsItem && wsItem.organization_id) {
            isOrgAdmin = myRoles.some(
              r => r.scope_type === "organization" && 
                   r.scope_id === wsItem.organization_id && 
                   ["Owner", "Admin"].includes(r.role)
            );
          }

          if (isOrgAdmin) return true;

          // Workspace Owner, Admin, or Editor see all projects in workspace
          if (["Owner", "Admin", "Editor"].includes(wsRole!)) return true;

          // Workspace Member or Viewer can only see explicitly assigned projects (handled above via hasProjRole)
        }
      }

      // Public compatibility
      if (!proj.user_id) return true;

      return false;
    };

    // Helper to check role assignment visibility
    const canSeeRoleAssignment = (ra: any): boolean => {
      // Always allowed to see own assignment
      if (ra.user_id === user.id) return true;

      // Organization level assignments
      if (ra.scope_type === "organization") {
        // Can see if they are active Owner, Admin, or Member in the organization
        const hasOrgAccess = myRoles.some(
          r => r.scope_type === "organization" && 
               r.scope_id === ra.scope_id && 
               ["Owner", "Admin", "Member"].includes(r.role)
        );
        return hasOrgAccess;
      }

      // Workspace level assignments
      if (ra.scope_type === "workspace") {
        return canSeeWorkspace(ra.scope_id);
      }

      // Project level assignments
      if (ra.scope_type === "project") {
        return canSeeProject(ra.scope_id);
      }

      return false;
    };

    return items.filter((item: any) => {
      // Allow user items and role_assignment items themselves to be loaded
      if (item.type === "user") {
        return true;
      }
      if (item.type === "role_assignment") {
        return canSeeRoleAssignment(item);
      }

      // Public items (backwards compatibility)
      if (!item.user_id) return true;

      // Creator always sees their items
      if (item.user_id === user.id) return true;

      // Type-specific filters
      if (item.type === "organization") {
        // Creator always sees their items, and users with active non-Guest organization roles, or pending roles
        const hasActiveRole = myRoles.some(r => r.scope_type === "organization" && r.scope_id === item.id && r.role !== "Guest");
        const hasPendingRole = myPendingRoles.some(r => r.scope_type === "organization" && r.scope_id === item.id);
        return item.user_id === user.id || hasActiveRole || hasPendingRole;
      }

      if (item.type === "workspace") {
        return canSeeWorkspace(item.id);
      }

      if (item.type === "project") {
        return canSeeProject(item.id);
      }

      if (item.type === "task") {
        if (item.project_id) {
          return canSeeProject(item.project_id);
        }
        if (item.workspace_id) {
          return canSeeWorkspace(item.workspace_id);
        }
        return false; // Standalone task that isn't created by me and has user_id is hidden
      }

      if (item.type === "tool") {
        if (item.is_default) return true;
        if (item.organization_id) {
          return myRoles.some(r => r.scope_type === "organization" && r.scope_id === item.organization_id);
        }
        return false;
      }

      // For other types (notes, events, transactions, quick links, files, etc.)
      if (item.workspace_id) {
        return canSeeWorkspace(item.workspace_id);
      }
      if (item.project_id) {
        return canSeeProject(item.project_id);
      }

      // Otherwise, since item.user_id !== user.id, it is a private standalone item of another user
      return false;
    });
  }

  async function checkWriteAccess(
    user: any,
    type: string,
    itemId: string | null,
    targetWorkspaceId: string | null = null,
    targetProjectId: string | null = null,
    isDelete = false,
    newData: any = null
  ): Promise<boolean> {
    if (!user) return false;

    // 1. User profile modification
    if (type === "user") {
      return itemId === user.id;
    }

    // 2. Fetch existing item if itemId is provided
    let existingItem: any = null;
    if (itemId) {
      const { data } = await supabase.from("items").select("*").eq("id", itemId).single();
      if (data) {
        existingItem = {
          ...data.data,
          id: data.id,
          type: data.type,
        };
      }
    }

    const itemType = existingItem ? existingItem.type : type;
    const creatorId = existingItem ? existingItem.user_id : null;

    // Creator always has write access (except for role assignments, where we require strict validation)
    if (creatorId && creatorId === user.id && itemType !== "role_assignment") {
      return true;
    }

    // Fetch all role assignments
    const { data: roleAssRows } = await supabase.from("items").select("*").eq("type", "role_assignment");
    const roleAssignments = (roleAssRows || []).map((row: any) => ({
      ...row.data,
      id: row.id,
    }));
    const myRoles = roleAssignments.filter((r: any) => r.user_id === user.id && r.status !== "pending");

    const getWorkspace = async (wsId: string) => {
      const { data } = await supabase.from("items").select("*").eq("id", wsId).eq("type", "workspace").single();
      return data ? { ...data.data, id: data.id } : null;
    };

    const getProject = async (projId: string) => {
      const { data } = await supabase.from("items").select("*").eq("id", projId).eq("type", "project").single();
      return data ? { ...data.data, id: data.id } : null;
    };

    const hasOrgAdmin = (orgId: string): boolean => {
      return myRoles.some(r => r.scope_type === "organization" && r.scope_id === orgId && ["Owner", "Admin"].includes(r.role));
    };

    const hasOrgOwner = (orgId: string): boolean => {
      return myRoles.some(r => r.scope_type === "organization" && r.scope_id === orgId && r.role === "Owner");
    };

    const hasWorkspaceAdmin = async (wsId: string): Promise<boolean> => {
      const ws = await getWorkspace(wsId);
      if (ws?.organization_id && hasOrgAdmin(ws.organization_id)) return true;
      return myRoles.some(r => r.scope_type === "workspace" && r.scope_id === wsId && ["Owner", "Admin"].includes(r.role));
    };

    const hasWorkspaceWrite = async (wsId: string): Promise<boolean> => {
      const ws = await getWorkspace(wsId);
      if (ws?.organization_id && hasOrgAdmin(ws.organization_id)) return true;
      return myRoles.some(
        r => r.scope_type === "workspace" && 
             r.scope_id === wsId && 
             ["Owner", "Admin", "Editor", "Member"].includes(r.role)
      );
    };

    const hasProjectWrite = async (projId: string): Promise<boolean> => {
      const proj = await getProject(projId);
      if (proj?.workspace_id) {
        if (await hasWorkspaceAdmin(proj.workspace_id)) return true;
        const wsRole = myRoles.find(r => r.scope_type === "workspace" && r.scope_id === proj.workspace_id)?.role;
        if (wsRole === "Editor" || wsRole === "Member") return true;
      }
      return myRoles.some(
        r => r.scope_type === "project" && 
             r.scope_id === projId && 
             ["Project Lead", "Contributor"].includes(r.role)
      );
    };

    // Brand new item creation
    if (!itemId) {
      if (itemType === "organization") {
        return true;
      }
      if (itemType === "workspace") {
        const orgId = targetWorkspaceId;
        if (!orgId) return true;
        return hasOrgAdmin(orgId);
      }
      if (itemType === "project") {
        const wsId = targetWorkspaceId;
        if (!wsId) return true;
        return await hasWorkspaceWrite(wsId);
      }
      if (itemType === "role_assignment") {
        const sType = targetWorkspaceId;
        const sId = targetProjectId;
        if (sType === "organization") return hasOrgAdmin(sId);
        if (sType === "workspace") return await hasWorkspaceAdmin(sId);
        if (sType === "project") {
          const proj = await getProject(sId);
          if (proj?.workspace_id && await hasWorkspaceAdmin(proj.workspace_id)) return true;
          return myRoles.some(r => r.scope_type === "project" && r.scope_id === sId && r.role === "Project Lead");
        }
        return false;
      }

      if (itemType === "tool") {
        const orgId = existingItem ? existingItem.organization_id : (targetWorkspaceId || null);
        if (orgId) return hasOrgAdmin(orgId);
        return true;
      }

      // Standalone tasks, notes, etc.
      if (targetProjectId) return await hasProjectWrite(targetProjectId);
      if (targetWorkspaceId) return await hasWorkspaceWrite(targetWorkspaceId);
      return true;
    }

    // Existing resource update/delete
    if (itemType === "organization") {
      const orgId = itemId;
      if (isDelete) return hasOrgOwner(orgId);
      return hasOrgAdmin(orgId);
    }

    if (itemType === "workspace") {
      const wsId = itemId;
      const orgId = existingItem?.organization_id;
      if (isDelete) {
        return orgId ? hasOrgOwner(orgId) : false;
      }
      return await hasWorkspaceAdmin(wsId) || (orgId ? hasOrgAdmin(orgId) : false);
    }

    if (itemType === "project") {
      const projId = itemId;
      const wsId = existingItem?.workspace_id;
      if (isDelete) {
        return wsId ? await hasWorkspaceAdmin(wsId) : false;
      }
      return await hasProjectWrite(projId) || (wsId ? await hasWorkspaceAdmin(wsId) : false);
    }

    if (itemType === "role_assignment") {
      const sType = existingItem ? existingItem.scope_type : targetWorkspaceId;
      const sId = existingItem ? existingItem.scope_id : targetProjectId;
      
      let isScopeAdmin = false;
      if (sType === "organization") isScopeAdmin = hasOrgAdmin(sId);
      if (sType === "workspace") isScopeAdmin = await hasWorkspaceAdmin(sId);
      if (sType === "project") {
        const proj = await getProject(sId);
        if (proj?.workspace_id && await hasWorkspaceAdmin(proj.workspace_id)) {
          isScopeAdmin = true;
        } else {
          isScopeAdmin = myRoles.some(r => r.scope_type === "project" && r.scope_id === sId && r.role === "Project Lead");
        }
      }

      if (isScopeAdmin) return true;

      // Invitee can update status or delete their own role assignment if it is pending
      if (existingItem && existingItem.user_id === user.id) {
        if (isDelete) {
          return existingItem.status === "pending";
        }
        if (newData && existingItem.status === "pending") {
          // Verify that they are only transitioning the status and not escalating roles/scopes/users
          const hasEscalated =
            (newData.role && newData.role !== existingItem.role) ||
            (newData.scope_type && newData.scope_type !== existingItem.scope_type) ||
            (newData.scope_id && newData.scope_id !== existingItem.scope_id) ||
            (newData.user_id && newData.user_id !== existingItem.user_id);
          return !hasEscalated;
        }
      }

      return false;
    }

    if (itemType === "tool") {
      const orgId = existingItem?.organization_id;
      if (orgId) return hasOrgAdmin(orgId);
      return false; // If not org admin, fallback below will catch it
    }

    const wsId = existingItem?.workspace_id;
    const projId = existingItem?.project_id;
    if (projId) return await hasProjectWrite(projId);
    if (wsId) return await hasWorkspaceWrite(wsId);

    return false;
  }

  app.post("/api/auth/register", apiLimiter, async (req, res) => {
    const { username, password, displayName, roleTitle, avatarUrl, email, dob } = req.body;
    if (!username || !password || !displayName || !email || !dob) {
      return res.status(400).json({ error: "Missing required fields (username, password, displayName, email, dob)" });
    }

    // Business Logic Validation
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Username pattern check (3-20 characters, alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ 
        error: "Username must be 3-20 characters long and contain only letters, numbers, underscores, or hyphens." 
      });
    }

    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    // 3. Password length check
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    // 4. DOB range validation
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: "Please provide a valid date of birth." });
    }
    const today = new Date();
    if (dobDate > today) {
      return res.status(400).json({ error: "Date of birth cannot be in the future." });
    }
    const minAgeDate = new Date();
    minAgeDate.setFullYear(today.getFullYear() - 13);
    if (dobDate > minAgeDate) {
      return res.status(400).json({ error: "You must be at least 13 years old to register." });
    }

    try {
      // Check if username or email already exists by searching items of type 'user'
      const { data: existingUsers, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("type", "user");

      if (fetchError) return res.status(500).json({ error: fetchError.message });

      const duplicateUsername = (existingUsers || []).some(
        (row: any) => row.data?.username?.toLowerCase() === username.toLowerCase()
      );

      if (duplicateUsername) {
        return res.status(400).json({ error: "Username is already taken" });
      }

      const duplicateEmail = (existingUsers || []).some(
        (row: any) => row.data?.email?.toLowerCase() === email.toLowerCase()
      );

      if (duplicateEmail) {
        return res.status(400).json({ error: "Email address is already in use" });
      }

      // Secure hashing via Node crypto (safe from node-gyp build failures on Windows)
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.createHmac("sha256", salt).update(password).digest("hex");
      const password_hash = `${salt}:${hash}`;

      const rowId = crypto.randomUUID();
      const userData = {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        dob,
        password_hash,
        display_name: displayName,
        role_title: roleTitle || "Member",
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      };

      const { data: row, error: insertError } = await supabase
        .from("items")
        .insert({ id: rowId, type: "user", data: userData })
        .select()
        .single();

      if (insertError) return res.status(500).json({ error: insertError.message });

      // Automatically log the user in by returning their profile (excluding credentials)
      res.status(201).json({
        id: rowId,
        username: userData.username,
        email: userData.email,
        dob: userData.dob,
        display_name: userData.display_name,
        role_title: userData.role_title,
        avatar_url: userData.avatar_url,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", apiLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username/Email and password are required" });
    }

    try {
      const { data: users, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("type", "user");

      if (fetchError) return res.status(500).json({ error: fetchError.message });

      // Smart match username OR email (passed in the username parameter)
      const foundRow = (users || []).find(
        (row: any) => 
          row.data?.username?.toLowerCase() === username.toLowerCase() ||
          row.data?.email?.toLowerCase() === username.toLowerCase()
      );

      if (!foundRow) {
        return res.status(401).json({ error: "Invalid username, email, or password" });
      }

      const userData = foundRow.data;
      const [salt, storedHash] = userData.password_hash.split(":");
      const computedHash = crypto.createHmac("sha256", salt).update(password).digest("hex");

      if (computedHash !== storedHash) {
        return res.status(401).json({ error: "Invalid username, email, or password" });
      }

      res.json({
        id: foundRow.id,
        username: userData.username,
        email: userData.email || "",
        dob: userData.dob || "",
        display_name: userData.display_name,
        role_title: userData.role_title,
        avatar_url: userData.avatar_url,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Login failed" });
    }
  });

  app.get("/api/auth/session", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.json(user);
  });

  app.post("/api/auth/change-password", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both current password and new password are required." });
    }

    try {
      const { data: userRow, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("id", user.id)
        .eq("type", "user")
        .single();

      if (fetchError || !userRow) {
        return res.status(404).json({ error: "User record not found." });
      }

      const userData = userRow.data;
      const [salt, storedHash] = userData.password_hash.split(":");
      const computedHash = crypto.createHmac("sha256", salt).update(currentPassword).digest("hex");

      if (computedHash !== storedHash) {
        return res.status(400).json({ error: "Incorrect current password." });
      }

      // Strict complexity validations
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Your new password must be at least 8 characters long." });
      }
      const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/])[A-Za-z\d@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/]{8,}$/;
      if (!complexityRegex.test(newPassword)) {
        return res.status(400).json({ 
          error: "Your new password must include an uppercase letter, a lowercase letter, a number, and a symbol (e.g. @, $, !, #, %, *, ?, &)." 
        });
      }

      // Secure new hash generation
      const newSalt = crypto.randomBytes(16).toString("hex");
      const newHash = crypto.createHmac("sha256", newSalt).update(newPassword).digest("hex");
      const newPasswordHash = `${newSalt}:${newHash}`;

      const updatedUserData = {
        ...userData,
        password_hash: newPasswordHash,
      };

      const { error: updateError } = await supabase
        .from("items")
        .update({
          data: updatedUserData,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (updateError) return res.status(500).json({ error: updateError.message });

      res.json({ message: "Password updated successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update password." });
    }
  });

  // Exact user lookup for invitations
  app.post("/api/users/lookup", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const { data: existingUsers, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("type", "user");

    if (fetchError) return res.status(500).json({ error: fetchError.message });

    const user = (existingUsers || []).find(
      (row: any) => row.data?.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ error: "No user found with that email address" });
    }

    res.json({
      id: user.id,
      email: user.data.email,
      display_name: user.data.display_name,
      avatar_url: user.data.avatar_url
    });
  });

  app.get("/api/users", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data: rows, error } = await supabase
      .from("items")
      .select("*")
      .eq("type", "user");

    if (error) return res.status(500).json({ error: error.message });

    const users = (rows || []).map((row: any) => ({
      id: row.id,
      username: row.data.username,
      email: row.data.email || "",
      dob: row.data.dob || "",
      display_name: row.data.display_name,
      role_title: row.data.role_title,
      avatar_url: row.data.avatar_url,
    }));

    res.json(users);
  });

  // ============================================================
  // ITEMS API (Supabase-backed, Sheet-logged, Dynamic RBAC Filtered)
  // ============================================================

  app.get("/api/items", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    const { type } = req.query;

    let query = supabase.from("items").select("*").order("created_at", { ascending: false });
    
    // Optimize: Filter at DB level to prevent loading the entire database into memory.
    // We must always fetch structural metadata types so relationship and RBAC logics work correctly.
    const structuralTypes = ["organization", "workspace", "project", "role_assignment"];
    if (type && !structuralTypes.includes(type as string)) {
      query = query.in("type", [type as string, ...structuralTypes]);
    } else if (type) {
      query = query.in("type", structuralTypes);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Map and flatten
    const allItems = (data || []).map((row: any) => {
      const item = {
        ...row.data,
        id: row.id,
        type: row.type,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      if (item.type === "user") {
        delete item.password_hash;
      }
      return item;
    });

    // Find role assignments
    const roleAssignments = allItems.filter(i => i.type === "role_assignment");

    // Perform permission filtration
    const filteredItems = filterItemsForUser(allItems, user, roleAssignments);

    // If a specific type was requested, filter for that type post-permission filtration
    if (type) {
      return res.json(filteredItems.filter(item => item.type === type));
    }

    res.json(filteredItems);
  });

  app.post("/api/items", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id, type, ...data } = req.body;
    const rowId = id || crypto.randomUUID();

    // IDOR Protection Validation
    const targetWorkspaceId = data.workspace_id || data.organization_id || data.scope_type || null;
    const targetProjectId = data.project_id || data.scope_id || null;

    const authorized = await checkWriteAccess(user, type, null, targetWorkspaceId, targetProjectId, false, data);
    if (!authorized) {
      return res.status(403).json({ error: "Forbidden: You do not have permissions to perform this operation." });
    }

    // Assign owner/creator ID
    if (!data.user_id) {
      data.user_id = user.id;
    }

    const { data: row, error } = await supabase
      .from("items")
      .insert({ id: rowId, type, data })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Backup to Google Sheets (non-blocking)
    appendToSheet(type, rowId, "CREATE", data).catch(() => {});

    res.status(201).json({ ...data, id: rowId, type });
  });

  app.put("/api/items/:id", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { type, ...data } = req.body;

    // IDOR Protection Validation
    const targetWorkspaceId = data.workspace_id || data.organization_id || data.scope_type || null;
    const targetProjectId = data.project_id || data.scope_id || null;

    const authorized = await checkWriteAccess(user, type || "", id, targetWorkspaceId, targetProjectId, false, data);
    if (!authorized) {
      return res.status(403).json({ error: "Forbidden: You do not have permissions to perform this operation." });
    }

    const { data: existingRow } = await supabase.from("items").select("*").eq("id", id).single();

    // Shallow merge incoming data with existing data to prevent dropping other fields (especially credentials)
    const mergedData = existingRow ? { ...existingRow.data, ...data } : data;

    // Keep original user_id
    if (existingRow && existingRow.data?.user_id) {
      mergedData.user_id = existingRow.data.user_id;
    } else if (!mergedData.user_id) {
      mergedData.user_id = user.id;
    }

    const { error } = await supabase
      .from("items")
      .update({ data: mergedData, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    // Backup to Google Sheets (non-blocking)
    appendToSheet(type || (existingRow?.type), id, "UPDATE", mergedData).catch(() => {});

    res.json({ id, type: type || existingRow?.type, ...mergedData });
  });

  app.delete("/api/items/:id", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    // Fetch type before deleting (for sheet backup and security checks)
    const { data: existing } = await supabase.from("items").select("type, data").eq("id", id).single();
    if (!existing) {
      return res.status(404).json({ error: "Item not found" });
    }

    const authorized = await checkWriteAccess(user, existing.type, id, null, null, true);
    if (!authorized) {
      return res.status(403).json({ error: "Forbidden: You do not have permissions to perform this operation." });
    }

    // Application-Level Cascade Deletion for JSONB Hierarchy
    async function cascadeDelete(parentId: string, parentType: string) {
      let childIdsToDelete: {id: string, type: string, data: any}[] = [];

      if (parentType === "organization") {
        // Child Workspaces
        const { data: ws } = await supabase.from("items").select("id, type, data").eq("type", "workspace").contains("data", { organization_id: parentId });
        if (ws) childIdsToDelete.push(...ws);
        
        // Associated Role Assignments
        const { data: ra } = await supabase.from("items").select("id, type, data").eq("type", "role_assignment").contains("data", { scope_type: "organization", scope_id: parentId });
        if (ra) childIdsToDelete.push(...ra);
      } else if (parentType === "workspace") {
        // Child Projects
        const { data: prj } = await supabase.from("items").select("id, type, data").eq("type", "project").contains("data", { workspace_id: parentId });
        if (prj) childIdsToDelete.push(...prj);
        
        // Child Tasks, Notes, Transactions (anything with workspace_id)
        const { data: others } = await supabase.from("items").select("id, type, data").contains("data", { workspace_id: parentId });
        if (others) childIdsToDelete.push(...others.filter(o => o.type !== "project"));

        // Associated Role Assignments
        const { data: ra } = await supabase.from("items").select("id, type, data").eq("type", "role_assignment").contains("data", { scope_type: "workspace", scope_id: parentId });
        if (ra) childIdsToDelete.push(...ra);
      } else if (parentType === "project") {
        // Child Tasks
        const { data: tasks } = await supabase.from("items").select("id, type, data").contains("data", { project_id: parentId });
        if (tasks) childIdsToDelete.push(...tasks);

        // Associated Role Assignments
        const { data: ra } = await supabase.from("items").select("id, type, data").eq("type", "role_assignment").contains("data", { scope_type: "project", scope_id: parentId });
        if (ra) childIdsToDelete.push(...ra);
      }

      for (const child of childIdsToDelete) {
        // Recursively trigger deletion on container types BEFORE deleting them
        if (["workspace", "project"].includes(child.type)) {
          await cascadeDelete(child.id, child.type);
        }
        await supabase.from("items").delete().eq("id", child.id);
        appendToSheet(child.type, child.id, "DELETE", child.data).catch(() => {});
      }
    }

    // Process cascade before deleting the root item
    await cascadeDelete(id, existing.type);

    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    if (existing) {
      appendToSheet(existing.type, id, "DELETE", existing.data).catch(() => {});
    }

    res.status(204).send();
  });

  // ============================================================
  // DASHBOARD STATS (Role-Filtered)
  // ============================================================

  app.get("/api/stats", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);

    // Fetch all items from items table to filter them properly based on roles
    const { data: allDbRows, error } = await supabase.from("items").select("*");
    if (error) return res.status(500).json({ error: error.message });

    const allItems = (allDbRows || []).map((row: any) => ({
      ...row.data,
      id: row.id,
      type: row.type,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const roleAssignments = allItems.filter(i => i.type === "role_assignment");
    const filteredItems = filterItemsForUser(allItems, user, roleAssignments);

    const tasks = filteredItems.filter(i => i.type === "task");
    const notes = filteredItems.filter(i => i.type === "note");
    const workspaces = filteredItems.filter(i => i.type === "workspace");
    const transactions = filteredItems.filter(i => i.type === "transaction");

    const income = transactions.filter((t) => t.transaction_type === "income").reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const expense = transactions.filter((t) => t.transaction_type === "expense").reduce((s: number, t: any) => s + (t.amount || 0), 0);

    res.json({
      tasks: tasks.length,
      notes: notes.length,
      workspaces: workspaces.length,
      balance: income - expense,
      income,
      expense,
    });
  });

  // ============================================================
  // FILE VAULT API (Google Drive-backed, Role-Filtered)
  // ============================================================

  app.get("/api/files", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    const { item_id } = req.query;

    let query = supabase.from("files").select("*").order("created_at", { ascending: false });
    if (item_id) query = query.eq("item_id", item_id as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (user && item_id) {
      const { data: itemData } = await supabase.from("items").select("*").eq("id", item_id as string).single();
      if (itemData) {
        const item = { ...itemData.data, id: itemData.id, type: itemData.type };
        const { data: roleRows } = await supabase.from("items").select("*").eq("type", "role_assignment");
        const roleAssignments = (roleRows || []).map((row: any) => ({ ...row.data, id: row.id }));
        const filtered = filterItemsForUser([item], user, roleAssignments);
        if (filtered.length === 0) {
          return res.json([]);
        }
      }
    }

    res.json(data || []);
  });

  app.post("/api/upload", uploadLimiter, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const { item_id } = req.body;

    // Upload to Google Drive
    let driveFile = null;
    try {
      driveFile = await uploadFileToDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
    } catch (err: any) {
      return res.status(503).json({ 
        error: "Google Drive storage is offline or unreachable. Core data remains secure, but file uploads are disabled." 
      });
    }

    if (!driveFile) {
      return res.status(503).json({ 
        error: "Google Drive storage is unconfigured. Core data remains secure, but file uploads are disabled." 
      });
    }

    // Save metadata to Supabase
    const { data, error } = await supabase
      .from("files")
      .insert({
        name: driveFile.name,
        drive_file_id: driveFile.id,
        drive_url: driveFile.webViewLink,
        drive_download_url: driveFile.webContentLink,
        mime_type: driveFile.mimeType,
        size_bytes: driveFile.sizeBytes,
        item_id: item_id || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data);
  });

  app.delete("/api/files/:id", apiLimiter, async (req, res) => {
    const { id } = req.params;

    // Get Drive file ID first
    const { data: file } = await supabase.from("files").select("drive_file_id").eq("id", id).single();

    if (file?.drive_file_id) {
      try {
        await deleteFileFromDrive(file.drive_file_id);
      } catch (err) {
        console.error("Drive delete failed, still removing from DB:", err);
      }
    }

    const { error } = await supabase.from("files").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    res.status(204).send();
  });

  // ============================================================
  // SETTINGS API
  // ============================================================

  app.get("/api/settings", apiLimiter, async (req, res) => {
    const user = await getAuthUser(req);
    if (user) {
      // Return user-specific settings mapped to AppSettings directly from the user's item row
      const userSettings = {
        profile_name: user.display_name || user.username,
        profile_role: user.role_title || "Member",
        profile_avatar: user.avatar_url || "",
        email: user.email || "",
        dob: user.dob || "",
        theme: user.theme || "dark",
        accent_color: user.accent_color || "#22c55e",
        ui_font_preset: user.ui_font_preset || "sans",
        ui_grid_enabled: user.ui_grid_enabled !== false,
        ui_grid_size: user.ui_grid_size || "medium",
        ui_glass_opacity: user.ui_glass_opacity !== undefined ? user.ui_glass_opacity : 10,
        ui_animations_enabled: user.ui_animations_enabled !== false,
        sound_volume: user.sound_volume !== undefined ? user.sound_volume : 80,
        system_name: user.system_name || "MYOS",
        timezone: user.timezone || "Asia/Phnom_Penh",
        date_format: user.date_format || "DD/MM/YYYY",
        notifications_enabled: user.notifications_enabled !== false,
        gemini_api_key: user.gemini_api_key || "",
      };
      return res.json(userSettings);
    }

    // Fallback to global settings if not logged in
    const { data, error } = await supabase
      .from("items")
      .select("data")
      .eq("type", "setting")
      .single();

    if (error || !data) return res.json({});
    res.json(data.data);
  });

  app.put("/api/settings", apiLimiter, async (req, res) => {
    const settings = req.body;
    const user = await getAuthUser(req);

    if (user) {
      // Update specific user row in items table
      const { data: existingUserRow, error: fetchError } = await supabase
        .from("items")
        .select("*")
        .eq("id", user.id)
        .eq("type", "user")
        .single();

      if (fetchError || !existingUserRow) {
        return res.status(404).json({ error: "User record not found" });
      }

      // Email Validation
      if (settings.email !== undefined) {
        const cleanEmail = settings.email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({ error: "Please provide a valid email address." });
        }

        const { data: allUsers } = await supabase.from("items").select("*").eq("type", "user");
        const duplicateEmail = (allUsers || []).some(
          (row: any) => row.id !== user.id && row.data?.email?.toLowerCase() === cleanEmail
        );
        if (duplicateEmail) {
          return res.status(400).json({ error: "Email address is already in use." });
        }
      }

      // DOB Validation
      if (settings.dob !== undefined) {
        const dobDate = new Date(settings.dob);
        if (isNaN(dobDate.getTime())) {
          return res.status(400).json({ error: "Please provide a valid date of birth." });
        }
        const today = new Date();
        if (dobDate > today) {
          return res.status(400).json({ error: "Date of birth cannot be in the future." });
        }
        const minAgeDate = new Date();
        minAgeDate.setFullYear(today.getFullYear() - 13);
        if (dobDate > minAgeDate) {
          return res.status(400).json({ error: "You must be at least 13 years old." });
        }
      }

      const updatedUserData = {
        ...existingUserRow.data,
        display_name: settings.profile_name !== undefined ? settings.profile_name : existingUserRow.data.display_name,
        role_title: settings.profile_role !== undefined ? settings.profile_role : existingUserRow.data.role_title,
        avatar_url: settings.profile_avatar !== undefined ? settings.profile_avatar : existingUserRow.data.avatar_url,
        email: settings.email !== undefined ? settings.email.trim().toLowerCase() : existingUserRow.data.email,
        dob: settings.dob !== undefined ? settings.dob : existingUserRow.data.dob,
        theme: settings.theme !== undefined ? settings.theme : existingUserRow.data.theme,
        accent_color: settings.accent_color !== undefined ? settings.accent_color : existingUserRow.data.accent_color,
        ui_font_preset: settings.ui_font_preset !== undefined ? settings.ui_font_preset : existingUserRow.data.ui_font_preset,
        ui_grid_enabled: settings.ui_grid_enabled !== undefined ? settings.ui_grid_enabled : existingUserRow.data.ui_grid_enabled,
        ui_grid_size: settings.ui_grid_size !== undefined ? settings.ui_grid_size : existingUserRow.data.ui_grid_size,
        ui_glass_opacity: settings.ui_glass_opacity !== undefined ? settings.ui_glass_opacity : existingUserRow.data.ui_glass_opacity,
        ui_animations_enabled: settings.ui_animations_enabled !== undefined ? settings.ui_animations_enabled : existingUserRow.data.ui_animations_enabled,
        sound_volume: settings.sound_volume !== undefined ? settings.sound_volume : existingUserRow.data.sound_volume,
        system_name: settings.system_name !== undefined ? settings.system_name : existingUserRow.data.system_name,
        timezone: settings.timezone !== undefined ? settings.timezone : existingUserRow.data.timezone,
        date_format: settings.date_format !== undefined ? settings.date_format : existingUserRow.data.date_format,
        notifications_enabled: settings.notifications_enabled !== undefined ? settings.notifications_enabled : existingUserRow.data.notifications_enabled,
        gemini_api_key: settings.gemini_api_key !== undefined ? settings.gemini_api_key : existingUserRow.data.gemini_api_key,
      };

      const { error: updateError } = await supabase
        .from("items")
        .update({ 
          data: updatedUserData, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", user.id);

      if (updateError) return res.status(500).json({ error: updateError.message });

      const returnedSettings = {
        profile_name: updatedUserData.display_name || "",
        profile_role: updatedUserData.role_title || "Member",
        profile_avatar: updatedUserData.avatar_url || "",
        email: updatedUserData.email || "",
        dob: updatedUserData.dob || "",
        theme: updatedUserData.theme || "dark",
        accent_color: updatedUserData.accent_color || "#22c55e",
        ui_font_preset: updatedUserData.ui_font_preset || "sans",
        ui_grid_enabled: updatedUserData.ui_grid_enabled !== false,
        ui_grid_size: updatedUserData.ui_grid_size || "medium",
        ui_glass_opacity: updatedUserData.ui_glass_opacity !== undefined ? updatedUserData.ui_glass_opacity : 10,
        ui_animations_enabled: updatedUserData.ui_animations_enabled !== false,
        sound_volume: updatedUserData.sound_volume !== undefined ? updatedUserData.sound_volume : 80,
        system_name: updatedUserData.system_name || "MYOS",
        timezone: updatedUserData.timezone || "Asia/Phnom_Penh",
        date_format: updatedUserData.date_format || "DD/MM/YYYY",
        notifications_enabled: updatedUserData.notifications_enabled !== false,
        gemini_api_key: updatedUserData.gemini_api_key || "",
      };

      return res.json(returnedSettings);
    }

    // Fallback to global settings if not logged in
    const existing = await supabase.from("items").select("id").eq("type", "setting").single();

    if (existing.data) {
      const { error } = await supabase
        .from("items")
        .update({ data: settings })
        .eq("type", "setting");
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase
        .from("items")
        .insert({ id: crypto.randomUUID(), type: "setting", data: settings });
      if (error) return res.status(500).json({ error: error.message });
    }

    res.json(settings);
  });

  // ============================================================
  // INTEGRATIONS STATUS API
  // ============================================================

  app.get("/api/integrations/status", apiLimiter, async (_req, res) => {
    // 1. Check Supabase
    let supabaseStatus: "active" | "failed" | "unconfigured" = "unconfigured";
    let supabaseError: string | undefined;
    const sUrl = process.env.SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sUrl || !sKey || sUrl.includes("placeholder") || sKey.includes("placeholder-key")) {
      supabaseStatus = "unconfigured";
    } else {
      try {
        const { error } = await supabase.from("items").select("id").limit(1);
        if (error) {
          supabaseStatus = "failed";
          supabaseError = error.message;
        } else {
          supabaseStatus = "active";
        }
      } catch (err: any) {
        supabaseStatus = "failed";
        supabaseError = err.message || "Failed to reach Supabase server";
      }
    }

    // 2. Check Google Sheets
    let sheetsStatus: "active" | "failed" | "unconfigured" = "unconfigured";
    let sheetsError: string | undefined;
    try {
      const result = await testSheetsConnection();
      sheetsStatus = result.status;
      sheetsError = result.error;
    } catch (err: any) {
      sheetsStatus = "failed";
      sheetsError = err.message || "Failed to check Google Sheets status";
    }

    // 3. Check Google Drive
    let driveStatus: "active" | "failed" | "unconfigured" = "unconfigured";
    let driveError: string | undefined;
    try {
      const result = await testDriveConnection();
      driveStatus = result.status;
      driveError = result.error;
    } catch (err: any) {
      driveStatus = "failed";
      driveError = err.message || "Failed to check Google Drive status";
    }

    // 4. Check Gemini API
    let geminiStatus: "active" | "failed" | "unconfigured" = "unconfigured";
    let geminiError: string | undefined;
    try {
      let dbKey: string | undefined;
      try {
        const settingsResult = await supabase.from("items").select("data").eq("type", "setting").maybeSingle();
        dbKey = settingsResult.data?.data?.gemini_api_key;
      } catch (err) {
        // Fallback if supabase check failed
      }
      const geminiKey = dbKey || process.env.GEMINI_API_KEY;

      if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY" || geminiKey.trim() === "") {
        geminiStatus = "unconfigured";
      } else {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }]
          })
        });
        if (response.ok) {
          geminiStatus = "active";
        } else {
          const errData = await response.json().catch(() => ({}));
          geminiStatus = "failed";
          geminiError = errData.error?.message || `HTTP ${response.status} Error`;
        }
      }
    } catch (err: any) {
      geminiStatus = "failed";
      geminiError = err.message || "Gemini check failed";
    }

    res.json({
      supabase: { status: supabaseStatus, error: supabaseError },
      sheets: { status: sheetsStatus, error: sheetsError },
      drive: { status: driveStatus, error: driveError },
      gemini: { status: geminiStatus, error: geminiError },
    });
  });

  // ============================================================
  // BYPASS PROXY FOR IFRAME EMBEDDING
  // ============================================================
  app.get("/api/proxy", apiLimiter, async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("No target URL specified");

    const safe = await isSafeUrl(targetUrl);
    if (!safe) {
      return res.status(403).send("Forbidden: Local or private network ranges are blocked.");
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Encoding": "identity" // Disable compression to get raw uncompressed plain-text HTML
        }
      });
      
      const contentType = response.headers.get("content-type") || "";
      const finalUrl = response.url || targetUrl; // Follow redirects and target active URL base
      
      if (contentType.includes("html")) {
        let html = await response.text();
        
        // Inject <base href="..."> after head to resolve relative assets
        const baseTag = `<base href="${finalUrl}">`;
        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n${baseTag}`);
        } else if (html.includes("<HEAD>")) {
          html = html.replace("<HEAD>", `<HEAD>\n${baseTag}`);
        } else {
          html = `${baseTag}\n${html}`;
        }

        // Set response headers and clear frame-blocking tags
        res.setHeader("Content-Type", "text/html");
        res.setHeader("X-Frame-Options", "ALLOWALL");
        res.setHeader("Content-Security-Policy", "");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(html);
      } else {
        // Stream non-HTML assets (like Google Drive thumbnails/images) directly to bypass CORS & third-party cookie restrictions
        if (response.ok) {
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
          res.setHeader("Access-Control-Allow-Origin", "*");
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return res.send(buffer);
        } else {
          return res.redirect(finalUrl);
        }
      }
    } catch (err: any) {
      console.error("Proxy error:", err);
      return res.status(520).send(`Secure OS proxy failed to connect: ${err.message}`);
    }
  });

  // ============================================================
  // VITE DEV / PROD STATIC SERVE
  // ============================================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 MyOS Server running on http://localhost:${PORT}`);
    console.log(`   Supabase: ${process.env.SUPABASE_URL ? "✅ Connected" : "⚠️  Not configured (set SUPABASE_URL)"}`);
    console.log(`   Google Sheets: ${process.env.GOOGLE_SHEET_ID ? "✅ Configured" : "⚠️  Not configured (optional)"}`);
    console.log(`   Google Drive: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? "✅ Configured" : "⚠️  Not configured (file uploads disabled)"}\n`);
  });
}

startServer().catch(console.error);
