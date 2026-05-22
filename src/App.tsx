import React, { useState, useEffect, useMemo, Component, ErrorInfo } from "react";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Briefcase, 
  FolderKanban,
  Calendar, 
  Wallet, 
  FileText, 
  FolderOpen, 
  Link2, 
  Settings,
  Search,
  Bell,
  Plus,
  Loader2,
  Moon,
  Sun,
  Layout,
  ChevronRight,
  Wrench,
  X,
  LogOut
} from "lucide-react";
import { cn, resolveDriveImage } from "@/lib/utils";
import { SafeLogo } from "@/src/components/SafeLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarProvider, 
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SheetClose } from "@/components/ui/sheet";

// Module Imports
import { NotesView } from "@/src/components/NotesView";
import { WorkspacesView } from "@/src/components/WorkspacesView";
import { ProjectsView } from "@/src/components/ProjectsView";
import { FinanceView } from "@/src/components/FinanceView";
import { TodoView } from "@/src/components/TodoView";
import { ToolsView } from "@/src/components/ToolsView";
import { CalendarView } from "@/src/components/CalendarView";
import { FileVaultView } from "@/src/components/FileVaultView";
import { QuickLinksView } from "@/src/components/QuickLinksView";
import { SettingsView } from "@/src/components/SettingsView";
import { LoginPanel } from "@/src/components/LoginPanel";
import { OrgSwitcher } from "@/src/components/OrgSwitcher";
import { SearchPalette } from "@/src/components/SearchPalette";
import { 
  getStats, 
  getSettings, 
  AppSettings, 
  getItems, 
  updateItem, 
  saveSettings, 
  createItem, 
  deleteItem,
  getCurrentSession,
  logout
} from "@/lib/api";
import { Task, Workspace, MyOSNotification } from "@/src/types";
import { NotificationCenter } from "@/src/components/NotificationCenter";
import { InvitationModal } from "@/src/components/InvitationModal";

type ActivePage = "dashboard" | "todo" | "workspaces" | "projects" | "calendar" | "finance" | "notes" | "docs" | "links" | "settings" | "tools";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  pingStatus: "pending" | "healthy" | "failed";
  storageStatus: "pending" | "healthy" | "failed";
}

class SystemErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    pingStatus: "pending",
    storageStatus: "pending",
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.runDiagnostics();
  }

  private async runDiagnostics() {
    // 1. Check LocalStorage
    try {
      localStorage.setItem("myos:diagnostic_test", "ok");
      localStorage.removeItem("myos:diagnostic_test");
      this.setState({ storageStatus: "healthy" });
    } catch {
      this.setState({ storageStatus: "failed" });
    }

    // 2. Check Server Connection & DB Health
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        this.setState({ pingStatus: "healthy" });
      } else {
        this.setState({ pingStatus: "failed" });
      }
    } catch {
      this.setState({ pingStatus: "failed" });
    }
  }

  private downloadReport = () => {
    const report = `=========================================
MYOS SYSTEM DIAGNOSTIC REPORT
Timestamp: ${new Date().toISOString()}
=========================================
Error Type: ${this.state.error?.name || "Unknown"}
Error Message: ${this.state.error?.message || "No message available"}

Stack Trace:
${this.state.error?.stack || "No stack trace available"}

Component Stack:
${this.state.errorInfo?.componentStack || "No component stack available"}

System Status:
- Network Online: ${typeof navigator !== "undefined" ? navigator.onLine : "unknown"}
- Local Storage: ${this.state.storageStatus}
- Core Server Response: ${this.state.pingStatus}
=========================================`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `myos-diagnostic-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  private hotReboot = () => {
    // Clear path state to go back to dashboard safe zone
    try {
      window.history.pushState({}, "", "/");
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen h-screen bg-slate-950 text-slate-100 font-mono p-4 sm:p-12 flex flex-col justify-between overflow-y-auto selection:bg-red-500/30 relative z-[99999]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.06),transparent_70%)] pointer-events-none" />
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-red-500/20 pb-6 mb-8 gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-[5px]-full bg-red-500 animate-ping shrink-0" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-red-500 uppercase font-mono">System Core Protection Activated</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-mono">Core Runtime Diagnostics Panel v1.2</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-red-950/40 border border-red-800/30 text-red-400 text-[10px] font-bold uppercase tracking-widest font-mono">
              Status Code: 500 SYSTEM CRASH
            </div>
          </div>

          {/* Body Console Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 relative z-10">
            {/* Left Column: Diagnostics Report */}
            <div className="space-y-6">
              <div className="bg-slate-900/60 border border-slate-800/50 p-6 space-y-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800/50 pb-2">Environmental Health</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 uppercase">Local Storage Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${this.state.storageStatus === "healthy" ? "text-emerald-400" : this.state.storageStatus === "failed" ? "text-red-400" : "text-amber-400"}`}>
                      {this.state.storageStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 uppercase">Network Online Status:</span>
                    <span className={`font-bold uppercase tracking-wider ${typeof navigator !== "undefined" && navigator.onLine ? "text-emerald-400" : "text-red-400"}`}>
                      {typeof navigator !== "undefined" && navigator.onLine ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 uppercase">Core Server Link:</span>
                    <span className={`font-bold uppercase tracking-wider ${this.state.pingStatus === "healthy" ? "text-emerald-400" : this.state.pingStatus === "failed" ? "text-red-400" : "text-amber-400"}`}>
                      {this.state.pingStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/50 p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800/50 pb-2">Action Protocols</h2>
                <button
                  onClick={this.hotReboot}
                  className="w-full py-3 bg-red-950/20 border border-red-800/40 text-red-400 font-bold text-xs uppercase tracking-widest transition-all hover:bg-red-950/40 hover:border-red-500 hover:text-white"
                >
                  Hot-Patch & Reboot Core
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-slate-950 border border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-widest transition-all hover:bg-slate-900 hover:text-white"
                >
                  Deep Reload Module
                </button>
                <button
                  onClick={this.downloadReport}
                  className="w-full py-3 bg-slate-950 border border-slate-800 text-slate-400 font-bold text-xs uppercase tracking-widest transition-all hover:bg-slate-900 hover:text-white"
                >
                  Generate Diagnostics Report
                </button>
              </div>
            </div>

            {/* Right Columns: Core Log Viewer */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="bg-slate-900/40 border border-slate-800/50 flex-1 flex flex-col min-h-[300px]">
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-800/80 flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Trace Console log</span>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[5px]-full bg-red-500/30" />
                    <span className="w-2.5 h-2.5 rounded-[5px]-full bg-amber-500/30" />
                    <span className="w-2.5 h-2.5 rounded-[5px]-full bg-emerald-500/30" />
                  </div>
                </div>
                <div className="p-6 overflow-auto text-xs space-y-4 max-h-[500px]">
                  <div>
                    <span className="text-red-400 font-bold font-mono">CRITICAL EXCEPTION CAUGHT:</span>
                    <p className="text-red-500 font-bold mt-1 text-sm bg-red-950/20 p-3 border-l-2 border-red-500">{this.state.error?.toString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold uppercase tracking-widest">Stack Trace:</span>
                    <pre className="text-slate-400 whitespace-pre-wrap font-mono leading-relaxed bg-slate-950 p-4 border border-slate-900 mt-2 text-[11px] overflow-x-auto select-text">
                      {this.state.error?.stack || "No trace found"}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <span className="text-slate-500 font-bold uppercase tracking-widest">Component Tree Call:</span>
                      <pre className="text-slate-400 whitespace-pre-wrap font-mono leading-relaxed bg-slate-950 p-4 border border-slate-900 mt-2 text-[11px] overflow-x-auto select-text">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-900 pt-6 mt-8 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-600 font-mono relative z-10">
            <span className="uppercase tracking-widest">Core Protection Protocol Active</span>
            <span className="mt-2 sm:mt-0 font-mono">SYSTEM INTEGRITY: RESTORED VIA HOT-PATCH ZONE</span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <SystemErrorBoundary>
      <TooltipProvider>
        <SidebarProvider>
          <AppContent />
        </SidebarProvider>
      </TooltipProvider>
    </SystemErrorBoundary>
  );
}

function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, "");
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return "217.2 91.2% 59.8%";
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function AppContent() {
  const getPageFromPath = (): ActivePage => {
    const path = window.location.pathname.replace("/", "") as ActivePage;
    const validPages: ActivePage[] = ["dashboard", "todo", "workspaces", "projects", "calendar", "finance", "notes", "docs", "links", "settings", "tools"];
    return validPages.includes(path) ? path : "dashboard";
  };

  const [activePage, setActivePage] = useState<ActivePage>(getPageFromPath);
  const [sessionUser, setSessionUser] = useState<any>(() => getCurrentSession());
  const initialThemeLoadedRef = React.useRef(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const cached = localStorage.getItem("myos_theme") || "dark";
      if (cached === "dark") return true;
      if (cached === "light") return false;
      if (cached === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
    } catch (e) {}
    return true; // default dark
  });
  const [profile, setProfile] = useState<AppSettings>({
    profile_name: "",
    profile_role: "",
    profile_avatar: "",
    theme: "dark",
    accent_color: "#22c55e",
    ui_grid_enabled: true,
    ui_animations_enabled: true,
    sound_volume: 80,
    ui_font_preset: "sans",
    ui_grid_size: "medium",
    ui_glass_opacity: 10
  });

  const [notifications, setNotifications] = useState<MyOSNotification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadNotifications = async () => {
    try {
      const list = await getItems<MyOSNotification>("notification");
      list.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      setNotifications(list);
      return list;
    } catch (err) {
      console.error("Failed to load notifications:", err);
      return [];
    }
  };

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      
      const volumeFactor = profile.sound_volume !== undefined ? profile.sound_volume / 100 : 0.8;
      const targetGain = 0.1 * volumeFactor;
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
      gain.gain.setValueAtTime(targetGain, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.warn("Web Audio API sound trigger failed:", e);
    }
  };

  const triggerNotification = async (title: string, message: string, category: MyOSNotification["category"], link_to?: string) => {
    try {
      const newItem = await createItem({
        type: "notification",
        title,
        message,
        category,
        read: false,
        link_to,
        created_at: new Date().toISOString()
      });
      setNotifications(prev => [newItem as MyOSNotification, ...prev]);
      playNotificationSound();
    } catch (err) {
      console.error("Failed to trigger notification in DB, falling back to transient state:", err);
      // Fallback: Add transient notification to UI state so user still gets full visual feedback
      const transientItem: MyOSNotification = {
        id: "transient_" + Math.random().toString(36).substring(2, 11),
        type: "notification",
        title,
        message: `${message} (Local Cache Only)`,
        category,
        read: false,
        link_to,
        created_at: new Date().toISOString()
      };
      setNotifications(prev => [transientItem, ...prev]);
      playNotificationSound();
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const notif = notifications.find(n => n.id === id);
      if (!notif) return;
      const updated = { ...notif, read: true };
      await updateItem(id, updated);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateItem(n.id, { ...n, read: true })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      await Promise.all(notifications.map(n => deleteItem(n.id)));
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear all notifications:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteItem(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  // Load notifications and run deadline scanner
  useEffect(() => {
    const initNotificationsAndDeadlines = async () => {
      const activeNotifs = await loadNotifications();
      
      try {
        const tasks = await getItems<Task>("task");
        const incompleteTasks = tasks.filter(t => t.status !== "completed" && t.status !== "archived");
        
        const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const todayTime = new Date(todayStr).getTime();
        
        for (const task of incompleteTasks) {
          if (!task.due_date) continue;
          
          const dueTime = new Date(task.due_date).getTime();
          const isOverdue = dueTime < todayTime;
          const isDueToday = dueTime === todayTime;
          
          if (isOverdue || isDueToday) {
            const expectedTitle = isOverdue 
              ? `Overdue Alert: ${task.title}` 
              : `Deadline Warning: ${task.title}`;
              
            const alreadyNotified = activeNotifs.some(n => n.title === expectedTitle);
            
            if (!alreadyNotified) {
              const message = isOverdue
                ? `Task "${task.title}" was due on ${task.due_date} and is currently overdue.`
                : `Task "${task.title}" is due today. Make sure to complete it!`;
                
              await createItem({
                type: "notification",
                title: expectedTitle,
                message,
                category: "task",
                read: false,
                link_to: "todo",
                created_at: new Date().toISOString()
              });
            }
          }
        }
        
        loadNotifications();
      } catch (err) {
        console.error("Failed in deadline scanning:", err);
      }
    };
    
    initNotificationsAndDeadlines();
  }, []);

  // Listen for Custom Event triggers
  useEffect(() => {
    const handleCustomNotification = (e: Event) => {
      const customEvent = e as CustomEvent<{
        title: string;
        message: string;
        category: MyOSNotification["category"];
        link_to?: string;
      }>;
      if (customEvent.detail) {
        const { title, message, category, link_to } = customEvent.detail;
        triggerNotification(title, message, category, link_to);
      }
    };

    window.addEventListener("myos:notification" as any, handleCustomNotification);
    return () => window.removeEventListener("myos:notification" as any, handleCustomNotification);
  }, [notifications]);

  // Unified Custom Event Navigation & Auto Global Error Catcher
  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ page: string }>;
      if (customEvent.detail && typeof customEvent.detail.page === "string") {
        navigateToPage(customEvent.detail.page);
      }
    };

    const handleGlobalError = (event: ErrorEvent) => {
      // Filter out noisy minor browser extension or third party issues
      if (event.message?.includes("ResizeObserver") || event.message?.includes("Script error")) return;
      
      triggerNotification(
        "Runtime Diagnostic Exception",
        event.message || "An uncaught runtime script exception has occurred in the client context.",
        "system"
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      
      triggerNotification(
        "Asynchronous Network Exception",
        message || "An unhandled asynchronous Promise reject event has occurred.",
        "system"
      );
    };

    window.addEventListener("myos:navigate" as any, handleNavigate);
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("myos:navigate" as any, handleNavigate);
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [notifications]);

  const navigateToPage = (page: ActivePage | string) => {
    if (page.startsWith("invitation-modal:")) {
      const id = page.split(":")[1];
      if (id) setPendingInviteId(id);
      return;
    }
    const path = page === "dashboard" ? "/" : `/${page}`;
    window.history.pushState({}, "", path);
    setActivePage(page as ActivePage);
  };

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(getPageFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Helper to resolve theme settings safely
  const resolveTheme = (themeName: "light" | "dark" | "system") => {
    if (themeName === "dark") return true;
    if (themeName === "light") return false;
    if (themeName === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true; // default dark
  };

  const syncProfileAndSettings = () => {
    getSettings().then((s) => {
      // Merge fetched settings into profile state
      setProfile(prev => {
        let hasDiff = false;
        for (const key of Object.keys(s) as Array<keyof AppSettings>) {
          if (prev[key] !== s[key]) {
            hasDiff = true;
            break;
          }
        }
        if (!hasDiff) return prev;
        return { ...prev, ...s };
      });
      
      if (s.theme && !initialThemeLoadedRef.current) {
        setIsDarkMode(resolveTheme(s.theme));
        localStorage.setItem("myos_theme", s.theme);
        initialThemeLoadedRef.current = true;
      }

      // Keep sessionUser perfectly synchronized in real time
      setSessionUser(prevUser => {
        if (!prevUser) return prevUser;
        
        const nextDisplayName = s.profile_name !== undefined ? s.profile_name : prevUser.display_name;
        const nextRoleTitle = s.profile_role !== undefined ? s.profile_role : prevUser.role_title;
        const nextAvatarUrl = s.profile_avatar !== undefined ? s.profile_avatar : prevUser.avatar_url;
        const nextEmail = s.email !== undefined ? s.email : prevUser.email;
        const nextDob = s.dob !== undefined ? s.dob : prevUser.dob;

        if (
          prevUser.display_name === nextDisplayName &&
          prevUser.role_title === nextRoleTitle &&
          prevUser.avatar_url === nextAvatarUrl &&
          prevUser.email === nextEmail &&
          prevUser.dob === nextDob
        ) {
          return prevUser;
        }

        const updatedUser = {
          ...prevUser,
          display_name: nextDisplayName,
          role_title: nextRoleTitle,
          avatar_url: nextAvatarUrl,
          email: nextEmail,
          dob: nextDob,
        };
        localStorage.setItem("myos_session_user", JSON.stringify(updatedUser));
        return updatedUser;
      });
    }).catch(() => {});
  };

  useEffect(() => {
    syncProfileAndSettings();
  }, [sessionUser]);

  useEffect(() => {
    // Fresh session reverification check on start to guarantee perfect sync on reload
    if (sessionUser) {
      fetch("/api/auth/session", {
        headers: {
          "Authorization": `Bearer ${sessionUser.id}`
        }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(freshUser => {
        if (freshUser) {
          const updatedUser = {
            id: freshUser.id,
            username: freshUser.username,
            email: freshUser.email || "",
            dob: freshUser.dob || "",
            display_name: freshUser.display_name,
            role_title: freshUser.role_title,
            avatar_url: freshUser.avatar_url,
          };
          setSessionUser(updatedUser);
          localStorage.setItem("myos_session_user", JSON.stringify(updatedUser));
        }
      })
      .catch(() => {});
    }

    window.addEventListener("myos:data-changed", syncProfileAndSettings);
    return () => window.removeEventListener("myos:data-changed", syncProfileAndSettings);
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    
    // Global Real-Time Background Synchronization Engine
    // Polls quietly every 10 seconds. Since getItems uses deduplication and 
    // stale-while-revalidate, this is extremely lightweight and will only
    // trigger a UI re-render (via myos:data-changed) if the data actually changed on the server!
    const syncInterval = setInterval(() => {
      getItems("task");
      getItems("project");
      getItems("workspace");
      getItems("notification");
      getItems("tool");
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [sessionUser]);

  useEffect(() => {
    const handleThemePreview = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: "light" | "dark" | "system" }>;
      if (customEvent.detail && customEvent.detail.theme) {
        setIsDarkMode(resolveTheme(customEvent.detail.theme));
      }
    };
    window.addEventListener("myos:theme-preview" as any, handleThemePreview);
    return () => window.removeEventListener("myos:theme-preview" as any, handleThemePreview);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Listen to prefers-color-scheme changes when system theme is active
  useEffect(() => {
    if (profile.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [profile.theme]);

  // Unified dynamic appearance properties propagation effect
  useEffect(() => {
    const root = window.document.documentElement;

    if (!sessionUser) {
      // Force system default green theme and Inter font when not logged in
      root.style.setProperty("--primary", "142.1 70.6% 45.3%");
      root.style.setProperty("--ring", "142.1 70.6% 45.3%");
      root.style.setProperty("--font-sans", '"Inter", sans-serif');
      root.style.setProperty("--grid-size", "32px");
      root.style.setProperty("--glass-opacity", "0.1");
      return;
    }

    // 1. Accent color HSL override propagation
    if (profile.accent_color) {
      const hslVal = hexToHsl(profile.accent_color);
      root.style.setProperty("--primary", hslVal);
      root.style.setProperty("--ring", hslVal);
    }

    // 2. Custom typography preset dynamic loader
    const fontPreset = profile.ui_font_preset || "sans";
    const loadFont = (id: string, href: string) => {
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    };

    if (fontPreset === "cyber") {
      loadFont("myos-font-cyber", "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap");
      root.style.setProperty("--font-sans", '"Share Tech Mono", monospace');
    } else if (fontPreset === "futuristic") {
      loadFont("myos-font-futuristic", "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap");
      root.style.setProperty("--font-sans", '"Outfit", sans-serif');
    } else if (fontPreset === "mono") {
      root.style.setProperty("--font-sans", '"JetBrains Mono", monospace');
    } else {
      root.style.setProperty("--font-sans", '"Inter", sans-serif');
    }

    // 3. Cyber Grid density customization size override
    const gridSize = profile.ui_grid_size || "medium";
    const sizes = { dense: "16px", medium: "32px", wide: "64px" };
    root.style.setProperty("--grid-size", sizes[gridSize]);

    // 4. Glassmorphism opacity background overlay scale
    const glassPct = profile.ui_glass_opacity !== undefined ? profile.ui_glass_opacity : 10;
    root.style.setProperty("--glass-opacity", String(glassPct / 100));

  }, [profile.accent_color, profile.ui_font_preset, profile.ui_grid_size, profile.ui_glass_opacity]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "todo", label: "Todo List", icon: CheckSquare },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "workspaces", label: "Workspaces", icon: Briefcase },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "finance", label: "Finance", icon: Wallet },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "docs", label: "Files", icon: FolderOpen },
    { id: "links", label: "Quick Links", icon: Link2 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardView profile={profile} sessionUser={sessionUser} />;
      case "todo":
        return <TodoView />;
      case "notes":
        return <NotesView />;
      case "workspaces":
        return <WorkspacesView />;
      case "projects":
        return <ProjectsView />;
      case "finance":
        return <FinanceView />;
      case "calendar":
        return <CalendarView />;
      case "tools":
        return <ToolsView />;
      case "docs":
        return <FileVaultView />;
      case "links":
        return <QuickLinksView />;
      case "settings":
        return (
          <SettingsView 
            profile={profile}
            onSave={(updatedSettings) => {
              setProfile(prev => ({ ...prev, ...updatedSettings }));
              if (updatedSettings.theme) {
                setIsDarkMode(resolveTheme(updatedSettings.theme));
                localStorage.setItem("myos_theme", updatedSettings.theme);
              }
              if (sessionUser) {
                const updatedUser = {
                  ...sessionUser,
                  display_name: updatedSettings.profile_name !== undefined ? updatedSettings.profile_name : sessionUser.display_name,
                  role_title: updatedSettings.profile_role !== undefined ? updatedSettings.profile_role : sessionUser.role_title,
                  avatar_url: updatedSettings.profile_avatar !== undefined ? updatedSettings.profile_avatar : sessionUser.avatar_url,
                  email: updatedSettings.email !== undefined ? updatedSettings.email : sessionUser.email,
                  dob: updatedSettings.dob !== undefined ? updatedSettings.dob : sessionUser.dob,
                };
                setSessionUser(updatedUser);
                localStorage.setItem("myos_session_user", JSON.stringify(updatedUser));
              }
            }} 
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-[5px]-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">{(activePage as string).toUpperCase()} Module</h2>
            <p className="max-w-md">Under active configuration cycle.</p>
          </div>
        );
    }
  };

  const { isMobile, setOpenMobile } = useSidebar();

  if (!sessionUser) {
    return <LoginPanel onAuthSuccess={(user) => setSessionUser(user)} />;
  }

  return (
    <div className={cn("flex h-screen w-full overflow-hidden", isDarkMode && "dark")}>
          <Sidebar collapsible="icon" className="border-r border-border/50 bg-background shadow-xl">
            <SidebarHeader className="h-20 flex items-center border-b border-border/50 px-6 group-data-[state=collapsed]:px-0 group-data-[state=collapsed]:justify-center relative">
              <div className="flex items-center gap-3 group-data-[state=collapsed]:gap-0 group-data-[state=collapsed]:justify-center">
                <img src="/logo.svg" alt="MyOS Logo" className="w-14 h-14 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 object-contain shrink-0 transition-transform duration-300 hover:scale-105" />
                <span className="font-extrabold text-xl tracking-tight group-data-[state=collapsed]:hidden uppercase">{profile.system_name || "MYOS"}</span>
              </div>
            </SidebarHeader>
            <SidebarContent className="py-6">
              <SidebarGroup>
                <SidebarGroupLabel className="px-6 mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 group-data-[state=collapsed]:hidden font-mono">
                  Main Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="px-3 group-data-[state=collapsed]:px-0 gap-2">
                    {navItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton 
                          isActive={activePage === item.id}
                          onClick={() => {
                            navigateToPage(item.id as ActivePage);
                            if (isMobile) {
                              setOpenMobile(false);
                            }
                          }}
                          className={cn(
                            "w-full px-4 py-3 transition-all duration-300 rounded-[5px] flex items-center gap-4 group/btn",
                            "group-data-[state=collapsed]:px-0 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:py-3 group-data-[state=collapsed]:h-12 group-data-[state=collapsed]:w-12 group-data-[state=collapsed]:mx-auto",
                            activePage === item.id 
                              ? "bg-secondary text-primary font-bold shadow-sm" 
                              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                          )}
                        >
                          <item.icon className={cn("w-5 h-5 transition-transform group-hover/btn:scale-110 shrink-0", activePage === item.id ? "text-primary" : "text-muted-foreground")} />
                          <span className="group-data-[state=collapsed]:hidden tracking-tight">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <div className="mt-auto p-4 border-t border-border/50 space-y-4 flex flex-col items-center">
              <div className="w-full group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 p-0.5 bg-secondary/40 rounded-[5px] border border-border/20 flex group-data-[state=collapsed]:justify-center shrink-0">
                <button
                  onClick={async () => {
                    setIsDarkMode(false);
                    localStorage.setItem("myos_theme", "light");
                    try {
                      await saveSettings({ ...profile, theme: "light" });
                      setProfile(prev => ({ ...prev, theme: "light" }));
                      window.dispatchEvent(new CustomEvent("myos:data-changed"));
                    } catch (err) {}
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[8px] font-bold uppercase tracking-widest transition-all rounded-[5px] font-mono group-data-[state=collapsed]:hidden",
                    !isDarkMode ? "bg-background text-primary shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-border/25" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Light
                </button>
                <button
                  onClick={async () => {
                    setIsDarkMode(true);
                    localStorage.setItem("myos_theme", "dark");
                    try {
                      await saveSettings({ ...profile, theme: "dark" });
                      setProfile(prev => ({ ...prev, theme: "dark" }));
                      window.dispatchEvent(new CustomEvent("myos:data-changed"));
                    } catch (err) {}
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[8px] font-bold uppercase tracking-widest transition-all rounded-[5px] font-mono group-data-[state=collapsed]:hidden",
                    isDarkMode ? "bg-background text-primary shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-border/25" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="w-3.5 h-3.5 text-blue-500" />
                  Dark
                </button>
                <button
                  onClick={async () => {
                    const nextMode = !isDarkMode;
                    setIsDarkMode(nextMode);
                    localStorage.setItem("myos_theme", nextMode ? "dark" : "light");
                    try {
                      await saveSettings({ ...profile, theme: nextMode ? "dark" : "light" });
                      setProfile(prev => ({ ...prev, theme: nextMode ? "dark" : "light" }));
                      window.dispatchEvent(new CustomEvent("myos:data-changed"));
                    } catch (err) {}
                  }}
                  className="hidden group-data-[state=collapsed]:flex w-9 h-9 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-blue-500" />}
                </button>
              </div>
              <div className="bg-secondary/30 p-4 group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:bg-transparent group-data-[state=collapsed]:border-none rounded-[5px] flex items-center group-data-[state=collapsed]:justify-center gap-4 border border-border/10 w-full shrink-0">
                <Avatar className="w-10 h-10 border-2 border-background/20 shrink-0">
                  <AvatarImage src={resolveDriveImage(profile.profile_avatar || sessionUser.avatar_url)} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold font-mono">
                    {(profile.profile_name || sessionUser.display_name || "")?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden group-data-[state=collapsed]:hidden">
                  <p className="text-sm font-bold truncate leading-none mb-1.5">{profile.profile_name || sessionUser.display_name}</p>
                  <p className="text-[9px] uppercase font-bold text-primary truncate leading-none tracking-widest font-mono">{profile.profile_role || sessionUser.role_title}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setSessionUser(null);
                  }}
                  className="h-8 w-8 rounded-[5px] border border-border/40 hover:border-red-500/50 hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-all shrink-0 group-data-[state=collapsed]:hidden"
                  title="Session Log Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              
              {/* Premium Credit Tag for owner Keo Moni */}
              <div className="text-center group-data-[state=collapsed]:hidden opacity-40 hover:opacity-100 transition-opacity pt-1 select-none">
                <p className="text-[8px] font-mono tracking-[0.2em] uppercase text-muted-foreground">
                  MyOS Platform • Designed by Keo Moni
                </p>
              </div>
            </div>
          </Sidebar>

          <SidebarInset className={cn("flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative", profile?.ui_grid_enabled && "cyber-grid")}>
            {profile?.ui_animations_enabled !== false && (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.05),transparent)] pointer-events-none" />
            )}
            
            <header className="h-20 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
              <div className="flex items-center gap-3 sm:gap-6 flex-1">
                <SidebarTrigger className="hover:bg-secondary rounded-[5px] h-10 w-10 shrink-0" />
                <OrgSwitcher />
                <div className="relative max-w-sm w-full hidden lg:block cursor-pointer" onClick={() => setSearchOpen(true)}>
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                  <Input 
                    placeholder="Search everything..." 
                    readOnly
                    className="pl-11 pr-12 bg-secondary/50 border-border/20 focus-visible:ring-primary h-11 rounded-[5px] w-full transition-all duration-500 focus:bg-background focus:shadow-2xl cursor-pointer select-none"
                  />
                  <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-border/30 bg-muted/80 text-[10px] font-mono text-muted-foreground/75 pointer-events-none select-none">
                    ⌘K
                  </kbd>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden sm:flex items-center gap-2 mr-2">
                   <div className="w-2 h-2 rounded-[5px]-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-bold text-emerald-500/80 font-mono tracking-widest uppercase">Connected</span>
                </div>
                <NotificationCenter
                  notifications={notifications}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                  onClearAll={handleClearAll}
                  onDelete={handleDeleteNotification}
                  navigateToPage={navigateToPage}
                />
                <Button 
                  onClick={() => {
                    navigateToPage("todo");
                    if (isMobile) {
                      setOpenMobile(false);
                    }
                  }}
                  className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-10 w-10 sm:w-auto sm:px-6 p-0 font-bold text-xs uppercase tracking-widest flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">New Task</span>
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar pb-24 md:pb-8">
              <div className="max-w-[1600px] mx-auto">
                {renderContent()}
              </div>
            </main>
          </SidebarInset>
          
          {/* Mobile Bottom Navigation Bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50 flex items-center px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-x-auto no-scrollbar safe-area-pb">
            <div className="flex items-center w-full justify-around min-w-[max-content] gap-2 px-2">
              {navItems.filter(item => ["dashboard", "todo", "projects", "workspaces", "settings"].includes(item.id)).map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigateToPage(item.id as ActivePage);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center w-16 h-14 rounded-[5px] transition-all duration-300 relative",
                      isActive ? "text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-[5px] shadow-[0_2px_10px_rgba(59,130,246,0.5)]" />
                    )}
                    <item.icon className={cn("w-5 h-5 mb-1 transition-transform", isActive && "scale-110")} />
                    <span className="text-[9px] font-bold tracking-widest uppercase">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setOpenMobile(true)}
                className="flex flex-col items-center justify-center w-16 h-14 rounded-[5px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-300 relative"
              >
                <Layout className="w-5 h-5 mb-1 transition-transform" />
                <span className="text-[9px] font-bold tracking-widest uppercase">More</span>
              </button>
            </div>
          </div>
          
          {pendingInviteId && (
            <InvitationModal
              assignmentId={pendingInviteId}
              onClose={() => setPendingInviteId(null)}
            />
          )}

          <SearchPalette
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            navigateToPage={navigateToPage}
          />
        </div>
  );
}

function DashboardView({ profile, sessionUser }: { profile: AppSettings; sessionUser: any }) {
  const [stats, setStats] = useState({
    tasks: 0,
    notes: 0,
    workspaces: 0,
    balance: 0,
  });
  const [realTasks, setRealTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  const loadData = async () => {
    try {
      const [statsData, tasksData, wsData] = await Promise.all([
        getStats(),
        getItems<Task>("task"),
        getItems<Workspace>("workspace")
      ]);
      setStats(statsData);
      setRealTasks(tasksData);
      setWorkspaces(wsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();

    const handleDataChanged = () => {
      loadData();
    };

    window.addEventListener("myos:data-changed", handleDataChanged);

    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => {
      window.removeEventListener("myos:data-changed", handleDataChanged);
      clearInterval(interval);
    };
  }, []);

  const activeIncompleteTasks = useMemo(() => {
    return realTasks.filter(t => t.status !== "completed" && t.status !== "archived");
  }, [realTasks]);

  const handleToggleTask = async (task: Task) => {
    const updated: Task = {
      ...task,
      status: task.status === "completed" ? "pending" : "completed"
    };
    try {
      await updateItem(task.id, updated);
      loadData();
    } catch (err) {
      console.error("Failed to toggle task from dashboard:", err);
    }
  };

  const statsItems = [
    { label: "Active Tasks", value: String(activeIncompleteTasks.length).padStart(2, "0"), color: "bg-blue-500", trend: "+2", status: "Active" },
    { label: "Workspaces", value: String(workspaces.length).padStart(2, "0"), color: "bg-purple-500", trend: "Stable", status: "Active" },
    { label: "Net Balance", value: `$${stats.balance.toLocaleString()}`, color: "bg-emerald-500", trend: "Live Balance", status: "Secured" },
    { label: "Notes", value: String(stats.notes).padStart(2, "0"), color: "bg-amber-500", trend: "Total Notes", status: "Saved" },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">System Online</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Welcome back, {profile.profile_name || sessionUser?.display_name}</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">You have {activeIncompleteTasks.length} tasks to focus on today.</p>
        </div>
        <div className="text-right p-8 bg-secondary/20 rounded-[5px] border border-border/50 backdrop-blur-2xl shadow-2xl min-w-[280px] relative group overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground/60 mb-3 font-mono relative z-10">Current Time</p>
          <p className="text-4xl font-mono tabular-nums font-bold tracking-tight relative z-10">{time}</p>
          <p className="text-[10px] font-bold text-primary mt-3 tracking-[0.3em] font-mono relative z-10">SYSTEM ONLINE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {statsItems.map((stat, i) => (
          <Card key={i} className="overflow-hidden border border-border/50 shadow-2xl glass-panel group hover:border-primary/50 transition-all duration-700 hover:-translate-y-2 rounded-[5px]">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div className={cn("w-16 h-16 rounded-[5px] flex items-center justify-center text-white shadow-2xl transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-700", stat.color)}>
                  {i === 0 && <CheckSquare className="w-8 h-8" />}
                  {i === 1 && <Briefcase className="w-8 h-8" />}
                  {i === 2 && <Wallet className="w-8 h-8" />}
                  {i === 3 && <FileText className="w-8 h-8" />}
                </div>
                <div className="flex flex-col items-end">
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 opacity-60 bg-secondary/80">{stat.status}</Badge>
                  <span className="text-[10px] font-bold text-primary font-mono tracking-widest">{stat.trend}</span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mb-2 font-mono">{stat.label}</p>
              <h3 className="text-4xl font-bold tracking-tighter font-mono">{stat.value}</h3>
              <div className="mt-10 pt-6 border-t border-border/5 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-all duration-500">
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest font-mono">View Details</span>
                <ChevronRight className="w-4 h-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-border/50 glass-panel overflow-hidden relative group shadow-2xl rounded-[5px]">
           {profile?.ui_animations_enabled !== false && (
             <div className="absolute top-0 right-0 p-4">
               <div className="w-60 h-60 bg-primary/5 rounded-[5px]-full blur-[140px] group-hover:bg-primary/20 transition-all duration-1000" />
             </div>
           )}
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-background/40 p-6">
            <CardTitle className="text-[9px] font-bold flex items-center gap-3 uppercase tracking-[0.35em] font-mono text-muted-foreground">
              <Layout className="w-5 h-5 text-primary" />
              Active Task Queue
            </CardTitle>
            <Badge className="bg-primary/10 text-primary border border-primary/20 shadow-inner text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-[5px]">LIVE FEED</Badge>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-border/10">
                {activeIncompleteTasks.length === 0 ? (
                  <div className="p-20 text-center text-muted-foreground/30">
                    <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest font-mono">No Active Tasks</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-wider font-mono">You're fully up to date!</p>
                  </div>
                ) : (
                  activeIncompleteTasks.slice(0, 5).map((t) => {
                    const parentWorkspace = workspaces.find(w => w.id === t.workspace_id);
                    return (
                      <div key={t.id} className="flex items-center gap-4 p-5 hover:bg-secondary/20 transition-all group/item cursor-pointer">
                        <div className="w-8 h-8 rounded-[5px] bg-background border border-border/40 flex items-center justify-center shrink-0 shadow-inner group-hover/item:border-primary transition-all duration-500">
                          <input
                            type="checkbox"
                            checked={t.status === "completed"}
                            onChange={() => handleToggleTask(t)}
                            className="w-3.5 h-3.5 rounded-[5px] bg-background/50 border-border/30 accent-primary text-primary focus:ring-0 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate group-hover/item:text-primary transition-all duration-500 tracking-tight">{t.title}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono">
                            <Badge variant="outline" className="text-[7px] uppercase font-bold tracking-[0.25em] px-1.5 py-0 border-border/50 opacity-40 group-hover/item:opacity-100">{t.priority || "Normal"}</Badge>
                            {parentWorkspace && (
                              <Badge 
                                style={{ borderColor: parentWorkspace.color, color: parentWorkspace.color }}
                                variant="outline" 
                                className="text-[7px] uppercase font-bold tracking-[0.25em] px-1.5 py-0 bg-background/40"
                              >
                                {parentWorkspace.name}
                              </Badge>
                            )}
                            {t.due_date && <span className="text-[7.5px] uppercase font-bold text-muted-foreground/60 tracking-[0.2em]">{t.due_date}</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                           <Badge className="text-[7px] font-bold py-1 px-2.5 uppercase tracking-[0.2em] rounded-[5px] bg-primary/10 text-primary border border-primary/20" variant="secondary">{t.status}</Badge>
                        </div>
                      </div>
                    );
                  })
                )}
             </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-[0_40px_80px_-15px_rgba(59,130,246,0.2)] bg-primary text-white overflow-hidden relative group rounded-[5px]">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/20 rounded-[5px]-full -translate-y-40 translate-x-40 blur-[100px] group-hover:scale-125 transition-transform duration-1000" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-black/20 rounded-[5px]-full translate-y-32 -translate-x-32 blur-[80px]" />
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-1.5 h-6 bg-white rounded-[5px]-full opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
                 <h3 className="text-2xl font-bold tracking-tight">Your Workspace</h3>
              </div>
              <p className="text-primary-foreground/90 text-xs font-bold mb-6 leading-relaxed tracking-tight">Manage all your workspaces, tasks, files, and notes in one convenient place.</p>
              <Button onClick={loadData} className="w-full font-bold uppercase tracking-[0.25em] text-[9px] h-11 shadow-2xl bg-white text-primary hover:bg-white/90 transition-all hover:scale-[1.03] active:scale-95 rounded-[5px]">Refresh Data</Button>
            </CardContent>
          </Card>

          {/* Active Workspaces Card Panel */}
          <Card className="border border-border/50 glass-panel rounded-[5px] shadow-2xl">
            <CardHeader className="border-b border-border/20 bg-background/30 p-5">
              <CardTitle className="text-[9px] font-bold uppercase tracking-[0.35em] font-mono text-muted-foreground flex items-center gap-3">
                <Briefcase className="w-4 h-4 text-primary" />
                Active Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/10">
                {workspaces.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground/30">
                    <p className="text-[10px] font-bold uppercase tracking-widest font-mono">No Workspaces Created</p>
                  </div>
                ) : (
                  workspaces.slice(0, 4).map((ws) => (
                    <div key={ws.id} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-all group cursor-pointer">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-6 h-6 rounded-[5px] bg-background border border-border/50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative" style={{ borderLeft: `2px solid ${ws.color || "#3b82f6"}` }}>
                          <SafeLogo
                            src={ws.logo ? resolveDriveImage(ws.logo) : undefined}
                            alt={ws.name}
                            className="w-full h-full object-cover"
                            fallbackIcon={<Briefcase className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />}
                          />
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-xs truncate">{ws.name}</p>
                          <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-mono truncate">{ws.company || "Personal"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[7.5px] font-mono font-bold tracking-widest px-2 opacity-50">ACTIVE</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
