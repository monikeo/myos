import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveDriveImage(url: string | undefined): string {
  if (!url) return "";
  
  const trimmed = url.trim();
  
  // Handles drive.google.com and docs.google.com links
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    const patterns = [
      /\/d\/([a-zA-Z0-9_-]+)/,
      /[?&]id=([a-zA-Z0-9_-]+)/,
      /folders\/([a-zA-Z0-9_-]+)/,
      /open\?id=([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const driveId = match[1];
        const directUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
        // Automatically route Google Drive embeds through the secure local proxy to bypass browser cookie & CORS blocks
        return `/api/proxy?url=${encodeURIComponent(directUrl)}`;
      }
    }
  }
  
  return trimmed;
}

export function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed === "") return false;
  
  // Allow relative paths (e.g. /api/proxy)
  if (trimmed.startsWith("/")) return true;
  
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export function emitError(title: string, message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("myos:notification", {
        detail: {
          title,
          message,
          category: "system"
        }
      })
    );
  }
}

