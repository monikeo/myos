import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Filter, Wrench, ChevronRight, Settings, ExternalLink,
  Code, Layout, Database, Terminal, Shield, Workflow, FileText,
  CheckSquare, Activity, Globe, Cpu, Cloud, GitBranch, Server, Lock,
  Play, ArrowLeft, RefreshCw, Star, Trash2, Edit3, Loader2, Sparkles
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, isValidUrl } from "@/lib/utils";
import { getItems, createItem, updateItem, deleteItem, getCurrentSession } from "@/lib/api";
import { ToolIntegration } from "@/src/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";

const ICON_MAP: Record<string, any> = {
  Terminal, Code, Layout, Database, Settings, Shield, Workflow,
  FileText, CheckSquare, Activity, Globe, Cpu, Cloud, GitBranch,
  Server, Lock, Wrench, Play, Star, Sparkles
};

export function ToolsView() {
  const [tools, setTools] = useState<ToolIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<"all" | "favorites" | "popular">("all");
  
  // Organization state
  const [activeOrgId, setActiveOrgId] = useState<string>("all");
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<any[]>([]);

  const toolsRef = useRef<ToolIntegration[]>([]);
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  // Iframe View Mode State
  const [activeIframeTool, setActiveIframeTool] = useState<ToolIntegration | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Tab launch overlay loading animation state
  const [tabLaunchingTool, setTabLaunchingTool] = useState<ToolIntegration | null>(null);

  // Sheet Modal Form State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Partial<ToolIntegration> | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Loading Log outputs for simulated terminal
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  useEffect(() => {
    loadTools(false);
    const handleSync = () => loadTools(true);
    const handleOrgChange = () => loadTools(false);
    window.addEventListener("myos:data-changed", handleSync);
    window.addEventListener("myos:active-org-changed", handleOrgChange);
    return () => {
      window.removeEventListener("myos:data-changed", handleSync);
      window.removeEventListener("myos:active-org-changed", handleOrgChange);
    };
  }, []);

  const loadTools = async (isSync = false) => {
    if (!isSync || toolsRef.current.length === 0) {
      setLoading(true);
    }
    try {
      const currentOrgId = localStorage.getItem("myos_active_organization_id") || "all";
      setActiveOrgId(currentOrgId);

      const [data, roles] = await Promise.all([
        getItems<ToolIntegration>("tool"),
        getItems<any>("role_assignment")
      ]);

      const currentUser = getCurrentSession();
      let isAdmin = false;
      if (currentOrgId !== "all" && currentOrgId !== "standalone" && currentUser) {
        const myOrgRole = roles.find(
          r => r.user_id === currentUser.id && r.scope_type === "organization" && r.scope_id === currentOrgId && r.status !== "pending"
        );
        if (myOrgRole && ["Owner", "Admin"].includes(myOrgRole.role)) {
          isAdmin = true;
        }
      }
      setIsOrgAdmin(isAdmin);
      setRoleAssignments(roles);
      
      const hasSeeded = localStorage.getItem("myos_tools_seeded");

      if (data.length === 0 && !hasSeeded) {
        await seedDefaultTools();
        const seededData = await getItems<ToolIntegration>("tool");
        setTools(seededData);
      } else {
        setTools(data);
      }
    } catch (err: any) {
      console.error("Failed to load tools", err);
      import("@/lib/utils").then(m => m.emitError("Tools Load Failed", err?.message || "Failed to load tools"));
    } finally {
      setLoading(false);
    }
  };

  // Seed default tools securely without wiping user data
  const seedDefaultTools = async () => {

    const defaults: Omit<ToolIntegration, 'id'>[] = [
      // 1. PDF Tools
      {
        type: "tool",
        name: "ILovePDF Hub",
        category: "PDF Tools",
        description: "Universal suite for splitting, merging, converting, and compressing documents.",
        icon: "FileText",
        host_url: "https://www.ilovepdf.com/",
        github_url: "https://github.com/ilovepdf",
        status: "Active",
        is_favorite: true,
        clicks: 22,
        launch_mode: "proxy" // Blocks iframe -> will load via reverse proxy!
      },
      {
        type: "tool",
        name: "PDFEscape Editor",
        category: "PDF Tools",
        description: "Inline document reader, form filler, and markup designer directly in the browser.",
        icon: "Wrench",
        host_url: "https://www.pdfescape.com/",
        status: "Active",
        is_favorite: false,
        clicks: 8,
        launch_mode: "iframe" // Direct iframe
      },
      // 2. Code Tools
      {
        type: "tool",
        name: "JSON Formatter",
        category: "Code Tools",
        description: "Format, validate, beautify, and analyze raw JSON trees programmatically.",
        icon: "Code",
        host_url: "https://jsonformatter.org/",
        github_url: "https://github.com/jsonformatter",
        status: "Active",
        is_favorite: true,
        clicks: 14,
        launch_mode: "proxy" // Blocks iframe -> loaded via proxy!
      },
      {
        type: "tool",
        name: "Carbon Code Screenshots",
        category: "Code Tools",
        description: "Design high-fidelity aesthetic editor images of your source code snippets.",
        icon: "Layout",
        host_url: "https://carbon.now.sh/",
        github_url: "https://github.com/carbon-app/carbon",
        status: "Active",
        is_favorite: true,
        clicks: 15,
        launch_mode: "iframe"
      },
      // 3. networking tools
      {
        type: "tool",
        name: "Fast Bandwidth Test",
        category: "networking tools",
        description: "Direct speed diagnostics (ping, latency, downloads) hosted securely by Netflix.",
        icon: "Activity",
        host_url: "https://fast.com/",
        status: "Active",
        is_favorite: false,
        clicks: 6,
        launch_mode: "iframe"
      },
      {
        type: "tool",
        name: "DNS Checker Locator",
        category: "networking tools",
        description: "Global propagation tracer checking DNS records worldwide.",
        icon: "Globe",
        host_url: "https://dnschecker.org/",
        status: "Active",
        is_favorite: false,
        clicks: 9,
        launch_mode: "proxy" // Blocks direct iframe
      },
      // 4. cyber security tools
      {
        type: "tool",
        name: "CyberChef Protocol",
        category: "cyber security tools",
        description: "The Cyber Swiss Army Knife for encryption, decoding, hex dumps, and hashing operations.",
        icon: "Shield",
        host_url: "https://gchq.github.io/CyberChef/",
        github_url: "https://github.com/gchq/CyberChef",
        status: "Active",
        is_favorite: true,
        clicks: 31,
        launch_mode: "iframe"
      },
      {
        type: "tool",
        name: "JWT Token Debugger",
        category: "cyber security tools",
        description: "Secure, local client decoding and encryption check for web identity tokens.",
        icon: "Lock",
        host_url: "https://jwt.io/",
        github_url: "https://github.com/auth0/jwt.io",
        status: "Active",
        is_favorite: false,
        clicks: 12,
        launch_mode: "iframe"
      },
      // 5. AI Tools
      {
        type: "tool",
        name: "ChatGPT Workspace",
        category: "AI Tools",
        description: "OpenAI conversational LLM client assisting with code analysis and design feedback.",
        icon: "Sparkles",
        host_url: "https://chatgpt.com/",
        status: "Active",
        is_favorite: true,
        clicks: 18,
        launch_mode: "tab" // High security, locks frame and proxy -> tab launch
      },
      {
        type: "tool",
        name: "Hugging Face Models",
        category: "AI Tools",
        description: "Community workspace containing thousands of interactive AI models and spaces.",
        icon: "Cpu",
        host_url: "https://huggingface.co/",
        status: "Active",
        is_favorite: false,
        clicks: 11,
        launch_mode: "tab"
      },
      // 6. Academy Tools
      {
        type: "tool",
        name: "Excalidraw Sketchpad",
        category: "Academy Tools",
        description: "Collaborative dynamic sketching and whiteboarding tool with a clean hand-drawn look.",
        icon: "Terminal",
        host_url: "https://excalidraw.com/",
        github_url: "https://github.com/excalidraw/excalidraw",
        status: "Active",
        is_favorite: true,
        clicks: 27,
        launch_mode: "iframe"
      },
      {
        type: "tool",
        name: "Khan Academy lectures",
        category: "Academy Tools",
        description: "Infinite educational platform containing scientific lectures and technical labs.",
        icon: "CheckSquare",
        host_url: "https://www.khanacademy.org/",
        status: "Active",
        is_favorite: false,
        clicks: 5,
        launch_mode: "iframe"
      }
    ];

    await Promise.all(
      defaults.map(item =>
        createItem({
          id: crypto.randomUUID(),
          ...item,
          is_default: true
        })
      )
    );
    localStorage.setItem("myos_tools_seeded", "true");
  };

  const handleLaunch = async (tool: ToolIntegration) => {
    const updated = {
      ...tool,
      clicks: (tool.clicks || 0) + 1,
      updated_at: new Date().toISOString()
    };
    
    setTools(prev => prev.map(t => t.id === tool.id ? updated : t));
    
    try {
      await updateItem(tool.id, updated);
    } catch (err) {
      console.error(err);
    }

    if (tool.launch_mode === "tab") {
      setTabLaunchingTool(tool);
      setTimeout(() => {
        setTabLaunchingTool(null);
        window.open(tool.host_url, "_blank");
        loadTools();
      }, 1400);
    } else {
      setActiveIframeTool(tool);
      setIframeLoading(true);
      setIframeKey(prev => prev + 1);

      const gatewayMessage = tool.launch_mode === "proxy" 
        ? "INF DEPLOYING REVERSE PROXY PIPELINE..." 
        : "INF ESTABLISHING DIRECT SOCKET CONNECTION...";
      const headersMessage = tool.launch_mode === "proxy"
        ? "INF STRIPPING FRAME-SECURITY HEADERS (X-FRAME-OPTIONS)..."
        : "INF BINDING CORE WORKSPACE SHIELD...";

      setTerminalLogs([
        `[${new Date().toLocaleTimeString()}] ⚡ INIT SECURE CONTAINER FOR ${tool.name.toUpperCase()}...`,
        `[${new Date().toLocaleTimeString()}] ${gatewayMessage}`,
        `[${new Date().toLocaleTimeString()}] ${headersMessage}`
      ]);

      setTimeout(() => {
        setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] INF RESOLVING RESOURCE DOCUMENT BASE PATH DIRECTIVE.`]);
      }, 300);

      setTimeout(() => {
        setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] INF SECURE CHANNEL READY -> RESOLVING RENDER RENDER ENGINE...`]);
      }, 600);

      setTimeout(() => {
        setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] WRN STREAMING PACKETS - EMBEDDING CLIENT VIEWPORT...`]);
      }, 1000);
    }
  };

  const handleToggleFavorite = async (tool: ToolIntegration, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...tool,
      is_favorite: !tool.is_favorite,
      updated_at: new Date().toISOString()
    };
    setTools(prev => prev.map(t => t.id === tool.id ? updated : t));
    
    if (activeIframeTool?.id === tool.id) {
      setActiveIframeTool(updated);
    }
    
    try {
      await updateItem(tool.id, updated);
      loadTools();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenSheet = (tool?: ToolIntegration) => {
    setValidationError(null);
    if (tool) {
      setEditingTool(tool);
    } else {
      setEditingTool({
        type: "tool",
        name: "",
        category: "Code Tools",
        description: "",
        icon: "Terminal",
        host_url: "",
        github_url: "",
        status: "Active",
        is_favorite: false,
        clicks: 0,
        launch_mode: "iframe"
      });
    }
    setIsSheetOpen(true);
  };

  const handleSaveTool = async () => {
    if (!editingTool || !editingTool.name || !editingTool.host_url) return;
    setValidationError(null);

    if (!isValidUrl(editingTool.host_url)) {
      setValidationError("Host URL must start with http:// or https://");
      return;
    }

    if (editingTool.github_url && !isValidUrl(editingTool.github_url)) {
      setValidationError("GitHub URL must start with http:// or https://");
      return;
    }

    try {
      if (editingTool.id) {
        const updated = {
          ...editingTool,
          updated_at: new Date().toISOString()
        } as ToolIntegration;
        await updateItem(editingTool.id, updated);
      } else {
        const newItem = {
          ...editingTool,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          organization_id: (activeOrgId !== "all" && activeOrgId !== "standalone") ? activeOrgId : undefined
        } as ToolIntegration;
        await createItem(newItem);
      }
      setIsSheetOpen(false);
      setEditingTool(null);
      loadTools();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTool = async (id: string) => {
    if (confirm("Are you sure you want to delete this custom tool?")) {
      try {
        await deleteItem(id);
        setIsSheetOpen(false);
        setEditingTool(null);
        if (activeIframeTool?.id === id) {
          setActiveIframeTool(null);
        }
        loadTools();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const canConfigureTool = (tool: ToolIntegration) => {
    const user = getCurrentSession();
    if (!user) return false;
    
    // Default system tools cannot be configured/deleted/edited by anyone
    if (tool.is_default) return false;

    // Organization tools can only be configured by Owner or Admin of that organization
    if (tool.organization_id) {
      const myOrgRole = roleAssignments.find(
        r => r.user_id === user.id && r.scope_type === "organization" && r.scope_id === tool.organization_id && r.status !== "pending"
      );
      return myOrgRole && ["Owner", "Admin"].includes(myOrgRole.role);
    }
    
    // Personal tools can only be configured by their creator
    return tool.user_id === user.id;
  };

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(tools.map(t => t.category)))];
  }, [tools]);

  const filteredTools = useMemo(() => {
    let result = [...tools];
    
    if (activeOrgId === "standalone") {
      result = result.filter(tool => !tool.organization_id);
    } else if (activeOrgId !== "all") {
      result = result.filter(tool => tool.organization_id === activeOrgId);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tool => 
        tool.name.toLowerCase().includes(q) || 
        tool.description.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q)
      );
    }
    
    if (filterCategory !== "All") {
      result = result.filter(tool => tool.category === filterCategory);
    }
    
    if (activeTab === "favorites") {
      result = result.filter(tool => tool.is_favorite);
    } else if (activeTab === "popular") {
      result.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    }
    
    return result;
  }, [tools, searchQuery, filterCategory, activeTab]);

  const stats = useMemo(() => {
    const total = filteredTools.length;
    const favs = filteredTools.filter(t => t.is_favorite).length;
    const popular = filteredTools.reduce((max, tool) => (tool.clicks || 0) > (max.clicks || 0) ? tool : max, filteredTools[0] || null);
    const groups = new Set(filteredTools.map(t => t.category)).size;
    return { total, favs, popular, groups };
  }, [filteredTools]);

  const getProxyUrl = (url: string) => {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  // Determine standard source based on selected launch mode
  const getIframeSrc = (tool: ToolIntegration) => {
    return tool.launch_mode === "proxy" ? getProxyUrl(tool.host_url) : tool.host_url;
  };

  return (
    <div className={cn(
      "w-full transition-all duration-500",
      activeIframeTool 
        ? "h-[calc(100vh-12rem)] flex flex-col overflow-hidden -m-4 md:-m-8 p-4 md:p-8 bg-background relative" 
        : "space-y-6 sm:space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4"
    )}>
      
      {/* 1. Launch Tab Modal Spinner Overlay */}
      {tabLaunchingTool && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
          <div className="relative mb-6">
            <div className="w-20 h-20 border border-primary bg-primary/5 flex items-center justify-center overflow-hidden">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 animate-ping rounded-[5px]-full" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-[5px]-full" />
          </div>
          <div className="space-y-2 max-w-sm font-mono">
            <Badge className="bg-primary/10 border-primary/30 text-primary text-[8px] tracking-[0.25em] rounded-[5px] px-3 uppercase font-bold">
              Resolving App Node
            </Badge>
            <h3 className="text-xl font-bold uppercase text-white tracking-tighter">{tabLaunchingTool.name}</h3>
            <p className="text-[10px] text-muted-foreground/60 uppercase">Launching externally: {tabLaunchingTool.host_url}</p>
          </div>
        </div>
      )}

      {/* 2. If Iframe View Mode is active, render Full-Screen Iframe sandboxed overlay */}
      {activeIframeTool ? (
        <div className="flex-1 flex flex-col min-h-0 h-full w-full space-y-4 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border/50 pb-4 shrink-0">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => {
                  setActiveIframeTool(null);
                  setIframeLoading(false);
                  loadTools();
                }}
                variant="outline"
                className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary h-12 w-12 p-0 flex items-center justify-center shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-extrabold tracking-tighter uppercase truncate max-w-[200px] sm:max-w-xs">{activeIframeTool.name}</h2>
                  <Badge variant="outline" className="text-[8px] font-mono tracking-widest px-2 py-0.5 border-primary/20 text-primary bg-primary/5 uppercase shrink-0">
                    {activeIframeTool.category}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground/75 font-mono mt-0.5 truncate max-w-sm sm:max-w-md md:max-w-lg">
                  NODE: {activeIframeTool.host_url}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleToggleFavorite(activeIframeTool, e)}
                className="h-11 w-11 rounded-[5px] bg-secondary/30 border border-border/20 hover:bg-secondary/50"
              >
                <Star className={cn("w-4.5 h-4.5", activeIframeTool.is_favorite ? "text-primary fill-primary" : "text-muted-foreground")} />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIframeKey(prev => prev + 1)}
                className="h-11 w-11 rounded-[5px] bg-secondary/30 border border-border/20 hover:bg-secondary/50"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </Button>

              <Button
                onClick={() => window.open(activeIframeTool.host_url, "_blank")}
                className="rounded-[5px] bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground h-11 px-4 font-bold text-[9px] uppercase tracking-widest flex items-center gap-2 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                Launch Tab
              </Button>

              {activeIframeTool.github_url && (
                <Button
                  onClick={() => window.open(activeIframeTool.github_url, "_blank")}
                  className="rounded-[5px] bg-secondary/50 hover:bg-secondary border border-border/50 text-foreground h-11 px-4 font-bold text-[9px] uppercase tracking-widest flex items-center gap-2 shrink-0"
                >
                  <Code className="w-3.5 h-3.5 text-muted-foreground" />
                  Code
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 w-full border border-border/50 bg-black/40 overflow-hidden relative shadow-2xl min-h-0">
            {iframeLoading && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-40 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="relative mb-6">
                  <div className="w-16 h-16 border border-border/50 bg-secondary/10 flex items-center justify-center relative overflow-hidden">
                    <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 animate-ping rounded-[5px]-full" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-[5px]-full" />
                </div>
                
                <div className="space-y-2.5 max-w-md font-mono">
                  <Badge variant="outline" className="text-primary font-bold uppercase tracking-[0.2em] border-primary/20 text-[8px] bg-primary/5 px-2.5 py-0.5">
                    {activeIframeTool.launch_mode === "proxy" ? "OS Reverse Proxy Active" : "Direct Client Stream"}
                  </Badge>
                  <h3 className="text-lg font-bold uppercase text-foreground tracking-tight">
                    {activeIframeTool.launch_mode === "proxy" ? "Stripping frame restrictions" : "Connecting directly to host"}
                  </h3>
                  <div className="p-2.5 bg-secondary/30 border border-border/50 text-[9px] font-mono tracking-tight text-primary truncate max-w-xs sm:max-w-md mx-auto">
                    {activeIframeTool.host_url}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed border border-dashed border-border/20 p-2.5 bg-background/40">
                    {activeIframeTool.launch_mode === "proxy" 
                      ? "💡 Bypassing X-Frame-Options headers securely to permit inline app rendering." 
                      : "⚡ Loading directly inside native OS viewport bounds."}
                  </p>
                </div>
                
                {/* Monospace terminal logs */}
                <div className="mt-6 w-full max-w-md bg-black/40 border border-border/30 p-3.5 font-mono text-[8px] text-emerald-400 text-left space-y-1 h-32 overflow-hidden shadow-2xl relative">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none" />
                  <div className="animate-pulse flex items-center gap-2 mb-1.5 border-b border-emerald-500/20 pb-1.5 text-emerald-500 font-bold">
                    <Terminal className="w-3 h-3" />
                    <span>OS SECURE CONNECTION PIPELINE</span>
                  </div>
                  {terminalLogs.map((log, index) => (
                    <div key={index} className="truncate">{log}</div>
                  ))}
                </div>
              </div>
            )}
            
            {/* The sandboxed iframe wrapper */}
            <iframe
              key={iframeKey}
              src={getIframeSrc(activeIframeTool)}
              onLoad={() => {
                setTimeout(() => setIframeLoading(false), 600);
              }}
              className="w-full h-full border-0 bg-white"
              sandbox={activeIframeTool.launch_mode === "proxy" ? "allow-scripts allow-forms allow-downloads allow-modals allow-popups" : "allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-popups"}
              title={activeIframeTool.name}
            />
          </div>
        </div>
      ) : (
        <>
          {/* 3. Grid Hub Directory Mode */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border/50 pb-8 shrink-0">
            <div className="space-y-3">
              <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Tools</Badge>
              <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
              <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Launch and manage utility tools in your workspace</p>
            </div>
        
            {(activeOrgId === "all" || activeOrgId === "standalone" || isOrgAdmin) && (
              <Button
                onClick={() => handleOpenSheet()}
                className="rounded-[5px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.2)] h-11 px-5 font-bold text-xs uppercase tracking-[0.2em]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Tool
              </Button>
            )}
          </div>

          {/* 4. Dashboard Statistics panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/50 glass-panel rounded-[5px] group hover:border-primary/20 transition-all shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-mono">Total Tools</p>
                  <p className="text-2xl font-bold font-mono tracking-tighter">{stats.total}</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary rounded-[5px] shadow-sm">
                  <Wrench className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 glass-panel rounded-[5px] group hover:border-primary/20 transition-all shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-mono">Pinned Favorites</p>
                  <p className="text-2xl font-bold font-mono tracking-tighter">{stats.favs}</p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 rounded-[5px] shadow-sm">
                  <Star className="w-4 h-4 fill-amber-500/10" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 glass-panel rounded-[5px] group hover:border-primary/20 transition-all shadow-sm">
              <CardContent className="p-4 flex items-center justify-between min-w-0">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-mono">Most Used Tool</p>
                  <p className="text-xs font-bold uppercase truncate pr-2 mt-1">
                    {stats.popular ? stats.popular.name : "None"}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 rounded-[5px] shadow-sm font-mono text-[10px] font-bold shrink-0">
                  {stats.popular ? `${stats.popular.clicks || 0}x` : "0x"}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 glass-panel rounded-[5px] group hover:border-primary/20 transition-all shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-mono">Active Groups</p>
                  <p className="text-2xl font-bold font-mono tracking-tighter">{stats.groups}</p>
                </div>
                <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 rounded-[5px] shadow-sm">
                  <Layout className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 5. Filter Control Bar Row 1: Search & Active Tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0 bg-secondary/10 border border-border/30 p-3 sm:p-4 rounded-[5px]">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Filter and search registry..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background/50 border-border/30 rounded-[5px] focus-visible:ring-primary font-medium"
              />
            </div>

            <div className="flex p-0.5 bg-background border border-border/50 min-w-max rounded-[5px] shrink-0 self-start md:self-auto">
              <Button
                size="sm"
                variant={activeTab === "all" ? "secondary" : "ghost"}
                onClick={() => setActiveTab("all")}
                className={cn(
                  "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3.5 h-8",
                  activeTab === "all" ? "bg-secondary text-primary" : "text-muted-foreground"
                )}
              >
                All Tools
              </Button>
              <Button
                size="sm"
                variant={activeTab === "favorites" ? "secondary" : "ghost"}
                onClick={() => setActiveTab("favorites")}
                className={cn(
                  "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3.5 h-8",
                  activeTab === "favorites" ? "bg-secondary text-primary" : "text-muted-foreground"
                )}
              >
                ⭐ Favorites
              </Button>
              <Button
                size="sm"
                variant={activeTab === "popular" ? "secondary" : "ghost"}
                onClick={() => setActiveTab("popular")}
                className={cn(
                  "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3.5 h-8",
                  activeTab === "popular" ? "bg-secondary text-primary" : "text-muted-foreground"
                )}
              >
                🔥 Most Used
              </Button>
            </div>
          </div>

          {/* 6. Filter Control Bar Row 2: Category Groups */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 bg-secondary/5 border border-border/20 p-3 sm:px-4 sm:py-3 rounded-[5px]">
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] font-mono">Filter Category:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scroll-smooth custom-scrollbar">
              {categories.map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={filterCategory === cat ? "secondary" : "outline"}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "rounded-[5px] font-bold text-[8px] uppercase tracking-widest px-3.5 h-8 border-border/40 shrink-0",
                    filterCategory === cat ? "bg-primary text-white shadow-sm border-transparent" : "text-muted-foreground bg-background/30 hover:bg-background/80"
                  )}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* 7. Tool integrations dynamic grid cards */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest animate-pulse">Syncing Cloud Integrations...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTools.map((tool, idx) => {
                const IconComponent = ICON_MAP[tool.icon] || Terminal;
                return (
                  <Card
                    key={tool.id || idx}
                    className="border border-border/50 bg-secondary/5 backdrop-blur-xl rounded-[5px] overflow-hidden group hover:border-primary/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all duration-300 flex flex-col justify-between min-h-[220px]"
                  >
                    <CardContent className="p-5 flex flex-col h-full justify-between">
                      {/* Top Header Card Info */}
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-[5px] bg-background border border-border/50 flex items-center justify-center group-hover:border-primary/40 transition-colors shadow-sm relative shrink-0">
                            <IconComponent className="w-4.5 h-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            {tool.is_favorite && (
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 flex items-center justify-center">
                                <Star className="w-2.5 h-2.5 text-white fill-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono",
                              tool.status === "Active" ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20" :
                              tool.status === "Beta" ? "text-blue-500 bg-blue-500/5 border-blue-500/20" :
                              "text-amber-500 bg-amber-500/5 border-amber-500/20"
                            )}>
                              {tool.status}
                            </Badge>
                            
                            <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono border-border/50 text-muted-foreground bg-background/30">
                              {tool.clicks || 0}x
                            </Badge>

                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono border-border/50",
                              tool.launch_mode === "tab" ? "text-amber-400 border-amber-400/20 bg-amber-400/5" : 
                              tool.launch_mode === "proxy" ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/5" :
                              "text-primary border-primary/20 bg-primary/5"
                            )}>
                              {tool.launch_mode === "tab" ? "Tab" : tool.launch_mode === "proxy" ? "Proxy" : "Frame"}
                            </Badge>
                          </div>
                        </div>

                        <h3 className="font-bold text-[15px] mb-1.5 uppercase group-hover:text-primary transition-colors tracking-tight truncate">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4 opacity-85">
                          {tool.description || "No description provided."}
                        </p>
                      </div>

                      {/* Lower Action buttons footer */}
                      <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-border/20">
                        <span className="text-[8px] uppercase font-mono font-bold text-muted-foreground/60 tracking-widest truncate max-w-[80px] sm:max-w-[120px]">
                          {tool.category}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <Button
                            onClick={(e) => handleToggleFavorite(tool, e)}
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-[5px] bg-background border border-border/50 hover:bg-secondary/40 text-muted-foreground"
                            title="Favorite"
                          >
                            <Star className={cn("w-3.5 h-3.5", tool.is_favorite ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                          </Button>
                          
                          {canConfigureTool(tool) && (
                            <Button
                              onClick={() => handleOpenSheet(tool)}
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-[5px] bg-background border border-border/50 hover:bg-secondary/40 text-muted-foreground"
                              title="Configure"
                            >
                              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          
                          {tool.github_url && (
                            <Button
                              onClick={() => window.open(tool.github_url, "_blank")}
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-[5px] bg-background border border-border/50 hover:bg-secondary/40 text-muted-foreground"
                              title="GitHub Repo"
                            >
                              <Code className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          
                          <Button
                            onClick={() => handleLaunch(tool)}
                            className="rounded-[5px] bg-primary text-white h-8 px-4 font-bold text-[8px] uppercase tracking-widest hover:bg-primary/90 flex items-center gap-1 shrink-0"
                          >
                            {tool.launch_mode === "tab" ? (
                              <>
                                <ExternalLink className="w-3.5 h-3.5 text-white" />
                                Launch
                              </>
                            ) : tool.launch_mode === "proxy" ? (
                              <>
                                <Play className="w-3 h-3 fill-white" />
                                Proxy
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-white" />
                                Frame
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredTools.length === 0 && (
                <div className="col-span-full py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/30 bg-secondary/5 p-12">
                  <Wrench className="w-10 h-10 text-muted-foreground/20 mb-4 animate-bounce" />
                  <h3 className="text-lg font-bold uppercase tracking-tight">No registered tools found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1.5 leading-relaxed">Adjust your search parameters or filter configurations to find integrations, or register a new tool.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 8. Register & Configure sliding Sheet drawer */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md border-l border-border/50 bg-background/95 backdrop-blur-2xl p-0 flex flex-col rounded-[5px]">
          <SheetHeader className="p-6 border-b border-border/20 bg-secondary/15 shrink-0">
            <Badge variant="outline" className="w-fit text-[9px] font-bold uppercase tracking-[0.2em] border-primary/20 text-primary mb-2 bg-primary/5">
              Tool Details
            </Badge>
            <SheetTitle className="text-xl font-extrabold tracking-tighter uppercase">
              {editingTool?.id ? "Edit Tool" : "Add New Tool"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed border-t border-border/10 pt-2">
              Configure the tool details, launch behavior, and destination link below.
            </SheetDescription>
          </SheetHeader>

          {editingTool && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {validationError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-mono rounded-[5px]">
                  ⚠️ {validationError}
                </div>
              )}
              
              {/* Tool Name input */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Tool Name</label>
                <Input
                  value={editingTool.name || ""}
                  onChange={e => setEditingTool({...editingTool, name: e.target.value})}
                  placeholder="e.g., Markdown Editor"
                  className="bg-secondary/20 border-border/40 focus-visible:ring-primary rounded-[5px] h-10"
                />
              </div>

              {/* Tool Category Group Selection */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Category Group</label>
                <select
                  value={editingTool.category || "Code Tools"}
                  onChange={e => setEditingTool({...editingTool, category: e.target.value})}
                  className="w-full h-10 px-3 bg-secondary/20 border border-border/40 hover:border-border/60 focus:border-primary text-sm focus:outline-none rounded-[5px] text-foreground font-mono"
                >
                  <option value="PDF Tools">PDF Tools</option>
                  <option value="Code Tools">Code Tools</option>
                  <option value="networking tools">networking tools</option>
                  <option value="cyber security tools">cyber security tools</option>
                  <option value="AI Tools">AI Tools</option>
                  <option value="Academy Tools">Academy Tools</option>
                </select>
              </div>

              {/* Tool Description */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Description Summary</label>
                <textarea
                  value={editingTool.description || ""}
                  onChange={e => setEditingTool({...editingTool, description: e.target.value})}
                  placeholder="Brief summary detailing tool features..."
                  className="w-full min-h-[70px] p-2.5 text-xs bg-secondary/20 border border-border/40 hover:border-border/60 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/45"
                />
              </div>

              {/* Launch Mode selector - 3 clear options! */}
              <div className="space-y-1.5 border border-border/20 p-3 bg-secondary/5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono block mb-1">Launch Mode Behavior</label>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingTool({...editingTool, launch_mode: "iframe"})}
                    className={cn(
                      "h-9 text-[9px] font-bold uppercase tracking-wider border rounded-[5px] transition-all flex items-center justify-center gap-2",
                      editingTool.launch_mode === "iframe"
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border/30 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Layout className="w-3.5 h-3.5" />
                    Direct Frame (Allows Embedding)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTool({...editingTool, launch_mode: "proxy"})}
                    className={cn(
                      "h-9 text-[9px] font-bold uppercase tracking-wider border rounded-[5px] transition-all flex items-center justify-center gap-2",
                      editingTool.launch_mode === "proxy"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 animate-pulse"
                        : "border-border/30 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Proxy Frame (Bypass Header Block)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTool({...editingTool, launch_mode: "tab"})}
                    className={cn(
                      "h-9 text-[9px] font-bold uppercase tracking-wider border rounded-[5px] transition-all flex items-center justify-center gap-2",
                      editingTool.launch_mode === "tab"
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                        : "border-border/30 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New secure Tab
                  </button>
                </div>
                <p className="text-[8px] text-muted-foreground/60 mt-2 font-medium leading-relaxed">
                  💡 Select **Proxy Frame** if the site blocks standard framing but is a simple site. Use **Open in secure Tab** for complex AI apps.
                </p>
              </div>

              {/* Host URL Link */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Host URL Deployment</label>
                <Input
                  value={editingTool.host_url || ""}
                  onChange={e => setEditingTool({...editingTool, host_url: e.target.value})}
                  placeholder="https://your-tool-deployment.web.app/"
                  className="bg-secondary/20 border-border/40 focus-visible:ring-primary rounded-[5px] h-10 font-mono text-xs"
                />
              </div>

              {/* GitHub Link */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">GitHub Repository (Optional)</label>
                <Input
                  value={editingTool.github_url || ""}
                  onChange={e => setEditingTool({...editingTool, github_url: e.target.value})}
                  placeholder="https://github.com/username/project"
                  className="bg-secondary/20 border-border/40 focus-visible:ring-primary rounded-[5px] h-10 font-mono text-xs"
                />
              </div>

              {/* Icon Picker Grid */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Select UI Icon</label>
                <div className="grid grid-cols-5 gap-1.5 border border-border/20 p-2.5 bg-secondary/5">
                  {Object.keys(ICON_MAP).map(key => {
                    const PickerIcon = ICON_MAP[key];
                    const isSelected = editingTool.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEditingTool({...editingTool, icon: key})}
                        className={cn(
                          "h-9 border flex items-center justify-center transition-all hover:bg-secondary rounded-[5px]",
                          isSelected ? "bg-primary/10 border-primary text-primary" : "border-border/30 text-muted-foreground/50"
                        )}
                        title={key}
                      >
                        <PickerIcon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status & Favorites */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/75 font-mono">Status</label>
                  <select
                    value={editingTool.status || "Active"}
                    onChange={e => setEditingTool({...editingTool, status: e.target.value as any})}
                    className="w-full h-10 px-3 bg-secondary/20 border border-border/40 hover:border-border/60 focus:border-primary text-xs focus:outline-none rounded-[5px] text-foreground font-mono"
                  >
                    <option value="Active">Active</option>
                    <option value="Beta">Beta</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                
                <div className="space-y-1.5 flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingTool({...editingTool, is_favorite: !editingTool.is_favorite})}
                    className={cn(
                      "h-10 border font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-[5px] transition-all",
                      editingTool.is_favorite 
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400" 
                        : "border-border/40 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    <Star className={cn("w-3.5 h-3.5", editingTool.is_favorite ? "fill-amber-500 text-amber-500" : "")} />
                    {editingTool.is_favorite ? "Pinned Fav" : "Pin Favorite"}
                  </button>
                </div>
              </div>

            </div>
          )}

          <SheetFooter className="p-6 border-t border-border/20 bg-secondary/15 shrink-0 flex items-center justify-between gap-4 flex-row">
            {editingTool?.id ? (
              <Button
                variant="destructive"
                onClick={() => editingTool.id && handleDeleteTool(editingTool.id)}
                className="rounded-[5px] font-bold uppercase tracking-widest text-[9px] px-4 h-11 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsSheetOpen(false);
                  setEditingTool(null);
                }}
                className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] px-5 h-11"
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveTool}
                disabled={!editingTool?.name || !editingTool?.host_url}
                className="rounded-[5px] shadow-md bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-[9px] px-6 h-11"
              >
                Save Tool
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}
