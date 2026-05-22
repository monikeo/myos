import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Search, 
  LayoutDashboard, 
  CheckSquare, 
  Layers, 
  FolderKanban, 
  DollarSign, 
  StickyNote, 
  Calendar, 
  Link as LinkIcon, 
  Wrench, 
  Settings, 
  CornerDownLeft, 
  Folder, 
  FileText, 
  User, 
  Briefcase 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getItems } from "@/lib/api";
import { Task, Workspace, Project } from "@/src/types";

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  navigateToPage: (page: string) => void;
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({ isOpen, onClose, navigateToPage }) => {
  const [query, setQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Static list of System Navigation Modules
  const navigationItems = useMemo(() => [
    { id: "dashboard", title: "Dashboard", description: "Central operations hub & analytics dashboard", icon: LayoutDashboard },
    { id: "todo", title: "Tasks & To-Dos", description: "Manage assignments, status tracker & pending tasks", icon: CheckSquare },
    { id: "workspaces", title: "Workspaces", description: "Manage corporate environments & workspace portals", icon: Layers },
    { id: "projects", title: "Projects", description: "Monitor active project timelines & critical priorities", icon: FolderKanban },
    { id: "finance", title: "Finance Tracking", description: "Personal & corporate budget, income & expense ledger", icon: DollarSign },
    { id: "notes", title: "Notes & Documents", description: "Rich markdown editor, scratchpad & personal notes", icon: StickyNote },
    { id: "calendar", title: "Calendar Scheduler", description: "Schedule active events, milestones & meetings", icon: Calendar },
    { id: "links", title: "Quick Links", description: "Save and bookmark system web links & references", icon: LinkIcon },
    { id: "tools", title: "Tools & Integrations", description: "Seeded system tools, external iframe launchports", icon: Wrench },
    { id: "settings", title: "System Settings", description: "Configure system name, design modes & themes", icon: Settings },
  ], []);

  // Fetch index data dynamically when opened
  useEffect(() => {
    if (!isOpen) return;

    const fetchSearchIndex = async () => {
      setLoading(true);
      try {
        const [wsResult, projResult, taskResult] = await Promise.allSettled([
          getItems<Workspace>("workspace"),
          getItems<Project>("project"),
          getItems<Task>("task")
        ]);

        if (wsResult.status === "fulfilled") setWorkspaces(wsResult.value);
        if (projResult.status === "fulfilled") setProjects(projResult.value);
        if (taskResult.status === "fulfilled") setTasks(taskResult.value);
      } catch (err) {
        console.error("Failed to load search index", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchIndex();
    setQuery("");
    setSelectedIndex(0);
    
    // Auto-focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [isOpen]);

  // Global escape key and shortcut listener inside SearchPalette component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Search filter computations
  const filteredNavigation = useMemo(() => {
    if (!query) return navigationItems;
    return navigationItems.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, navigationItems]);

  const filteredWorkspaces = useMemo(() => {
    if (!query) return workspaces.slice(0, 5);
    return workspaces.filter(ws => 
      ws.name.toLowerCase().includes(query.toLowerCase()) ||
      (ws.description && ws.description.toLowerCase().includes(query.toLowerCase())) ||
      (ws.company && ws.company.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query, workspaces]);

  const filteredProjects = useMemo(() => {
    if (!query) return projects.slice(0, 5);
    return projects.filter(proj => 
      proj.name.toLowerCase().includes(query.toLowerCase()) ||
      (proj.description && proj.description.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query, projects]);

  const filteredTasks = useMemo(() => {
    if (!query) return tasks.slice(0, 5);
    return tasks.filter(task => 
      task.title.toLowerCase().includes(query.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
    );
  }, [query, tasks]);

  // Combined flat list of results for simple index selection
  const flatResults = useMemo(() => {
    const list: any[] = [];
    
    filteredNavigation.forEach(item => list.push({ ...item, type: "navigation" }));
    filteredWorkspaces.forEach(ws => list.push({ id: ws.id, title: ws.name, description: ws.company || ws.description || "Workspace", type: "workspace", item: ws }));
    filteredProjects.forEach(proj => list.push({ id: proj.id, title: proj.name, description: proj.description || "Active Project", type: "project", item: proj }));
    filteredTasks.forEach(task => list.push({ id: task.id, title: task.title, description: task.description || `Task (${task.status})`, type: "task", item: task }));
    
    return list;
  }, [filteredNavigation, filteredWorkspaces, filteredProjects, filteredTasks]);

  // Keep index in range
  useEffect(() => {
    if (selectedIndex >= flatResults.length) {
      setSelectedIndex(Math.max(0, flatResults.length - 1));
    }
  }, [flatResults, selectedIndex]);

  // Handle select action
  const handleSelect = (item: any) => {
    if (!item) return;
    
    if (item.type === "navigation") {
      navigateToPage(item.id);
    } else if (item.type === "workspace") {
      navigateToPage("workspaces");
    } else if (item.type === "project") {
      navigateToPage("projects");
    } else if (item.type === "task") {
      navigateToPage("todo");
    }
    
    onClose();
  };

  // Keyboard navigation inside modal input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, flatResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatResults.length) % Math.max(1, flatResults.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults[selectedIndex]) {
        handleSelect(flatResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  // We group flat items to render headings beautifully
  let currentGlobalIndex = 0;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-background/50 backdrop-blur-md cursor-default animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        ref={containerRef}
        className="relative w-full max-w-2xl bg-background/95 border border-border/40 rounded-[5px] shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden glass-panel flex flex-col max-h-[60vh] animate-in zoom-in-95 duration-200"
      >
        {/* Neon laser accent line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

        {/* Search header container */}
        <div className="flex items-center px-4 border-b border-border/30 bg-transparent h-14 shrink-0 relative">
          <Search className="w-5 h-5 text-muted-foreground/60 mr-3.5 shrink-0" />
          <input 
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search tasks, projects, workspaces, and navigation..."
            className="w-full h-full bg-transparent border-0 outline-none text-foreground placeholder-muted-foreground/50 font-sans text-sm focus:ring-0"
          />
          {loading && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/70 animate-pulse shrink-0">
              Indexing...
            </span>
          )}
        </div>

        {/* Scrollable results body */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border">
          {flatResults.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground/60 font-mono text-xs">
              No matching records found in active operating directory.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Category 1: Navigation */}
              {filteredNavigation.length > 0 && (
                <div>
                  <h3 className="px-3 py-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground/50">
                    System Navigation & Modules
                  </h3>
                  <div className="mt-1 space-y-1">
                    {filteredNavigation.map((item) => {
                      const idx = currentGlobalIndex++;
                      const active = selectedIndex === idx;
                      return (
                        <div 
                          key={item.id}
                          onClick={() => handleSelect({ ...item, type: "navigation" })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-[5px] transition-all duration-150 cursor-pointer font-sans",
                            active 
                              ? "bg-primary/10 border-l-[3px] border-primary pl-2.5" 
                              : "hover:bg-secondary/40 border-l-[3px] border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded-[5px]", active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                              <item.icon className="w-4 h-4 shrink-0" />
                            </div>
                            <div>
                              <div className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>
                                {item.title}
                              </div>
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-sans leading-none">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-primary/70 animate-pulse mr-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category 2: Workspaces */}
              {filteredWorkspaces.length > 0 && (
                <div>
                  <h3 className="px-3 py-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground/50">
                    Active Workspaces
                  </h3>
                  <div className="mt-1 space-y-1">
                    {filteredWorkspaces.map((ws) => {
                      const idx = currentGlobalIndex++;
                      const active = selectedIndex === idx;
                      return (
                        <div 
                          key={ws.id}
                          onClick={() => handleSelect({ id: ws.id, type: "workspace", item: ws })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-[5px] transition-all duration-150 cursor-pointer font-sans",
                            active 
                              ? "bg-primary/10 border-l-[3px] border-primary pl-2.5" 
                              : "hover:bg-secondary/40 border-l-[3px] border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded-[5px]", active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                              <Layers className="w-4 h-4 shrink-0" />
                            </div>
                            <div>
                              <div className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>
                                {ws.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-sans leading-none">
                                {ws.company || ws.description || "Workspace Portal"}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-primary/70 animate-pulse mr-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category 3: Projects */}
              {filteredProjects.length > 0 && (
                <div>
                  <h3 className="px-3 py-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground/50">
                    Active Projects
                  </h3>
                  <div className="mt-1 space-y-1">
                    {filteredProjects.map((proj) => {
                      const idx = currentGlobalIndex++;
                      const active = selectedIndex === idx;
                      return (
                        <div 
                          key={proj.id}
                          onClick={() => handleSelect({ id: proj.id, type: "project", item: proj })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-[5px] transition-all duration-150 cursor-pointer font-sans",
                            active 
                              ? "bg-primary/10 border-l-[3px] border-primary pl-2.5" 
                              : "hover:bg-secondary/40 border-l-[3px] border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded-[5px]", active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                              <Folder className="w-4 h-4 shrink-0" />
                            </div>
                            <div>
                              <div className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>
                                {proj.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-sans leading-none">
                                {proj.description || "Active Project Board"}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-primary/70 animate-pulse mr-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category 4: Tasks */}
              {filteredTasks.length > 0 && (
                <div>
                  <h3 className="px-3 py-1.5 text-[9px] font-bold font-mono tracking-widest uppercase text-muted-foreground/50">
                    Active Tasks
                  </h3>
                  <div className="mt-1 space-y-1">
                    {filteredTasks.map((task) => {
                      const idx = currentGlobalIndex++;
                      const active = selectedIndex === idx;
                      return (
                        <div 
                          key={task.id}
                          onClick={() => handleSelect({ id: task.id, type: "task", item: task })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-[5px] transition-all duration-150 cursor-pointer font-sans",
                            active 
                              ? "bg-primary/10 border-l-[3px] border-primary pl-2.5" 
                              : "hover:bg-secondary/40 border-l-[3px] border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded-[5px]", active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                              <CheckSquare className="w-4 h-4 shrink-0" />
                            </div>
                            <div>
                              <div className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>
                                {task.title}
                              </div>
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-sans leading-none">
                                {task.description || `Task status: ${task.status}`}
                              </div>
                            </div>
                          </div>
                          {active && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-primary/70 animate-pulse mr-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Command palette footer info */}
        <div className="px-4 py-2 border-t border-border/30 bg-secondary/20 flex items-center justify-between font-mono text-[9px] text-muted-foreground/60 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <span><kbd className="bg-muted px-1 rounded-[5px] border border-border/30">↑↓</kbd> Navigate</span>
            <span><kbd className="bg-muted px-1 rounded-[5px] border border-border/30">Enter</kbd> Select</span>
            <span><kbd className="bg-muted px-1 rounded-[5px] border border-border/30">ESC</kbd> Close</span>
          </div>
          <div className="font-semibold text-primary/70 uppercase tracking-wider">
            Designed by Keo Moni
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
