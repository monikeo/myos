import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Columns, LayoutGrid, List as ListIcon, Calendar as CalendarIcon, ChevronRight, Circle, Clock, Flag, CheckSquare, Trash2, X, Save, AlertTriangle, Briefcase, Edit3, FolderKanban } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, resolveDriveImage } from "@/lib/utils";
import { Task, Workspace, Project } from "@/src/types";
import { getItems, createItem, updateItem, deleteItem, getSettings } from "@/lib/api";

type TaskStatus = "Backlog" | "Active" | "Review" | "Completed";
type TaskPriority = "High" | "Medium" | "Low";

const statusMapping: Record<TaskStatus, Task["status"]> = {
  Backlog: "pending",
  Active: "in-progress",
  Review: "review",
  Completed: "completed",
};

const revStatusMapping: Record<Task["status"], TaskStatus> = {
  pending: "Backlog",
  "in-progress": "Active",
  review: "Review",
  completed: "Completed",
  archived: "Completed",
};

export function TodoView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "All">("All");
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>("All");
  const [filterProjectId, setFilterProjectId] = useState<string>("All");
  const [viewStyle, setViewStyle] = useState<"board" | "list" | "grid">("board");
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ profile_name: string; profile_avatar: string }>({
    profile_name: "Alex Thorne",
    profile_avatar: "https://github.com/shadcn.png"
  });

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("Medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newCategory, setNewCategory] = useState("Development");
  const [newWorkspaceId, setNewWorkspaceId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");

  // Custom edit and delete triggers
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    const handleDataChanged = () => {
      loadTasks(true);
    };
    window.addEventListener("myos:data-changed", handleDataChanged);
    return () => window.removeEventListener("myos:data-changed", handleDataChanged);
  }, []);

  const loadTasks = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getItems<Task>("task");
      setTasks(data);
      const wsData = await getItems<Workspace>("workspace");
      setWorkspaces(wsData);
      const projData = await getItems<Project>("project");
      setProjects(projData);
      try {
        const settings = await getSettings();
        if (settings && settings.profile_name) {
          setProfile({
            profile_name: settings.profile_name,
            profile_avatar: settings.profile_avatar || "https://github.com/shadcn.png"
          });
        }
      } catch (err) {
        console.warn("Failed to load user profile in TodoView:", err);
      }
    } catch (err) {
      console.error("Failed to load tasks, workspaces & projects:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTitle(task.title || "");
    setNewDesc(task.description || "");
    
    // Bulletproof priority parsing
    let parsedPriority: TaskPriority = "Medium";
    if (task.priority) {
      const normalized = task.priority.toLowerCase();
      if (normalized === "high") parsedPriority = "High";
      else if (normalized === "low") parsedPriority = "Low";
    }
    setNewPriority(parsedPriority);
    
    setNewDueDate(task.due_date || "");
    setNewCategory(task.category || "Development");
    setNewWorkspaceId(task.workspace_id || "");
    setNewProjectId(task.project_id || "");
    setShowDeployForm(true);
  };

  const handleCancelForm = () => {
    setEditingTaskId(null);
    setNewTitle("");
    setNewDesc("");
    setNewPriority("Medium");
    setNewDueDate("");
    setNewCategory("Development");
    setNewWorkspaceId("");
    setNewProjectId("");
    setShowDeployForm(false);
  };

  const handleDeployTask = async () => {
    if (!newTitle.trim()) return;

    // Smart inheritance logic
    const selectedProj = projects.find(p => p.id === newProjectId);
    const inheritedWorkspaceId = selectedProj ? (selectedProj.workspace_id || undefined) : (newWorkspaceId || undefined);

    if (editingTaskId) {
      const originalTask = tasks.find((t) => t.id === editingTaskId);
      if (!originalTask) return;

      const updatedTask: Task = {
        ...originalTask,
        title: newTitle,
        description: newDesc,
        priority: newPriority.toLowerCase() as any,
        due_date: newDueDate || new Date().toISOString().split("T")[0],
        category: newCategory,
        workspace_id: inheritedWorkspaceId,
        project_id: newProjectId || undefined,
      };

      try {
        await updateItem(editingTaskId, updatedTask);
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Task Updated",
              message: `Task "${newTitle}" has been successfully updated.`,
              category: "task",
              link_to: "todo"
            }
          })
        );
        handleCancelForm();
        loadTasks();
      } catch (err: any) {
        console.error("Failed to update task:", err);
        import("@/lib/utils").then(m => m.emitError("Task Update Failed", err?.message || "Failed to update task"));
      }
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        type: "task",
        title: newTitle,
        description: newDesc,
        status: "pending",
        priority: newPriority.toLowerCase() as any,
        due_date: newDueDate || new Date().toISOString().split("T")[0],
        category: newCategory,
        workspace_id: inheritedWorkspaceId,
        project_id: newProjectId || undefined,
        tags: [],
      };

      try {
        await createItem(newTask);
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Task Deployed",
              message: `Task "${newTitle}" has been successfully initialized in your queue.`,
              category: "task",
              link_to: "todo"
            }
          })
        );
        handleCancelForm();
        loadTasks();
      } catch (err: any) {
        console.error("Failed to deploy task:", err);
        import("@/lib/utils").then(m => m.emitError("Task Deployment Failed", err?.message || "Failed to deploy task"));
      }
    }
  };

  const changeTaskStatus = async (task: Task, nextStatus: TaskStatus) => {
    const backendStatus = statusMapping[nextStatus];

    const updated = {
      ...task,
      status: backendStatus,
    };

    // Optimistic UI state update (zero roundtrip lag)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

    try {
      await updateItem(task.id, updated);
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: {
            title: nextStatus === "Completed" ? "Task Completed" : "Task Status Changed",
            message: nextStatus === "Completed"
              ? `Congratulations! Task "${task.title}" has been completed.`
              : `Task "${task.title}" has been moved to ${nextStatus}.`,
            category: "task",
            link_to: "todo"
          }
        })
      );
    } catch (err: any) {
      console.error("Failed to update task status:", err);
      import("@/lib/utils").then(m => m.emitError("Task Status Update Failed", err?.message || "Failed to update task status"));
      loadTasks(); // rollback on failure
    }
  };

  // Custom drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedOverColumn !== status) {
      setDraggedOverColumn(status);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    setDraggedTaskId(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const taskToUpdate = tasks.find((t) => t.id === taskId);
    if (taskToUpdate) {
      const currentUIStatus = revStatusMapping[taskToUpdate.status] || "Backlog";
      if (currentUIStatus !== targetStatus) {
        await changeTaskStatus(taskToUpdate, targetStatus);
      }
    }
  };

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id);
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    const taskObj = tasks.find((t) => t.id === taskToDelete);
    try {
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      await deleteItem(taskToDelete);
      if (taskObj) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Task Deleted",
              message: `Task "${taskObj.title}" has been successfully deleted.`,
              category: "task",
              link_to: "todo"
            }
          })
        );
      }
      setTaskToDelete(null);
      loadTasks();
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      import("@/lib/utils").then(m => m.emitError("Task Deletion Failed", err?.message || "Failed to delete task"));
      loadTasks();
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchQuery.toLowerCase());

      const uiStatus = revStatusMapping[task.status] || "Backlog";
      const matchesStatus = filterStatus === "All" || uiStatus === filterStatus;

      const matchesWorkspace = 
        filterWorkspaceId === "All" ||
        (filterWorkspaceId === "General" && !task.workspace_id) ||
        task.workspace_id === filterWorkspaceId;

      const matchesProject =
        filterProjectId === "All" ||
        (filterProjectId === "Standalone" && !task.project_id) ||
        task.project_id === filterProjectId;

      return matchesSearch && matchesStatus && matchesWorkspace && matchesProject;
    });
  }, [tasks, searchQuery, filterStatus, filterWorkspaceId, filterProjectId]);

  const statusColumns: TaskStatus[] = ["Backlog", "Active", "Review", "Completed"];

  const renderTaskCard = (task: Task) => {
    const priority = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    const uiStatus = revStatusMapping[task.status] || "Backlog";
    const ws = workspaces.find((w) => w.id === task.workspace_id);
    const proj = projects.find((p) => p.id === task.project_id);

    return (
      <Card
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        className={cn(
          "group border shadow-sm hover:shadow-xl transition-all duration-200 glass-panel relative overflow-hidden rounded-[5px] cursor-grab active:cursor-grabbing",
          draggedTaskId === task.id 
            ? "opacity-30 border-dashed border-primary scale-95" 
            : "border-border/50 hover:border-primary/60"
        )}
      >
        <div
          className={cn(
            "absolute top-0 left-0 w-1.5 h-full transition-all duration-500",
            task.priority === "high"
              ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              : task.priority === "medium"
              ? "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              : "bg-primary shadow-[0_0_20px_rgba(59,130,246,0.4)]"
          )}
        />
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase tracking-widest border-border/50 bg-background/50 px-2 opacity-60"
              >
                TASK_{task.id.slice(0, 4).toUpperCase()}
              </Badge>
              {ws ? (
                <Badge
                  style={{
                    borderColor: `${ws.color}33`,
                    color: ws.color,
                    backgroundColor: `${ws.color}11`
                  }}
                  variant="outline"
                  className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0"
                >
                  {ws.name}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono text-muted-foreground/60 bg-background/50 border-border/50 shrink-0"
                >
                  General
                </Badge>
              )}
              {proj && (
                <Badge
                  style={{
                    borderColor: `${proj.color}33`,
                    color: proj.color,
                    backgroundColor: `${proj.color}11`
                  }}
                  variant="outline"
                  className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 flex items-center gap-1"
                >
                  <FolderKanban className="w-2.5 h-2.5 shrink-0" />
                  {proj.name}
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-bold text-muted-foreground font-mono flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> {task.due_date}
            </span>
          </div>
          <CardTitle className="text-base font-bold group-hover:text-primary transition-colors tracking-tight leading-snug line-clamp-2">
            {task.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <p className="text-xs text-muted-foreground font-medium mb-5 leading-relaxed opacity-80 line-clamp-2">
            {task.description || "No description provided."}
          </p>

          <div className="flex items-center justify-between border-t border-border/10 pt-4">
            <div className="flex -space-x-3">
              <Avatar className="w-7 h-7 border-2 border-background ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarImage src={resolveDriveImage(profile.profile_avatar)} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                  {profile.profile_name
                    ? profile.profile_name
                        .split(" ")
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "AT"}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center gap-1.5">
              {viewStyle !== "board" && (
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-[9px] uppercase font-bold tracking-widest">
                    {uiStatus}
                  </Badge>
                </div>
              )}
              <div
                className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex flex-col items-center justify-center hover:bg-secondary hover:border-primary transition-all cursor-pointer"
                onClick={() => handleEditTask(task)}
                title="Edit Task"
              >
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div
                className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex flex-col items-center justify-center hover:bg-secondary hover:border-primary transition-all cursor-pointer"
                onClick={() => {
                  const nextStatusIdx = (statusColumns.indexOf(uiStatus) + 1) % statusColumns.length;
                  changeTaskStatus(task, statusColumns[nextStatusIdx]);
                }}
                title="Next Status"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <div
                className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex flex-col items-center justify-center hover:bg-red-500/10 hover:border-red-500 transition-all cursor-pointer"
                onClick={() => handleDeleteTask(task.id)}
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8 shrink-0">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Tasks</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Todo List</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Create and manage your tasks and projects.</p>
        </div>
        <Button
          onClick={() => setShowDeployForm(true)}
          className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-11 px-5 font-bold text-xs uppercase tracking-[0.2em]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {showDeployForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-background border border-primary/30 w-full max-w-2xl shadow-2xl relative overflow-hidden p-6 sm:p-8 space-y-6 rounded-[5px] max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold uppercase tracking-[0.2em] text-xs sm:text-sm text-primary flex items-center gap-2 font-mono">
                <Edit3 className="w-4 h-4 text-primary" />
                {editingTaskId ? "Edit Task Details" : "Create New Task"}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] hover:bg-secondary/80" onClick={handleCancelForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Task Title</span>
                <Input
                  placeholder="Task Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-background/50 border-border/30 rounded-[5px] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Category</span>
                <Input
                  placeholder="Category (e.g. Dev, Marketing, Research)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-background/50 border-border/30 rounded-[5px] h-11"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Description</span>
                <Input
                  placeholder="Task Description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="bg-background/50 border-border/30 rounded-[5px] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Due Date</span>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Priority</span>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full h-11 px-4 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Node Workspace</span>
                <select
                  value={newWorkspaceId}
                  onChange={(e) => setNewWorkspaceId(e.target.value)}
                  className="w-full h-11 px-3 rounded-[5px] bg-background/50 border border-border/30 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">General Task</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Project</span>
                <select
                  value={newProjectId}
                  onChange={(e) => {
                    setNewProjectId(e.target.value);
                    if (e.target.value) {
                      const selectedProj = projects.find(p => p.id === e.target.value);
                      if (selectedProj && selectedProj.workspace_id) {
                        setNewWorkspaceId(selectedProj.workspace_id);
                      }
                    }
                  }}
                  className="w-full h-11 px-3 rounded-[5px] bg-background/50 border border-border/30 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Standalone Project</option>
                  {projects
                    .filter(p => !newWorkspaceId || p.workspace_id === newWorkspaceId)
                    .map((proj) => (
                      <option key={proj.id} value={proj.id}>{proj.name}</option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
              <Button
                variant="outline"
                onClick={handleCancelForm}
                className="rounded-[5px] border-border/50 px-8 h-11 font-bold uppercase tracking-widest text-[10px] bg-background/50 hover:bg-secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeployTask}
                disabled={!newTitle.trim()}
                className="rounded-[5px] bg-primary px-8 h-11 font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.2)]"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTaskId ? "Save Changes" : "Save Task"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex w-full relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11 bg-secondary/30 border-border/50 rounded-[5px] w-full"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
          <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 overflow-x-auto max-w-full">
            {(["All", "Backlog", "Active", "Review", "Completed"] as const).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "rounded-[5px] font-bold text-[10px] uppercase tracking-widest px-4 h-9",
                  filterStatus === status ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {status}
              </Button>
            ))}
          </div>

          <div className="flex p-1 bg-secondary/30 rounded-[5px] border border-border/50 shrink-0">
            <Button
              variant={viewStyle === "board" ? "secondary" : "ghost"}
              size="icon"
              className="w-9 h-9 rounded-[5px]"
              onClick={() => setViewStyle("board")}
            >
              <Columns className="w-4 h-4" />
            </Button>
            <Button
              variant={viewStyle === "list" ? "secondary" : "ghost"}
              size="icon"
              className="w-9 h-9 rounded-[5px]"
              onClick={() => setViewStyle("list")}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={viewStyle === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="w-9 h-9 rounded-[5px]"
              onClick={() => setViewStyle("grid")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/10 pt-3">
          <span className="text-[9px] font-bold uppercase tracking-widest font-mono text-muted-foreground mr-2">Filter by Node:</span>
          
          <Button
            variant={filterWorkspaceId === "All" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterWorkspaceId("All")}
            className={cn(
              "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border border-border/20",
              filterWorkspaceId === "All" ? "bg-primary text-white shadow-sm border-primary" : "text-muted-foreground"
            )}
          >
            All Nodes
          </Button>

          <Button
            variant={filterWorkspaceId === "General" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterWorkspaceId("General")}
            className={cn(
              "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border border-border/20",
              filterWorkspaceId === "General" ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            General Tasks
          </Button>

          {workspaces.map((ws) => {
            const isActive = filterWorkspaceId === ws.id;
            return (
              <Button
                key={ws.id}
                variant="ghost"
                size="sm"
                onClick={() => setFilterWorkspaceId(ws.id)}
                style={{
                  borderColor: isActive ? ws.color : undefined,
                  color: isActive ? "#ffffff" : ws.color,
                  backgroundColor: isActive ? ws.color : `${ws.color}11`
                }}
                className={cn(
                  "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border",
                  !isActive && "hover:bg-secondary/40 text-muted-foreground"
                )}
              >
                {ws.name}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/10 pt-3">
          <span className="text-[9px] font-bold uppercase tracking-widest font-mono text-muted-foreground mr-2">Filter by Project:</span>
          
          <Button
            variant={filterProjectId === "All" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterProjectId("All")}
            className={cn(
              "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border border-border/20",
              filterProjectId === "All" ? "bg-primary text-white shadow-sm border-primary" : "text-muted-foreground"
            )}
          >
            All Projects
          </Button>

          <Button
            variant={filterProjectId === "Standalone" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterProjectId("Standalone")}
            className={cn(
              "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border border-border/20",
              filterProjectId === "Standalone" ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            Standalone Tasks
          </Button>

          {projects.map((proj) => {
            const isActive = filterProjectId === proj.id;
            return (
              <Button
                key={proj.id}
                variant="ghost"
                size="sm"
                onClick={() => setFilterProjectId(proj.id)}
                style={{
                  borderColor: isActive ? proj.color : undefined,
                  color: isActive ? "#ffffff" : proj.color,
                  backgroundColor: isActive ? proj.color : `${proj.color}11`
                }}
                className={cn(
                  "rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-3 h-7 border flex items-center gap-1",
                  !isActive && "hover:bg-secondary/40 text-muted-foreground"
                )}
              >
                <FolderKanban className="w-2.5 h-2.5 shrink-0" />
                {proj.name}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Clock className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="font-mono text-xs uppercase tracking-widest">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border/30 rounded-[5px] bg-background/20 font-medium text-xs">
            No tasks found matching your filters.
          </div>
        ) : viewStyle === "board" ? (
          <div className="flex h-full gap-6 overflow-x-auto pb-6">
            {statusColumns.map((status) => {
              const columnTasks = filteredTasks.filter((t) => {
                const uiStatus = revStatusMapping[t.status] || "Backlog";
                return uiStatus === status;
              });
              return (
                <div
                  key={status}
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, status)}
                  className={cn(
                    "flex-1 min-w-[320px] max-w-[400px] flex flex-col gap-4 rounded-[5px] p-4 border transition-all duration-150",
                    draggedOverColumn === status 
                      ? "border-primary bg-primary/10 shadow-[0_0_25px_rgba(59,130,246,0.2)] ring-2 ring-primary/30 scale-[1.02] z-10" 
                      : draggedTaskId 
                      ? "border-dashed border-primary/35 bg-primary/[0.02]"
                      : "border-border/20 bg-secondary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      {status === "Backlog" && <Circle className="w-4 h-4 text-muted-foreground" />}
                      {status === "Active" && <Clock className="w-4 h-4 text-primary" />}
                      {status === "Review" && <Flag className="w-4 h-4 text-amber-500" />}
                      {status === "Completed" && <CheckSquare className="w-4 h-4 text-emerald-500" />}
                      {status}
                    </h3>
                    <Badge variant="secondary" className="bg-background text-muted-foreground">
                      {columnTasks.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-4 overflow-y-auto pr-1 pb-1">
                    {columnTasks.map(renderTaskCard)}
                    {columnTasks.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-border/30 rounded-[5px] bg-background/20 font-medium text-xs">
                        No tasks in {status}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewStyle === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto h-full pb-6 pr-2">
            {filteredTasks.map(renderTaskCard)}
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto h-full pb-6 pr-2">
            {filteredTasks.map((task) => {
              const uiStatus = revStatusMapping[task.status] || "Backlog";
              return (
                <Card
                  key={task.id}
                  className="group border border-border/50 bg-secondary/10 hover:bg-secondary/30 transition-all rounded-[5px] relative overflow-hidden flex flex-col sm:flex-row sm:items-center p-4 sm:p-3 gap-4 sm:gap-6"
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 w-1.5 sm:w-1.5 h-1.5 sm:h-full transition-all duration-500",
                      task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-amber-500" : "bg-primary"
                    )}
                  />
                  <div className="w-full sm:w-48 pl-0 sm:pl-3 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start shrink-0 gap-2">
                    <Badge
                      variant="outline"
                      className="w-fit text-[9px] font-bold uppercase tracking-widest border-border/50 bg-background/50 mb-0 sm:mb-1 opacity-60"
                    >
                      TASK_{task.id.slice(0, 4).toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-bold text-muted-foreground font-mono flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {task.due_date}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <CardTitle className="text-base font-bold group-hover:text-primary transition-colors truncate">
                      {task.title}
                    </CardTitle>
                    {(() => {
                      const ws = workspaces.find((w) => w.id === task.workspace_id);
                      const proj = projects.find((p) => p.id === task.project_id);
                      return (
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {ws ? (
                            <Badge
                              style={{
                                borderColor: `${ws.color}33`,
                                color: ws.color,
                                backgroundColor: `${ws.color}11`
                              }}
                              variant="outline"
                              className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0"
                            >
                              {ws.name}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono text-muted-foreground/60 bg-background/50 border-border/50 shrink-0"
                            >
                              General
                            </Badge>
                          )}
                          {proj && (
                            <Badge
                              style={{
                                borderColor: `${proj.color}33`,
                                color: proj.color,
                                backgroundColor: `${proj.color}11`
                              }}
                              variant="outline"
                              className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 flex items-center gap-1"
                            >
                              <FolderKanban className="w-2.5 h-2.5 shrink-0" />
                              {proj.name}
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex flex-row items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 border-t border-border/10 sm:border-t-0 pt-3 sm:pt-0">
                    <div className="w-28 sm:w-32 shrink-0">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest w-full justify-center">
                        {uiStatus}
                      </Badge>
                    </div>
                    <div className="w-24 shrink-0 flex justify-end gap-2">
                      <div
                        className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex flex-col items-center justify-center hover:bg-secondary hover:border-primary transition-all cursor-pointer"
                        onClick={() => handleEditTask(task)}
                        title="Edit Task"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div
                        className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex flex-col items-center justify-center hover:bg-red-500/10 hover:border-red-500 transition-all cursor-pointer"
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-red-500" />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {taskToDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-background border border-red-500/30 p-8 rounded-[5px] max-w-sm w-full space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[8px] font-mono tracking-widest px-2.5 py-0.5 rounded-[5px] font-bold uppercase mb-1">Warning</Badge>
                <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">Delete Task</h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this task tracker? This action cannot be undone and will remove it from all workspace views.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setTaskToDelete(null)}
                className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] px-5 h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDeleteTask}
                className="rounded-[5px] bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[9px] px-6 h-10 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                Purge Task
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
