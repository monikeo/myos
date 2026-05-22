import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen, Upload, File, Image, Video, FileText,
  Trash2, Download, Eye, Search, Grid3X3, List,
  HardDrive, CloudUpload, X, CheckCircle, AlertCircle, Loader2, ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFiles, uploadFile, deleteFile, StorageFile } from "@/lib/api";
import { cn, resolveDriveImage } from "@/lib/utils";

type ViewMode = "grid" | "list";
type FileFilter = "all" | "image" | "video" | "document";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileCategory(mimeType: string): FileFilter {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cat = getFileCategory(mimeType);
  if (cat === "image") return <Image className={className} />;
  if (cat === "video") return <Video className={className} />;
  return <FileText className={className} />;
}

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export function FileVaultView() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<FileFilter>("all");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean | null>(null);

  const checkDriveConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setIsDriveConnected(data.drive && data.drive.status === "active");
      } else {
        setIsDriveConnected(false);
      }
    } catch (err) {
      console.error("Failed to check Google Drive integration status:", err);
      setIsDriveConnected(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    try {
      const data = await getFiles();
      setFiles(data as any);
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || "Failed to sync metadata files list from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkDriveConnection();
    loadFiles();
  }, [loadFiles, checkDriveConnection]);

  const handleFiles = async (fileList: FileList) => {
    setDriveError(null); // Reset banner before starting uploads
    const newUploads: UploadItem[] = Array.from(fileList).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      status: "uploading",
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const uploadId = newUploads[i].id;
      try {
        await uploadFile(file, undefined, (pct) => {
          setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, progress: pct } : u));
        });
        setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, status: "done", progress: 100 } : u));
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "File Uploaded",
              message: `File "${file.name}" has been successfully uploaded to Drive.`,
              category: "file",
              link_to: "docs"
            }
          })
        );
      } catch (err: any) {
        setUploads((prev) => prev.map((u) => u.id === uploadId ? { ...u, status: "error", error: err.message || "Drive Offline" } : u));
        setDriveError(err.message || "Google Drive is offline. File writes are temporarily paused.");
      }
    }

    await loadFiles();
    setTimeout(() => setUploads((prev) => prev.filter((u) => u.status !== "done")), 3000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this file from Drive?")) return;
    const fileObj = files.find((f) => f.id === id);
    try {
      await deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (fileObj) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "File Deleted",
              message: `File "${fileObj.name}" has been permanently removed.`,
              category: "file",
              link_to: "docs"
            }
          })
        );
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  const filtered = files.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || getFileCategory(f.mime_type) === filter;
    return matchSearch && matchFilter;
  });

  const totalSize = files.reduce((s, f) => s + (f.size_bytes || 0), 0);

  const filterButtons: { id: FileFilter; label: string }[] = [
    { id: "all", label: "All Files" },
    { id: "image", label: "Images" },
    { id: "video", label: "Videos" },
    { id: "document", label: "Documents" },
  ];

  if (isDriveConnected === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-xs uppercase tracking-widest font-mono font-bold">Verifying Connection Integrity...</p>
      </div>
    );
  }

  if (isDriveConnected === false) {
    return (
      <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
          <div className="space-y-2">
            <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Files</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Files</h1>
            <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">
              Secure Personal File Vault (Locked)
            </p>
          </div>
        </div>

        {/* Lock Overlay */}
        <div className="relative border border-border/20 rounded-[5px] overflow-hidden bg-background/20 p-8 sm:p-16 text-center backdrop-blur-xl min-h-[500px] flex flex-col items-center justify-center space-y-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_70%)] pointer-events-none" />
          
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-xl opacity-60 animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-secondary/30 border border-border/30 flex items-center justify-center shadow-2xl backdrop-blur-2xl">
              <FolderOpen className="w-10 h-10 text-primary" />
            </div>
          </div>

          <div className="max-w-md space-y-3 relative z-10">
            <h2 className="text-2xl font-extrabold tracking-tight uppercase bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
              Vault Database Locked
            </h2>
            <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">
              To secure and structure your personal files database, MyOS links directly with your own Google Drive storage container. This page, database browser, and file upload features are locked because your Google Drive integration is currently inactive or unconfigured.
            </p>
          </div>

          <div className="w-full max-w-lg bg-secondary/10 border border-border/10 p-5 rounded-[5px] grid grid-cols-2 gap-4 text-left font-mono text-[10px] text-muted-foreground relative z-10">
            <div>
              <p className="uppercase tracking-widest text-muted-foreground/45 font-bold mb-0.5">Database Link</p>
              <p className="font-semibold text-foreground">Google Drive API v3</p>
            </div>
            <div>
              <p className="uppercase tracking-widest text-muted-foreground/45 font-bold mb-0.5">Link Mode</p>
              <p className="font-semibold text-foreground">OAuth 2.0 Client</p>
            </div>
            <div>
              <p className="uppercase tracking-widest text-muted-foreground/45 font-bold mb-0.5">Isolation Context</p>
              <p className="font-semibold text-foreground">User-Sandboxed AppData</p>
            </div>
            <div>
              <p className="uppercase tracking-widest text-muted-foreground/45 font-bold mb-0.5">Connection Status</p>
              <p className="font-bold text-amber-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" /> Unconfigured
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("myos:navigate", {
                  detail: { page: "settings" }
                })
              );
            }}
            className="relative z-10 rounded-[5px] shadow-[0_0_25px_rgba(59,130,246,0.25)] bg-primary hover:bg-primary/90 h-12 px-10 font-extrabold text-xs uppercase tracking-[0.2em] transition-all hover:scale-105"
          >
            Connect Google Drive
            <ExternalLink className="w-4 h-4 ml-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Resilient Drive Offline Warning */}
      {driveError && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-[5px] flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-500">Storage Offline</p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              The file storage service is currently unreachable. You can still manage other data, but file uploads and downloads are temporarily unavailable.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground ml-auto hover:bg-transparent" onClick={() => setDriveError(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-2">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Files</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Files</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">
            Cloud storage · {files.length} files · {formatBytes(totalSize)}
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-12 px-8 font-bold text-xs uppercase tracking-[0.2em]"
        >
          <Upload className="w-4 h-4 mr-3" />
          Upload Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Upload Queue */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center gap-4 p-4 bg-secondary/20 border border-border/30 rounded-[5px]">
              {u.status === "uploading" && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
              {u.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
              {u.status === "error" && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
              <span className="text-sm font-medium flex-1 truncate">{u.name}</span>
              {u.status === "uploading" && (
                <div className="w-32 h-1.5 bg-secondary rounded-[5px]-full overflow-hidden">
                  <div className="h-full bg-primary rounded-[5px]-full transition-all duration-300" style={{ width: `${u.progress}%` }} />
                </div>
              )}
              {u.status === "error" && <span className="text-xs text-red-500">{u.error}</span>}
              {u.status === "done" && <span className="text-xs text-emerald-500 font-bold font-mono">UPLOADED</span>}
            </div>
          ))}
        </div>
      )}

      {/* Drag Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-[5px] p-12 text-center cursor-pointer transition-all duration-300",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/30 hover:border-primary/40 hover:bg-secondary/20"
        )}
      >
        <CloudUpload className={cn("w-12 h-12 mx-auto mb-4 transition-colors", isDragging ? "text-primary" : "text-muted-foreground/30")} />
        <p className="font-bold text-sm uppercase tracking-widest text-muted-foreground/50">
          {isDragging ? "Drop to upload" : "Drag & drop files here, or click to select"}
        </p>
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-2 uppercase tracking-widest">
          Images · Videos · Documents · Up to 500MB per file
        </p>
      </div>

      {/* Filter + Search + View */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 bg-secondary/30 border-border/20 rounded-[5px] h-11"
          />
        </div>
        <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 overflow-x-auto max-w-full whitespace-nowrap scrollbar-none">
          {filterButtons.map((btn) => (
            <Button
              key={btn.id}
              variant={filter === btn.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(btn.id)}
              className={cn("rounded-[5px] text-[10px] uppercase font-bold tracking-widest px-4 h-9 whitespace-nowrap shrink-0", filter === btn.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
            >
              {btn.label}
            </Button>
          ))}
        </div>
        <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 shrink-0">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="w-9 h-9 rounded-[5px]" onClick={() => setViewMode("grid")}>
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="w-9 h-9 rounded-[5px]" onClick={() => setViewMode("list")}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Files Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <HardDrive className="w-16 h-16 mb-4 opacity-10" />
          <p className="font-bold uppercase tracking-widest text-sm">No files found</p>
          <p className="text-xs opacity-50 mt-1">Upload your first file above</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filtered.map((file) => (
            <Card
              key={file.id}
              className="group border border-border/50 bg-secondary/10 backdrop-blur-xl hover:border-primary/50 transition-all duration-300 rounded-[5px] overflow-hidden hover:-translate-y-1"
            >
              <div className="aspect-square bg-secondary/30 flex items-center justify-center relative overflow-hidden">
                {getFileCategory(file.mime_type) === "image" ? (
                  <img
                    src={file.drive_url?.replace("/view", "/preview") || ""}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <FileIcon mimeType={file.mime_type} className="w-12 h-12 text-primary/30" />
                )}
                <div className="absolute inset-0 bg-black/40 md:bg-black/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 md:gap-3">
                  <a href={file.drive_url} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white rounded-[5px]">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href={file.drive_download_url} target="_blank" rel="noopener noreferrer" download>
                    <Button size="icon" variant="ghost" className="h-9 w-9 bg-white/10 hover:bg-white/20 text-white rounded-[5px]">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                  <Button size="icon" variant="ghost" className="h-9 w-9 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-[5px]" onClick={() => handleDelete(file.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="text-xs font-bold truncate">{file.name}</p>
                <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">{formatBytes(file.size_bytes || 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-6 p-4 bg-secondary/10 border border-border/50 rounded-[5px] hover:border-primary/50 hover:bg-secondary/20 transition-all group"
            >
              <div className="w-10 h-10 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shrink-0">
                <FileIcon mimeType={file.mime_type} className="w-5 h-5 text-primary/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{file.name}</p>
                <div className="flex items-center gap-4 mt-0.5">
                  <span className="text-[10px] text-muted-foreground/50 font-mono uppercase">{file.mime_type}</span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">{formatBytes(file.size_bytes || 0)}</span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">{new Date(file.created_at || "").toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                <a href={file.drive_url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[5px] hover:bg-secondary"><Eye className="w-4 h-4" /></Button>
                </a>
                <a href={file.drive_download_url} target="_blank" rel="noopener noreferrer" download>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[5px] hover:bg-secondary"><Download className="w-4 h-4" /></Button>
                </a>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-[5px] hover:bg-red-500/10 text-red-500" onClick={() => handleDelete(file.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
