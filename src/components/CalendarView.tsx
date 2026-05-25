import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Search, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Save, Clock, Trash2, Tag, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarEvent, Workspace, Task } from "@/src/types";
import { getItems, createItem, deleteItem, updateItem } from "@/lib/api";
import { cn } from "@/lib/utils";

// Curated Sleek Corporate Palettes for Events
const SPECTRUM_COLORS = [
  { hex: "#3b82f6", name: "Indigo" },
  { hex: "#14b8a6", name: "Neon Teal" },
  { hex: "#ec4899", name: "Rose Pink" },
  { hex: "#f59e0b", name: "Amber Gold" },
  { hex: "#10b981", name: "Cyber Green" },
  { hex: "#8b5cf6", name: "Purple Haze" },
  { hex: "#ef4444", name: "Crimson Red" }
];

const CLASSIFICATIONS = ["ALPHA", "BETA", "OMEGA"] as const;
type Classification = typeof CLASSIFICATIONS[number];

const emptyForm = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  category: "BETA" as Classification,
  color: "#3b82f6",
  workspace_id: "ALL"
};

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>("ALL");
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [viewType, setViewType] = useState<"month" | "week">("month");

  const loadData = useCallback(async () => {
    try {
      const [eventsData, workspacesData, tasksData] = await Promise.all([
        getItems<CalendarEvent>("event"),
        getItems<Workspace>("workspace"),
        getItems<Task>("task")
      ]);

      const workspaceMap = new Map(workspacesData.map(w => [w.id, w]));

      // 1. Dynamic Workspace Color Override for standard events
      const resolvedEvents = eventsData.map(e => {
        if (e.workspace_id) {
          const ws = workspaceMap.get(e.workspace_id);
          if (ws?.color) {
            return { ...e, color: ws.color };
          }
        }
        return e;
      });

      // 2. Map active (non-completed) Tasks with due dates into Calendar events
      const mappedTaskEvents = tasksData
        .filter(t => t.status !== "completed" && t.due_date)
        .map(t => {
          const ws = workspaceMap.get(t.workspace_id || "");
          const eventColor = ws?.color || (t.priority === "high" ? "#ef4444" : t.priority === "medium" ? "#f59e0b" : "#3b82f6");
          
          return {
            id: `task-${t.id}`,
            type: "event" as const,
            title: `[TASK] ${t.title}`,
            description: t.description || `Task priority: ${t.priority}`,
            start_time: `${t.due_date}T09:00:00`,
            end_time: `${t.due_date}T18:00:00`,
            category: t.priority === "high" ? ("ALPHA" as const) : t.priority === "medium" ? ("BETA" as const) : ("OMEGA" as const),
            color: eventColor,
            workspace_id: t.workspace_id
          };
        });

      setEvents([...resolvedEvents, ...mappedTaskEvents]);
      setWorkspaces(workspacesData);
    } catch (err) {
      console.error("Failed to load Calendar data:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Event Creation
  const handleCreate = async () => {
    if (!form.title.trim() || !form.start_time) return;

    const newEvent: Omit<CalendarEvent, "created_at" | "updated_at"> = {
      id: crypto.randomUUID(),
      type: "event",
      title: form.title,
      description: form.description || "Calendar event.",
      start_time: form.start_time,
      end_time: form.end_time || form.start_time,
      category: form.category,
      color: form.color,
      workspace_id: form.workspace_id === "ALL" ? undefined : form.workspace_id
    };

    try {
      await createItem(newEvent);
      setForm(emptyForm);
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error("Failed to create event:", err);
    }
  };

  const handleCompleteTask = useCallback(async (eventId: string) => {
    const originalTaskId = eventId.replace("task-", "");
    try {
      await updateItem(originalTaskId, { type: "task", status: "completed" });
      loadData();
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  }, [loadData]);

  const handleCompleteTaskAndClose = useCallback(async (eventId: string) => {
    await handleCompleteTask(eventId);
    setActiveEvent(null);
  }, [handleCompleteTask]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveEvent(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle Event Termination
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteItem(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  // Generate Month View Calendar Matrix
  const gridDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday...
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevTotalDays - i);
      days.push({ date: d, isCurrentMonth: false, key: `prev-${prevTotalDays - i}` });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }

    return days;
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const dayOfWeek = base.getDay();
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - dayOfWeek);
    
    const days: { date: Date; key: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push({ date: d, key: `week-${d.toISOString().split("T")[0]}` });
    }
    return days;
  }, [selectedDate]);

  const weekStartStr = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const startOfWeek = new Date(base);
    startOfWeek.setDate(base.getDate() - base.getDay());
    return startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [selectedDate]);

  // Navigate Periods (Adapt to Month or Week view)
  const prevPeriod = () => {
    if (viewType === "month") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    } else {
      const prevWeek = new Date(selectedDate || new Date());
      prevWeek.setDate(prevWeek.getDate() - 7);
      setSelectedDate(prevWeek);
      setCurrentMonth(prevWeek);
    }
  };

  const nextPeriod = () => {
    if (viewType === "month") {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    } else {
      const nextWeek = new Date(selectedDate || new Date());
      nextWeek.setDate(nextWeek.getDate() + 7);
      setSelectedDate(nextWeek);
      setCurrentMonth(nextWeek);
    }
  };

  // Advanced Filtering
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesLevel = filterLevel === "ALL" || e.category === filterLevel;
      const matchesWorkspace = filterWorkspaceId === "ALL" ||
                                (filterWorkspaceId === "GENERAL" && !e.workspace_id) ||
                                e.workspace_id === filterWorkspaceId;
      return matchesSearch && matchesLevel && matchesWorkspace;
    });
  }, [events, searchQuery, filterLevel, filterWorkspaceId]);

  // Selected Date Events List (Sidebar list)
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split("T")[0];
    return filteredEvents.filter(e => e.start_time.startsWith(dateStr));
  }, [selectedDate, filteredEvents]);

  const getCategoryClass = (category?: string) => {
    if (category === "ALPHA") return "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 font-extrabold";
    if (category === "BETA") return "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400 font-extrabold";
    return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 font-extrabold";
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-2">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold rounded-[8px]">Calendar</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Manage and schedule your events and tasks.</p>
        </div>
        <Button 
          onClick={() => { setForm(emptyForm); setShowForm(true); }}
          className="rounded-[8px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-14 px-8 font-bold text-xs uppercase tracking-[0.2em]"
        >
          <Plus className="w-5 h-5 mr-3" />
          Add Event
        </Button>
      </div>

      {/* Protocol Injector Form */}
      {showForm && (
        <div className="border border-primary/20 bg-primary/5 rounded-[8px] p-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold uppercase tracking-widest text-sm text-primary">Add New Event</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px]" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input 
              placeholder="Event Title" 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              className="bg-background/50 border-border/30 rounded-[8px] h-11" 
            />
            <Input 
              placeholder="Event Description" 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              className="bg-background/50 border-border/30 rounded-[8px] h-11" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Start Time</label>
              <input 
                type="datetime-local" 
                value={form.start_time} 
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} 
                className="h-11 px-4 rounded-[8px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">End Time</label>
              <input 
                type="datetime-local" 
                value={form.end_time} 
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} 
                className="h-11 px-4 rounded-[8px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Event Priority</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Classification })}
                className="h-11 px-4 rounded-[8px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c} Priority</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Select Workspace</label>
              <select
                value={form.workspace_id}
                onChange={(e) => {
                  const wsId = e.target.value;
                  const matchedWs = workspaces.find((w) => w.id === wsId);
                  setForm({
                    ...form,
                    workspace_id: wsId,
                    color: matchedWs?.color || form.color
                  });
                }}
                className="h-11 px-4 rounded-[8px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Workspaces</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Curated Color Spectrum Grid */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 font-mono">Event Color</p>
            <div className="flex flex-wrap gap-3">
              {SPECTRUM_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setForm({ ...form, color: c.hex })}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  className={cn(
                    "w-8 h-8 rounded-[8px] transition-all duration-300 transform active:scale-95 border",
                    form.color === c.hex
                      ? "ring-2 ring-primary border-white scale-110 shadow-lg"
                      : "border-transparent opacity-65 hover:opacity-100 hover:scale-105"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
            <Button 
              variant="outline" 
              onClick={() => { setShowForm(false); setForm(emptyForm); }} 
              className="rounded-[8px] border-border/50 px-8 h-11 font-bold uppercase tracking-widest text-[10px]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!form.title.trim() || !form.start_time} 
              className="rounded-[8px] bg-primary px-8 h-11 font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Event
            </Button>
          </div>
        </div>
      )}

      {/* Control and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex flex-1 w-full gap-3 sm:max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search events..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-12 bg-secondary/30 border-border/50 rounded-[8px]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filterWorkspaceId}
            onChange={(e) => setFilterWorkspaceId(e.target.value)}
            className="h-[54px] px-4 rounded-[8px] bg-secondary/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[160px]"
          >
            <option value="ALL">All Workspaces</option>
            <option value="GENERAL">General Events</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>

          <div className="flex p-1.5 bg-secondary/30 rounded-[8px] border border-border/50 min-w-max">
            {["ALL", "ALPHA", "BETA", "OMEGA"].map(lvl => (
              <Button
                key={lvl}
                variant={filterLevel === lvl ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterLevel(lvl)}
                className={cn(
                  "rounded-[8px] font-bold text-[10px] uppercase tracking-widest px-5 h-10",
                  filterLevel === lvl ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {lvl}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        
        {/* Left Side Controller */}
        <Card className="lg:col-span-1 border border-border/50 bg-secondary/20 backdrop-blur-xl shadow-2xl p-6 rounded-[8px] flex flex-col gap-6">
          <div className="border border-border/50 bg-background/50 p-2 rounded-[8px] flex justify-center">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  setSelectedDate(d);
                  setCurrentMonth(d);
                }
              }}
              className="rounded-[8px]"
            />
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60 font-mono">Events on this Day</h3>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {selectedDateEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground/30 text-[10px] border border-dashed border-border/40 rounded-[8px] bg-background/25 font-bold uppercase tracking-widest font-mono">
                  No events scheduled for this day
                </div>
              ) : (
                selectedDateEvents.map(e => {
                  const isTask = e.id.startsWith("task-");
                  const cleanTitle = isTask ? e.title.replace(/^\[TASK\]\s*/, "") : e.title;
                  return (
                    <div 
                      key={e.id} 
                      onClick={() => setActiveEvent(e)}
                      style={{ borderLeft: `3px solid ${e.color || "#3b82f6"}` }}
                      className="p-5 bg-background border border-border/50 rounded-[8px] hover:border-primary transition-all cursor-pointer group shadow-inner relative flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {isTask && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCompleteTask(e.id);
                              }}
                              className="h-5 w-5 rounded-full border border-primary/45 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all group/check shrink-0 cursor-pointer"
                              title="Mark Task Completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 opacity-0 group-hover/check:opacity-100 text-emerald-400 transition-opacity" />
                            </button>
                          )}
                          <p className="text-[9px] font-bold text-primary uppercase font-mono tracking-widest">
                            {e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "00:00"}
                          </p>
                        </div>
                        {!isTask && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-500 hover:bg-red-500/10 rounded-[8px] md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity shrink-0" 
                            onClick={(event) => handleDelete(e.id, event)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-sm font-bold group-hover:text-primary transition-colors tracking-tight leading-tight flex-1">
                        {isTask && <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-[8px] mr-1.5 uppercase font-mono mr-2">TASK</span>}
                        {cleanTitle}
                      </p>

                      {e.description && (
                        <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed line-clamp-2">{e.description}</p>
                      )}
                      
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/10">
                        <Badge variant="outline" className={cn("text-[8px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-[8px] font-mono border", getCategoryClass(e.category))}>{e.category}</Badge>
                        {e.workspace_id && (
                          <div className="flex items-center gap-1.5 text-[8px] font-mono font-bold text-muted-foreground/50">
                            <Layers className="w-2.5 h-2.5" />
                            <span>{workspaces.find(w => w.id === e.workspace_id)?.name || "WORKSPACE"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        {/* Right Side Massive Interactive Grid */}
        <Card className="lg:col-span-3 border border-border/50 bg-secondary/20 backdrop-blur-xl shadow-2xl overflow-hidden rounded-[8px] flex flex-col">
          <CardHeader className="border-b border-border/50 bg-background/50 p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tighter font-mono uppercase flex items-center gap-3 sm:gap-4 truncate">
                <CalendarIcon className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                {viewType === "month" 
                  ? currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : `Week of ${weekStartStr}`
                }
              </CardTitle>
              <div className="flex items-center gap-3 shrink-0">
                {/* View Switch Toggler Group */}
                <div className="flex p-1 bg-secondary/30 rounded-[8px] border border-border/40 mr-1 sm:mr-3">
                  <Button
                    type="button"
                    variant={viewType === "month" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewType("month")}
                    className={cn(
                      "rounded-[8px] font-bold text-[9px] uppercase tracking-widest px-3 sm:px-4 h-8 transition-all",
                      viewType === "month" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Month
                  </Button>
                  <Button
                    type="button"
                    variant={viewType === "week" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewType("week")}
                    className={cn(
                      "rounded-[8px] font-bold text-[9px] uppercase tracking-widest px-3 sm:px-4 h-8 transition-all",
                      viewType === "week" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Week
                  </Button>
                </div>

                <Button variant="outline" size="icon" className="rounded-[8px] h-10 w-10 border-border/50 hover:bg-secondary" onClick={prevPeriod}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-[8px] font-bold uppercase tracking-widest text-[10px] px-5 h-10 border-border/50 hover:bg-secondary"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                    setCurrentMonth(today);
                  }}
                >
                  Today
                </Button>
                <Button variant="outline" size="icon" className="rounded-[8px] h-10 w-10 border-border/50 hover:bg-secondary" onClick={nextPeriod}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-x-auto">
            {viewType === "month" ? (
              <div className="w-full min-w-[700px] lg:min-w-0 grid grid-cols-7 border-collapse">
                {/* Day Labels */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div 
                    key={day} 
                    className="p-2 sm:p-5 text-center text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground/80 border-b border-r border-border/20 bg-background/30 font-mono tracking-[0.15em] sm:tracking-[0.3em]"
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="inline sm:hidden">{day[0]}</span>
                  </div>
                ))}
                
                {/* Month Grid Cells */}
                {gridDays.map(({ date: d, isCurrentMonth, key }) => {
                  const dateStr = d.toISOString().split("T")[0];
                  const dayEvents = filteredEvents.filter(e => e.start_time.startsWith(dateStr));
                  const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                  const isToday = d.toDateString() === new Date().toDateString();
   
                  return (
                    <div 
                      key={key} 
                      onClick={() => {
                        setSelectedDate(d);
                      }}
                      className={cn(
                        "min-h-[70px] sm:min-h-[120px] p-1.5 sm:p-3 border-b border-r border-border/25 group hover:bg-primary/5 transition-all relative cursor-pointer flex flex-col gap-1 sm:gap-1.5 rounded-none",
                        isSelected ? "bg-primary/5 border-primary/50 shadow-inner" : "bg-transparent",
                        !isCurrentMonth && "opacity-35 hover:opacity-100"
                      )}
                    >
                       <span className={cn(
                         "text-[10px] sm:text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-[8px] font-mono",
                         isToday 
                           ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                           : isSelected
                           ? "text-primary border border-primary/45 font-extrabold"
                           : "text-muted-foreground group-hover:text-foreground font-semibold transition-colors"
                       )}>
                         {d.getDate()}
                       </span>
   
                       {/* Desktop Events View */}
                       <div className="hidden sm:block flex-1 space-y-1.5 overflow-y-auto max-h-[85px] custom-scrollbar">
                         {dayEvents.slice(0, 4).map(e => {
                           const isTask = e.id.startsWith("task-");
                           const cleanTitle = isTask ? e.title.replace(/^\[TASK\]\s*/, "") : e.title;
                           return (
                             <div 
                               key={e.id} 
                               onClick={(event) => {
                                 event.stopPropagation();
                                 setActiveEvent(e);
                               }}
                               style={{ borderLeft: `2.5px solid ${e.color || "#3b82f6"}` }}
                               className="px-2 py-1.5 bg-background border border-border/40 rounded-[8px] text-[8.5px] font-bold text-foreground/80 tracking-tight shadow-sm backdrop-blur-md hover:text-primary transition-colors flex items-center justify-between cursor-pointer"
                             >
                               <span className="truncate flex-1 pr-1 flex items-center gap-1">
                                 {isTask && <CheckCircle2 className="w-2.5 h-2.5 text-primary shrink-0" />}
                                 {cleanTitle}
                               </span>
                               <span className="text-[7.5px] font-mono opacity-50 shrink-0">
                                 {e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false }) : ""}
                               </span>
                             </div>
                           );
                         })}
                         {dayEvents.length > 4 && (
                           <div className="text-[8px] font-bold uppercase text-primary/80 font-mono tracking-widest pl-1">
                             + {dayEvents.length - 4} MORE
                           </div>
                         )}
                       </div>
  
                       {/* Mobile Events Dot View */}
                       <div className="flex sm:hidden flex-wrap gap-1 justify-center mt-1">
                         {dayEvents.slice(0, 3).map(e => (
                           <div 
                             key={e.id} 
                             style={{ backgroundColor: e.color || "#3b82f6" }} 
                             className="w-1.5 h-1.5 rounded-[8px] shadow-sm shrink-0" 
                           />
                         ))}
                         {dayEvents.length > 3 && (
                           <span className="text-[8px] font-extrabold text-primary font-mono leading-none">+</span>
                         )}
                       </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Premium Responsive Week View Grid */
              <div className="w-full min-w-[700px] lg:min-w-0 grid grid-cols-7 border-collapse">
                {weekDays.map(({ date: d, key }) => {
                  const dateStr = d.toISOString().split("T")[0];
                  const dayEvents = filteredEvents.filter(e => e.start_time.startsWith(dateStr));
                  const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                  const isToday = d.toDateString() === new Date().toDateString();
                  const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

                  return (
                    <div 
                      key={key}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        "min-h-[300px] sm:min-h-[420px] p-3 border-r border-b border-border/25 bg-transparent hover:bg-primary/5 transition-all flex flex-col gap-3 relative cursor-pointer rounded-none",
                        isSelected && "bg-primary/5 border-primary/50 shadow-inner"
                      )}
                    >
                      {/* Day Column Header */}
                      <div className="flex flex-col items-center gap-1 pb-3 border-b border-border/10">
                        <span className="text-[9px] font-bold uppercase font-mono tracking-widest text-muted-foreground/60">
                          {dayLabel}
                        </span>
                        <span className={cn(
                          "text-xs font-bold w-7 h-7 flex items-center justify-center rounded-[8px] font-mono",
                          isToday 
                            ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] font-extrabold" 
                            : isSelected
                            ? "text-primary border border-primary/45 font-extrabold"
                            : "text-muted-foreground font-semibold"
                        )}>
                          {d.getDate()}
                        </span>
                      </div>

                      {/* Stack of chronological events */}
                      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-0.5">
                        {dayEvents.length === 0 ? (
                          <div className="h-full flex items-center justify-center opacity-10">
                            <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        ) : (
                          dayEvents.map(e => {
                            const isTask = e.id.startsWith("task-");
                            const cleanTitle = isTask ? e.title.replace(/^\[TASK\]\s*/, "") : e.title;
                            return (
                              <div 
                                key={e.id} 
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveEvent(e);
                                }}
                                style={{ borderLeft: `3px solid ${e.color || "#3b82f6"}` }}
                                className="p-2.5 bg-background border border-border/40 rounded-[8px] hover:border-primary hover:text-primary transition-all duration-200 cursor-pointer shadow-sm relative group flex flex-col gap-1.5"
                              >
                                <div className="flex items-center justify-between text-[7.5px] font-mono text-muted-foreground/80">
                                  <span>
                                    {e.start_time ? new Date(e.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false }) : "00:00"}
                                  </span>
                                  {isTask && (
                                    <span className="text-[7px] font-bold text-primary bg-primary/10 border border-primary/20 px-1 py-0.5 rounded-[8px] uppercase">
                                      TASK
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-bold leading-snug truncate text-foreground group-hover:text-primary transition-colors">
                                  {cleanTitle}
                                </p>
                                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/5">
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-[7.5px] font-bold font-mono px-1 py-0 border rounded-[8px] uppercase", getCategoryClass(e.category))}
                                  >
                                    {e.category}
                                  </Badge>
                                  {isTask && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleCompleteTask(e.id);
                                      }}
                                      className="h-4 w-4 rounded-full border border-primary/45 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                      title="Complete Task"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Details Modal/Popover */}
      {activeEvent && (() => {
        const isTask = activeEvent.id.startsWith("task-");
        const cleanTitle = isTask ? activeEvent.title.replace(/^\[TASK\]\s*/, "") : activeEvent.title;
        const ws = workspaces.find(w => w.id === activeEvent.workspace_id);
        const startTime = new Date(activeEvent.start_time);
        const endTime = activeEvent.end_time ? new Date(activeEvent.end_time) : startTime;
        
        const formattedDate = startTime.toLocaleDateString("en-US", {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const formattedTime = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        return (
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setActiveEvent(null)}
          >
            <div 
              className="bg-secondary/40 border border-border/50 rounded-[8px] shadow-2xl max-w-lg w-full overflow-hidden relative animate-in scale-in duration-300 backdrop-blur-2xl"
              style={{ borderTop: `4px solid ${activeEvent.color || "#3b82f6"}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: activeEvent.color || "#3b82f6" }}
              />

              <div className="p-6 space-y-6 relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        style={{ color: activeEvent.color || "#3b82f6", borderColor: `${activeEvent.color || "#3b82f6"}30`, backgroundColor: `${activeEvent.color || "#3b82f6"}10` }}
                        className="text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-[8px]"
                      >
                        {isTask ? "TASK SOURCE" : "EVENT SOURCE"}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 font-mono border", getCategoryClass(activeEvent.category))}>
                        {activeEvent.category} Priority
                      </Badge>
                    </div>
                    <h3 className="text-xl font-extrabold tracking-tight leading-snug mt-2 text-foreground break-words">{cleanTitle}</h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-[8px] hover:bg-secondary/50" 
                    onClick={() => setActiveEvent(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4 pt-2 border-t border-border/10">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-[8px] bg-secondary/30 border border-border/30 flex items-center justify-center text-primary shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Scheduled Timing</p>
                      <p className="text-xs font-semibold text-foreground/90">{formattedDate}</p>
                      <p className="text-[11px] font-mono text-primary font-medium mt-0.5">{formattedTime}</p>
                    </div>
                  </div>

                  {ws && (
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-9 w-9 rounded-[8px] border flex items-center justify-center shrink-0"
                        style={{ color: ws.color, borderColor: `${ws.color}30`, backgroundColor: `${ws.color}15` }}
                      >
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Workspace Association</p>
                        <p className="text-xs font-semibold text-foreground/90">{ws.name}</p>
                        {ws.description && (
                          <p className="text-[10px] text-muted-foreground/50 leading-none mt-0.5">{ws.description}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground/60 font-mono tracking-wider">Description / Logs</p>
                    <div className="p-4 bg-background/50 border border-border/30 rounded-[8px] max-h-[140px] overflow-y-auto custom-scrollbar">
                      <p className="text-xs font-medium text-muted-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
                        {activeEvent.description || "No further information logged for this item."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/10">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveEvent(null)}
                    className="rounded-[8px] border-border/50 px-5 h-10 font-bold uppercase tracking-widest text-[10px]"
                  >
                    Close View
                  </Button>
                  
                  {isTask ? (
                    <Button 
                      onClick={() => handleCompleteTaskAndClose(activeEvent.id)}
                      className="rounded-[8px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest text-[10px] px-5 h-10 shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Task
                    </Button>
                  ) : (
                    <Button 
                      onClick={(event) => {
                        handleDelete(activeEvent.id, event);
                        setActiveEvent(null);
                      }}
                      className="rounded-[8px] bg-red-500 hover:bg-red-600 text-white font-bold uppercase tracking-widest text-[10px] px-5 h-10 shadow-[0_0_15px_rgba(239,68,68,0.25)] flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Event
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
