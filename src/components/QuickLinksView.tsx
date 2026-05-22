import { useState, useEffect, useCallback } from "react";
import {
  Link2, Plus, Trash2, Edit3, Search, ExternalLink,
  Globe, Folder, Save, X, Grid3X3, List, Layers, Briefcase, Copy, Check
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QuickLink } from "@/src/types";
import { getItems, createItem, updateItem, deleteItem } from "@/lib/api";
import { cn, isValidUrl } from "@/lib/utils";

const LINK_CATEGORIES = ["Work", "Dev", "Social", "Finance", "Research", "Tools", "Entertainment", "Other"];

function getFavicon(url: string) {
  try {
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    const u = new URL(formattedUrl);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { return null; }
}

interface LinkFormData {
  title: string;
  url: string;
  category: string;
  description: string;
  workspace_id?: string;
}

const emptyForm: LinkFormData = { title: "", url: "", category: "Work", description: "", workspace_id: "" };

const CopyLinkButton = ({ url, className }: { url: string; className?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn("rounded-[5px] transition-colors", copied ? "text-green-500 hover:bg-green-500/10" : "text-muted-foreground hover:bg-secondary/40", className)}
      onClick={handleCopy}
      title="Copy URL"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
};

const LinkCard = ({ 
  link, 
  onEdit, 
  onDelete,
  workspaces
}: { 
  link: QuickLink; 
  onEdit: (link: QuickLink) => void; 
  onDelete: (link: QuickLink, e: React.MouseEvent) => void; 
  workspaces: any[];
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const favicon = link.favicon || getFavicon(link.url);
  const parentWS = workspaces.find(w => w.id === link.workspace_id);

  return (
    <Card className="group border border-border/50 glass-panel hover:border-primary/50 transition-all duration-300 rounded-[5px] overflow-hidden hover:-translate-y-1 cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-primary/50 transition-colors">
            {favicon && !imgFailed ? (
              <img 
                src={favicon} 
                alt="" 
                className="w-6 h-6 object-contain" 
                onError={() => setImgFailed(true)} 
              />
            ) : (
              <Globe className="w-5 h-5 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{link.title}</p>
            <p className="text-[10px] text-muted-foreground/40 font-mono truncate mt-0.5">{link.url}</p>
          </div>
          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[5px]" onClick={(e) => { e.stopPropagation(); onEdit(link); }}>
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[5px] text-red-500 hover:bg-red-500/10" onClick={(e) => onDelete(link, e)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        {link.description && (
          <p className="text-xs text-muted-foreground/60 mb-4 line-clamp-2 leading-relaxed">{link.description}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest border-border/30 bg-background/50 text-muted-foreground/60 font-mono">
              {link.category}
            </Badge>
            {parentWS && (
              <Badge 
                style={{ borderColor: `${parentWS.color}44`, color: parentWS.color, backgroundColor: `${parentWS.color}11` }}
                variant="outline" 
                className="text-[8px] font-bold uppercase tracking-widest font-mono"
              >
                {parentWS.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <CopyLinkButton url={link.url} className="h-7 w-7" />
            <a href={isValidUrl(link.url) ? link.url : "#"} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[5px] text-primary hover:bg-primary/10">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function QuickLinksView() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [deletingLink, setDeletingLink] = useState<QuickLink | null>(null);
  
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LinkFormData>(emptyForm);
  const [validationError, setValidationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [linkData, wsData] = await Promise.all([
        getItems<QuickLink>("link"),
        getItems<any>("workspace")
      ]);
      setLinks(linkData);
      setWorkspaces(wsData);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = ["All", ...LINK_CATEGORIES];

  const filtered = links.filter((l) => {
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.url.toLowerCase().includes(search.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || l.category === catFilter;
    const matchWS = selectedWorkspaceFilter === "All" || l.workspace_id === selectedWorkspaceFilter;
    return matchSearch && matchCat && matchWS;
  });

  const grouped = LINK_CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter((l) => l.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {} as Record<string, QuickLink[]>);

  const handleSubmit = async () => {
    if (!form.title || !form.url) return;
    setValidationError(null);
    const fullUrl = form.url.startsWith("http") ? form.url : `https://${form.url}`;

    if (!isValidUrl(fullUrl)) {
      setValidationError("Invalid URL! URL must use http:// or https:// protocol.");
      return;
    }
    
    const payload = {
      type: "link" as const,
      title: form.title,
      url: fullUrl,
      category: form.category,
      description: form.description,
      workspace_id: form.workspace_id || undefined,
      favicon: getFavicon(fullUrl) || "",
    };

    if (editingId) {
      await updateItem(editingId, payload);
    } else {
      await createItem({
        id: crypto.randomUUID(),
        ...payload
      });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    load();
  };

  const handleEdit = (link: QuickLink) => {
    setValidationError(null);
    setForm({ 
      title: link.title, 
      url: link.url, 
      category: link.category, 
      description: link.description || "",
      workspace_id: link.workspace_id || ""
    });
    setEditingId(link.id);
    setShowForm(true);
  };

  const triggerDelete = (link: QuickLink, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingLink(link);
  };

  const confirmDelete = async () => {
    if (!deletingLink) return;
    await deleteItem(deletingLink.id);
    setLinks((prev) => prev.filter((l) => l.id !== deletingLink.id));
    setDeletingLink(null);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-2">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Quick Links</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Quick Links</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">{links.length} links saved across {Object.keys(grouped).length} categories</p>
        </div>
        <Button
          onClick={() => { setValidationError(null); setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-12 px-8 font-bold text-xs uppercase tracking-[0.2em]"
        >
          <Plus className="w-4 h-4 mr-3" />
          Add Link
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="border border-primary/20 bg-primary/5 rounded-[5px] p-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold uppercase tracking-widest text-sm text-primary">{editingId ? "Edit Link" : "New Link"}</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px]" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setValidationError(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-mono rounded-[5px]">
              ⚠️ {validationError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-background/50 border-border/30 rounded-[5px] h-11" />
            <Input placeholder="URL (e.g. github.com)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="bg-background/50 border-border/30 rounded-[5px] h-11" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background/50 border-border/30 rounded-[5px] h-11 md:col-span-1" />
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/60 font-mono">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 px-4 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {LINK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/60 font-mono">Workspace</label>
              <select
                value={form.workspace_id || ""}
                onChange={(e) => setForm({ ...form, workspace_id: e.target.value })}
                className="h-11 px-4 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Personal / General (No Workspace)</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.company || "Personal"})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setValidationError(null); }} className="rounded-[5px] border-border/50 px-8 h-11 font-bold uppercase tracking-widest text-[10px]">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!form.title || !form.url} className="rounded-[5px] bg-primary px-8 h-11 font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <Save className="w-4 h-4 mr-2" />
              {editingId ? "Save Changes" : "Add Link"}
            </Button>
          </div>
        </div>
      )}

      {/* Workspace Nodes Filter Horizontal Ribbon */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-muted-foreground/60 font-mono">Filter by Workspace Node</span>
        </div>
        <div className="flex gap-2 p-1.5 bg-secondary/20 rounded-[5px] border border-border/20 overflow-x-auto custom-scrollbar whitespace-nowrap">
          <Button
            variant={selectedWorkspaceFilter === "All" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedWorkspaceFilter("All")}
            className={cn(
              "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-4 h-8 shrink-0",
              selectedWorkspaceFilter === "All" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary/40"
            )}
          >
            All Workspaces
          </Button>
          {workspaces.map((ws) => (
            <Button
              key={ws.id}
              variant={selectedWorkspaceFilter === ws.id ? "outline" : "ghost"}
              size="sm"
              onClick={() => setSelectedWorkspaceFilter(ws.id)}
              style={selectedWorkspaceFilter === ws.id ? { borderColor: ws.color, color: ws.color, backgroundColor: `${ws.color}11` } : {}}
              className={cn(
                "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-4 h-8 shrink-0 transition-all",
                selectedWorkspaceFilter === ws.id ? "shadow-[0_0_15px_rgba(59,130,246,0.15)]" : "text-muted-foreground hover:bg-secondary/40"
              )}
            >
              <div className="w-2 h-2 rounded-[5px] mr-2 shrink-0" style={{ backgroundColor: ws.color }} />
              {ws.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <Input placeholder="Search links..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 bg-secondary/30 border-border/20 rounded-[5px] h-11" />
        </div>
        <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 overflow-x-auto max-w-full whitespace-nowrap scrollbar-none shrink-0">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={catFilter === cat ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setCatFilter(cat)}
              className={cn("rounded-[5px] text-[10px] uppercase font-bold tracking-widest px-4 h-9 whitespace-nowrap shrink-0", catFilter === cat ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
            >
              {cat}
            </Button>
          ))}
        </div>
        <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 shrink-0">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="w-9 h-9 rounded-[5px]" onClick={() => setViewMode("grid")}><Grid3X3 className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="w-9 h-9 rounded-[5px]" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Links */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border/20 bg-secondary/5">
          <Link2 className="w-16 h-16 mb-4 opacity-10" />
          <p className="font-bold uppercase tracking-widest text-sm">No links found in this node / cluster</p>
        </div>
      ) : viewMode === "grid" ? (
        catFilter === "All" ? (
          <div className="space-y-10">
            {Object.entries(grouped).map(([cat, catLinks]) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-5">
                  <Folder className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-widest">{cat}</h3>
                  <Badge variant="secondary" className="text-[9px] font-bold">{catLinks.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {catLinks.map((link) => (
                    <LinkCard key={link.id} link={link} onEdit={handleEdit} onDelete={triggerDelete} workspaces={workspaces} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((link) => (
              <LinkCard key={link.id} link={link} onEdit={handleEdit} onDelete={triggerDelete} workspaces={workspaces} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((link) => {
            const favicon = link.favicon || getFavicon(link.url);
            const parentWS = workspaces.find(w => w.id === link.workspace_id);
            return (
              <div key={link.id} className="flex items-center gap-5 p-4 bg-secondary/10 border border-border/50 rounded-[5px] hover:border-primary/50 hover:bg-secondary/20 transition-all group">
                <div className="w-9 h-9 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
                  {favicon ? <img src={favicon} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <Globe className="w-4 h-4 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{link.title}</p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{link.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-border/30 font-mono">{link.category}</Badge>
                  {parentWS && (
                    <Badge 
                      style={{ borderColor: parentWS.color, color: parentWS.color }}
                      variant="outline" 
                      className="text-[9px] font-bold uppercase tracking-widest font-mono"
                    >
                      {parentWS.name}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px]" onClick={() => handleEdit(link)}><Edit3 className="w-3.5 h-3.5" /></Button>
                  <CopyLinkButton url={link.url} className="h-8 w-8" />
                  <a href={isValidUrl(link.url) ? link.url : "#"} target="_blank" rel="noopener noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] text-primary"><ExternalLink className="w-3.5 h-3.5" /></Button></a>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] text-red-500 hover:bg-red-500/10" onClick={(e) => triggerDelete(link, e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Premium Deletion Warning Modal */}
      {deletingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md p-8 border border-red-500/20 bg-card rounded-[5px] shadow-[0_0_50px_rgba(239,68,68,0.15)] space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-[5px] bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <Trash2 className="w-8 h-8 text-red-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold uppercase tracking-widest text-foreground font-mono">Terminate Node Link?</h3>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  You are about to sever the path to <span className="font-bold text-red-400 font-mono">{deletingLink.title}</span> ({deletingLink.url}). This will permanently disconnect the link from all clusters.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
              <Button
                variant="outline"
                onClick={() => setDeletingLink(null)}
                className="rounded-[5px] border-border/50 h-12 font-bold uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="rounded-[5px] bg-red-600 hover:bg-red-700 hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all h-12 font-bold uppercase tracking-widest text-[10px]"
              >
                Terminate Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
