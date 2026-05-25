import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Plus, Search, Columns, LayoutGrid, List as ListIcon, Calendar as CalendarIcon, ChevronRight, Circle, Clock, Flag, CheckSquare, Square, Trash2, X, Save, AlertTriangle, Briefcase, Edit3, FolderKanban, Bold, Italic, List, Code } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, resolveDriveImage } from "@/lib/utils";
import { Task, Workspace, Project, Organization, RoleAssignment } from "@/src/types";
import { getItems, createItem, updateItem, deleteItem, getSettings, getAllUsers } from "@/lib/api";

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

const AVAILABLE_CATEGORIES = [
  { name: "Development", color: "bg-blue-500", text: "text-blue-500", border: "border-blue-500/20", bg: "bg-blue-500/10" },
  { name: "Design", color: "bg-pink-500", text: "text-pink-500", border: "border-pink-500/20", bg: "bg-pink-500/10" },
  { name: "Marketing", color: "bg-purple-500", text: "text-purple-500", border: "border-purple-500/20", bg: "bg-purple-500/10" },
  { name: "Finance", color: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
  { name: "Research", color: "bg-amber-500", text: "text-amber-500", border: "border-amber-500/20", bg: "bg-amber-500/10" },
  { name: "Security", color: "bg-red-500", text: "text-red-500", border: "border-red-500/20", bg: "bg-red-500/10" },
  { name: "Operations", color: "bg-cyan-500", text: "text-cyan-500", border: "border-cyan-500/20", bg: "bg-cyan-500/10" },
  { name: "Legal", color: "bg-orange-500", text: "text-orange-500", border: "border-orange-500/20", bg: "bg-orange-500/10" },
  { name: "Personal", color: "bg-teal-500", text: "text-teal-500", border: "border-teal-500/20", bg: "bg-teal-500/10" },
  { name: "Strategy", color: "bg-violet-500", text: "text-violet-500", border: "border-violet-500/20", bg: "bg-violet-500/10" },
  { name: "Content", color: "bg-lime-500", text: "text-lime-500", border: "border-lime-500/20", bg: "bg-lime-500/10" },
  { name: "Other", color: "bg-slate-400", text: "text-slate-400", border: "border-slate-400/20", bg: "bg-slate-400/10" }
];

export function TodoView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("all");
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [newWorkspaceId, setNewWorkspaceId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  // Custom edit and delete triggers
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    
    const cached = localStorage.getItem("myos_active_organization_id") || "all";
    setActiveOrgId(cached);

    const handleDataChanged = () => {
      loadTasks(true);
    };

    const handleOrgChanged = (e: any) => {
      if (e.detail?.activeOrgId) {
        setActiveOrgId(e.detail.activeOrgId);
      }
    };

    window.addEventListener("myos:data-changed", handleDataChanged);
    window.addEventListener("myos:active-org-changed", handleOrgChanged);
    return () => {
      window.removeEventListener("myos:data-changed", handleDataChanged);
      window.removeEventListener("myos:active-org-changed", handleOrgChanged);
    };
  }, []);

  const allowedUsersForNewTask = useMemo(() => {
    let parentWorkspace = workspaces.find(w => w.id === newWorkspaceId);
    
    if (!parentWorkspace && newProjectId) {
      const proj = projects.find(p => p.id === newProjectId);
      if (proj && proj.workspace_id) {
        parentWorkspace = workspaces.find(w => w.id === proj.workspace_id);
      }
    }

    if (!parentWorkspace) {
      return allUsers; 
    }

    const orgId = parentWorkspace.organization_id;
    
    return allUsers.filter(user => {
      const isWsOwner = parentWorkspace.user_id === user.id || parentWorkspace.owner_id === user.id;
      const hasWsRole = roleAssignments.some(
        ra => ra.scope_type === "workspace" && 
              ra.scope_id === parentWorkspace.id && 
              ra.user_id === user.id
      );

      let hasOrgRole = false;
      if (orgId) {
        const org = organizations.find(o => o.id === orgId);
        const isOrgOwner = org && (org.user_id === user.id || org.owner_id === user.id);
        const isOrgMember = roleAssignments.some(
          ra => ra.scope_type === "organization" && 
                ra.scope_id === orgId && 
                ra.user_id === user.id
        );
        hasOrgRole = !!(isOrgOwner || isOrgMember);
      }

      return isWsOwner || hasWsRole || hasOrgRole;
    });
  }, [newWorkspaceId, newProjectId, workspaces, projects, organizations, roleAssignments, allUsers]);

  const loadTasks = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getItems<Task>("task");
      setTasks(data);
      const wsData = await getItems<Workspace>("workspace");
      setWorkspaces(wsData);
      const projData = await getItems<Project>("project");
      setProjects(projData);
      const orgData = await getItems<Organization>("organization");
      setOrganizations(orgData);
      
      const rolesData = await getItems<RoleAssignment>("role_assignment");
      setRoleAssignments(rolesData);
      const usersData = await getAllUsers();
      setAllUsers(usersData);

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
    setIsCategoryDropdownOpen(false);
    setNewWorkspaceId(task.workspace_id || "");
    setNewProjectId(task.project_id || "");
    setNewTaskAssigneeId(task.assignee_id || "");
    setIsAssigneeDropdownOpen(false);
    setShowDeployForm(true);
  };

  const handleCancelForm = () => {
    setEditingTaskId(null);
    setNewTitle("");
    setNewDesc("");
    setNewPriority("Medium");
    setNewDueDate("");
    setNewCategory("Development");
    setIsCategoryDropdownOpen(false);
    setNewWorkspaceId("");
    setNewProjectId("");
    setNewTaskAssigneeId("");
    setIsAssigneeDropdownOpen(false);
    setIsEditingInModal(false);
    setShowDeployForm(false);
  };

  // Helper: Parse markdown checkboxes from description
  const parseChecklist = (description: string) => {
    if (!description) return [];
    const lines = description.split("\n");
    const checklist: { id: string; text: string; completed: boolean; lineIndex: number }[] = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(\s*[-*]\s+\[([ xX])\])\s+(.*)$/);
      if (match) {
        checklist.push({
          id: `chk-${index}-${match[3]}`,
          text: match[3],
          completed: match[2].toLowerCase() === "x",
          lineIndex: index
        });
      }
    });
    return checklist;
  };

  // Helper: Toggle a checkbox in description markdown
  const toggleChecklistItem = async (task: Task, lineIndex: number, completed: boolean) => {
    if (!task.description) return;
    const lines = task.description.split("\n");
    const line = lines[lineIndex];
    const match = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/);
    if (match) {
      lines[lineIndex] = `${match[1]}${completed ? "x" : " "}${match[3]}`;
      const updatedDesc = lines.join("\n");
      const updatedTask = { ...task, description: updatedDesc };
      
      // Update local state
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      setViewingTask(updatedTask);
      
      // Save to server
      try {
        await updateItem(task.id, updatedTask);
        window.dispatchEvent(new CustomEvent("myos:data-changed"));
      } catch (err) {
        console.error("Failed to update checklist item:", err);
      }
    }
  };

  // Helper: Add a new checklist item to the task description
  const addChecklistItem = async (task: Task, text: string) => {
    if (!text.trim()) return;
    const itemLine = `- [ ] ${text.trim()}`;
    const currentDesc = task.description ? task.description.trim() : "";
    const updatedDesc = currentDesc ? `${currentDesc}\n${itemLine}` : itemLine;
    const updatedTask = { ...task, description: updatedDesc };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    setViewingTask(updatedTask);

    try {
      await updateItem(task.id, updatedTask);
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err) {
      console.error("Failed to add checklist item:", err);
    }
  };

  // Helper: Delete a checklist item from description
  const deleteChecklistItem = async (task: Task, lineIndex: number) => {
    if (!task.description) return;
    const lines = task.description.split("\n");
    lines.splice(lineIndex, 1);
    const updatedDesc = lines.join("\n");
    const updatedTask = { ...task, description: updatedDesc };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    setViewingTask(updatedTask);

    try {
      await updateItem(task.id, updatedTask);
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err) {
      console.error("Failed to delete checklist item:", err);
    }
  };

  // Helper: Get prose description only (without checklist lines)
  const getProseOnly = (description: string) => {
    if (!description) return "";
    return description
      .split("\n")
      .filter(line => !line.match(/^(\s*[-*]\s+\[([ xX])\])\s+(.*)$/))
      .join("\n")
      .trim();
  };

  const insertMarkdownHelper = (syntax: string) => {
    const textarea = document.getElementById("task-description-textarea") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const selected = text.substring(start, end);

    let insertion = "";
    if (syntax === "bold") {
      insertion = `**${selected || "bold text"}**`;
    } else if (syntax === "italic") {
      insertion = `*${selected || "italic text"}*`;
    } else if (syntax === "bullet") {
      insertion = `\n- ${selected || "list item"}`;
    } else if (syntax === "code") {
      insertion = `\`\`\`\n${selected || "code block"}\n\`\`\``;
    } else if (syntax === "todo") {
      insertion = `\n- [ ] ${selected || "checklist item"}`;
    }

    const updated = before + insertion + after;
    setNewDesc(updated);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + insertion.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
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
        assignee_id: newTaskAssigneeId || undefined,
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
        window.dispatchEvent(new CustomEvent("myos:data-changed"));
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
        assignee_id: newTaskAssigneeId || undefined,
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
        window.dispatchEvent(new CustomEvent("myos:data-changed"));
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
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
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
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      import("@/lib/utils").then(m => m.emitError("Task Deletion Failed", err?.message || "Failed to delete task"));
      loadTasks();
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Organizational context filter
      const ws = workspaces.find(w => w.id === task.workspace_id);
      if (activeOrgId === "standalone") {
        const isStandalone = !task.workspace_id || (ws && !ws.organization_id);
        if (!isStandalone) return false;
      } else if (activeOrgId !== "all") {
        if (!task.workspace_id || !ws || ws.organization_id !== activeOrgId) {
          return false;
        }
      }

      // 2. Base filters
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
  }, [tasks, searchQuery, filterStatus, filterWorkspaceId, filterProjectId, activeOrgId, workspaces]);

  const statusColumns: TaskStatus[] = ["Backlog", "Active", "Review", "Completed"];

  const renderTaskCard = (task: Task) => {
    const priority = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    const uiStatus = revStatusMapping[task.status] || "Backlog";
    const ws = workspaces.find((w) => w.id === task.workspace_id);
    const proj = projects.find((p) => p.id === task.project_id);
    const org = ws ? organizations.find((o) => o.id === ws.organization_id) : null;

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
              {(() => {
                const taskCategories = task.category ? task.category.split(",").map(c => c.trim()).filter(Boolean) : [];
                return taskCategories.map(catName => {
                  const catInfo = AVAILABLE_CATEGORIES.find(c => c.name === catName) || {
                    name: catName,
                    color: "bg-slate-400",
                    text: "text-slate-400",
                    border: "border-slate-400/20",
                    bg: "bg-slate-400/10"
                  };
                  return (
                    <Badge
                      key={catName}
                      variant="outline"
                      className={cn(
                        "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 transition-all border flex items-center gap-1",
                        catInfo.text,
                        catInfo.border,
                        catInfo.bg
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", catInfo.color)} />
                      {catInfo.name}
                    </Badge>
                  );
                });
              })()}
              {org && (
                <Badge
                  variant="outline"
                  className="text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 border-primary/20 bg-primary/5 text-primary flex items-center gap-1"
                >
                  <Briefcase className="w-2.5 h-2.5 shrink-0" />
                  {org.name}
                </Badge>
              )}
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
          <CardTitle 
            className="text-base font-bold group-hover:text-primary transition-colors tracking-tight leading-snug line-clamp-2 cursor-pointer"
            onClick={() => {
              setViewingTask(task);
              setIsDescExpanded(false);
            }}
          >
            {task.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between">
          <div className="space-y-4 mb-5">
            {/* Description Render Area with Prose, line-breaks & bullets support */}
            <div 
              className="relative cursor-pointer select-none group/desc"
              onClick={() => {
                setViewingTask(task);
                setIsDescExpanded(false);
              }}
            >
              <div className="max-h-24 overflow-hidden relative text-xs text-muted-foreground/80 leading-relaxed prose prose-sm dark:prose-invert prose-p:my-0 prose-ul:my-1 prose-li:my-0.5 prose-ul:list-disc prose-ul:pl-4 prose-ol:list-decimal prose-ol:pl-4 font-medium font-mono">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {getProseOnly(task.description || "") || (task.description ? "" : "No description provided.")}
                </ReactMarkdown>
                {/* Vertical Fadeout */}
                {(task.description || "").length > 90 && (
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/95 via-background/20 to-transparent pointer-events-none group-hover/desc:from-background/90" />
                )}
              </div>
              {(task.description || "").length > 90 && (
                <span className="text-[10px] text-primary group-hover/desc:text-primary/80 transition-colors font-semibold font-mono mt-1 block">
                  ... Read More Details
                </span>
              )}
            </div>

            {/* Checklist items progress preview */}
            {(() => {
              const checklist = parseChecklist(task.description || "");
              if (checklist.length === 0) return null;
              const completed = checklist.filter(c => c.completed).length;
              return (
                <div 
                  className="space-y-1.5 p-2.5 rounded-[5px] bg-secondary/20 border border-border/10 cursor-pointer hover:bg-secondary/40 transition-colors"
                  onClick={() => {
                    setViewingTask(task);
                    setIsDescExpanded(false);
                  }}
                >
                  <div className="flex items-center justify-between text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <CheckSquare className="w-3 h-3 text-primary animate-pulse" /> Subtask Checklist
                    </span>
                    <span>{completed}/{checklist.length}</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden border border-border/5">
                    <div 
                      className="bg-primary h-full rounded-full transition-all duration-500" 
                      style={{ width: `${(completed / checklist.length) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between border-t border-border/10 pt-4">
            <div className="flex -space-x-2 items-center overflow-visible">
              {(() => {
                const assigneeIds = task.assignee_id ? task.assignee_id.split(",").map(s => s.trim()).filter(Boolean) : [];
                if (assigneeIds.length === 0) {
                  return (
                    <span className="text-[9px] font-bold font-mono text-muted-foreground/45 uppercase tracking-wider">
                      Unassigned
                    </span>
                  );
                }

                return assigneeIds.map(id => {
                  const u = allUsers.find(user => user.id === id);
                  if (!u) return null;

                  // Check if this user is a "Project Lead" in the parent project context
                  const isLead = roleAssignments.some(
                    ra => ra.scope_type === "project" && 
                          ra.scope_id === task.project_id && 
                          ra.user_id === id && 
                          ra.role === "Project Lead"
                  ) || (
                    proj && (proj.user_id === id || proj.owner_id === id)
                  );

                  return (
                    <div key={id} className="relative group/avatar overflow-visible">
                      <Avatar className={cn(
                        "w-7 h-7 border-2 transition-all duration-300 relative",
                        isLead 
                          ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)] ring-1 ring-red-500/50 scale-105 z-10 animate-pulse-subtle" 
                          : "border-background ring-1 ring-transparent hover:scale-110"
                      )}>
                        <AvatarImage src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                        <AvatarFallback className={cn(
                          "font-bold text-[9px]",
                          isLead ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                        )}>
                          {u.display_name
                            ? u.display_name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase()
                            : u.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Project Lead visual crown or shield emblem */}
                      {isLead && (
                        <div 
                          className="absolute -top-1.5 -right-1 bg-red-500 text-white rounded-full p-0.5 border border-background shadow-md scale-75 z-20 flex items-center justify-center"
                          title="Project Lead"
                        >
                          <span className="text-[7px] leading-none font-bold px-0.5">L</span>
                        </div>
                      )}

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900/95 border border-border/40 text-slate-100 text-[8px] font-mono font-bold uppercase rounded-[5px] opacity-0 pointer-events-none group-hover/avatar:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-xl z-50">
                        {u.display_name || u.username} {isLead ? "(Project Lead)" : "(Member)"}
                      </div>
                    </div>
                  );
                });
              })()}
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
              <div className="space-y-1.5 flex flex-col justify-end relative">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Category Protocol</span>
                <div className="relative">
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-background/50 border border-border/30 rounded-[5px] text-left hover:border-primary/50 transition-all focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(() => {
                        const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                        if (selectedCats.length === 0) {
                          return <span className="text-xs text-muted-foreground/60 font-medium">Select Categories...</span>;
                        }
                        return selectedCats.map(catName => {
                          const catInfo = AVAILABLE_CATEGORIES.find(c => c.name === catName) || {
                            name: catName,
                            color: "bg-slate-400",
                            text: "text-slate-400",
                            border: "border-slate-400/20",
                            bg: "bg-slate-400/10"
                          };
                          return (
                            <Badge
                              key={catName}
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 transition-all border flex items-center gap-1",
                                catInfo.text,
                                catInfo.border,
                                catInfo.bg
                              )}
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", catInfo.color)} />
                              {catInfo.name}
                            </Badge>
                          );
                        });
                      })()}
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground/60 transition-transform shrink-0 ml-2", isCategoryDropdownOpen ? "rotate-90 text-primary" : "")} />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {isCategoryDropdownOpen && (
                    <>
                      {/* Backdrop for closing */}
                      <div className="fixed inset-0 z-30" onClick={() => setIsCategoryDropdownOpen(false)} />
                      
                      {/* Floating panel */}
                      <div className="absolute left-0 right-0 mt-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2.5 rounded-[5px] animate-in slide-in-from-top-2 fade-in duration-200 max-h-[220px] overflow-y-auto custom-scrollbar animate-fade-in">
                        {/* Custom Category Input */}
                        <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-border/20">
                          <Input
                            placeholder="Add custom category..."
                            className="h-7 text-[10px] bg-secondary/20 border-border/30 rounded-[5px] flex-1 font-mono text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val) {
                                  let updated: string[];
                                  const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                                  if (!selectedCats.includes(val)) {
                                    updated = [...selectedCats, val];
                                    setNewCategory(updated.join(", "));
                                  }
                                  e.currentTarget.value = "";
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            className="h-7 w-7 rounded-[5px] bg-primary hover:bg-primary/90 shrink-0"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) {
                                let updated: string[];
                                const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                                if (!selectedCats.includes(val)) {
                                  updated = [...selectedCats, val];
                                  setNewCategory(updated.join(", "));
                                }
                                input.value = "";
                              }
                            }}
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {AVAILABLE_CATEGORIES.map(cat => {
                            const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                            const isSelected = selectedCats.includes(cat.name);
                            return (
                              <button
                                key={cat.name}
                                type="button"
                                onClick={() => {
                                  let updated: string[];
                                  if (isSelected) {
                                    updated = selectedCats.filter(c => c !== cat.name);
                                  } else {
                                    updated = [...selectedCats, cat.name];
                                  }
                                  if (updated.length === 0) {
                                    setNewCategory("Other");
                                  } else {
                                    setNewCategory(updated.join(", "));
                                  }
                                }}
                                className={cn(
                                  "text-[9px] uppercase font-bold tracking-widest px-2.5 py-2 rounded-[5px] border transition-all flex items-center justify-between gap-1.5 text-left",
                                  isSelected 
                                    ? "bg-primary/10 text-primary border-primary/30 font-extrabold shadow-[inset_0_0_10px_rgba(59,130,246,0.05)]" 
                                    : "bg-background/40 text-muted-foreground/80 border-border/30 hover:border-muted-foreground/40 hover:bg-secondary/40 hover:text-foreground"
                                )}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("w-2 h-2 rounded-full shrink-0", cat.color, isSelected ? "ring-2 ring-primary/20 scale-110" : "")} />
                                  <span>{cat.name}</span>
                                </div>
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Task Description Protocol</span>
              <div className="flex gap-1 mb-1.5 bg-secondary/25 p-1 rounded-[5px] border border-border/10 w-fit">
                <button type="button" onClick={() => insertMarkdownHelper("bold")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => insertMarkdownHelper("italic")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => insertMarkdownHelper("bullet")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => insertMarkdownHelper("todo")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Checklist Item"><CheckSquare className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => insertMarkdownHelper("code")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Code Block"><Code className="w-3.5 h-3.5" /></button>
              </div>
              <textarea
                id="task-description-textarea"
                placeholder="Write task details or checklist items (e.g. - [ ] Item name)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={5}
                className="w-full bg-background/50 border border-border/30 rounded-[5px] p-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/40 font-mono text-foreground leading-relaxed transition-all hover:border-primary/40 focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Due Date</span>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs"
                />
              </div>
              
              <div className="space-y-1.5 flex flex-col justify-end relative">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Assign Operations Team</span>
                <div className="relative">
                  {/* Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                    className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 bg-background/50 border border-border/30 rounded-[5px] text-left hover:border-primary/50 transition-all focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono"
                  >
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(() => {
                        const selectedAssigneeIds = newTaskAssigneeId ? newTaskAssigneeId.split(",").map(s => s.trim()).filter(Boolean) : [];
                        if (selectedAssigneeIds.length === 0) {
                          return <span className="text-xs text-muted-foreground/60 font-medium">No Assigned Members</span>;
                        }
                        return selectedAssigneeIds.map(id => {
                          const u = allUsers.find(user => user.id === id);
                          if (!u) return null;
                          return (
                            <Badge
                              key={id}
                              variant="outline"
                              className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-[5px] border-primary/20 bg-primary/5 text-primary flex items-center gap-1 font-mono"
                            >
                              <Avatar className="w-4 h-4 border border-background">
                                <AvatarImage src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                                <AvatarFallback className="text-[7px]">{u.username.slice(0, 2)}</AvatarFallback>
                              </Avatar>
                              {u.display_name || u.username}
                            </Badge>
                          );
                        });
                      })()}
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground/60 transition-transform shrink-0 ml-2", isAssigneeDropdownOpen ? "rotate-90 text-primary" : "")} />
                  </button>

                  {/* Dropdown Menu Popup */}
                  {isAssigneeDropdownOpen && (
                    <>
                      {/* Backdrop for closing */}
                      <div className="fixed inset-0 z-30" onClick={() => setIsAssigneeDropdownOpen(false)} />
                      
                      {/* Floating panel */}
                      <div className="absolute left-0 right-0 mt-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2.5 rounded-[5px] animate-in slide-in-from-top-2 fade-in duration-200 max-h-[220px] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 gap-1">
                          {allowedUsersForNewTask.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground uppercase font-mono">No Users Available</div>
                          ) : (
                            allowedUsersForNewTask.map(user => {
                              const selectedAssigneeIds = newTaskAssigneeId ? newTaskAssigneeId.split(",").map(s => s.trim()).filter(Boolean) : [];
                              const isSelected = selectedAssigneeIds.includes(user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    let updated: string[];
                                    if (isSelected) {
                                      updated = selectedAssigneeIds.filter(id => id !== user.id);
                                    } else {
                                      updated = [...selectedAssigneeIds, user.id];
                                    }
                                    setNewTaskAssigneeId(updated.join(","));
                                  }}
                                  className={cn(
                                    "text-[10px] font-medium px-2.5 py-2 rounded-[5px] border transition-all flex items-center justify-between gap-1.5 text-left font-mono",
                                    isSelected 
                                      ? "bg-primary/10 text-primary border-primary/30 font-bold shadow-sm" 
                                      : "bg-background/40 text-muted-foreground/80 border-border/30 hover:border-muted-foreground/40 hover:bg-secondary/40 hover:text-foreground"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-5 h-5 border border-border">
                                      <AvatarImage src={user.avatar_url ? resolveDriveImage(user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} />
                                      <AvatarFallback className="text-[8px] font-bold">{user.username.slice(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <span>{user.display_name || user.username} (@{user.username})</span>
                                  </div>
                                  {isSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                  {workspaces
                    .filter(ws => {
                      if (activeOrgId === "standalone") return !ws.organization_id;
                      if (activeOrgId !== "all") return ws.organization_id === activeOrgId;
                      return true;
                    })
                    .map((ws) => (
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
                    .filter(p => {
                      const ws = workspaces.find(w => w.id === p.workspace_id);
                      if (activeOrgId === "standalone") return !p.workspace_id || (ws && !ws.organization_id);
                      if (activeOrgId !== "all") return p.workspace_id && ws && ws.organization_id === activeOrgId;
                      return true;
                    })
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
                    <CardTitle 
                      className="text-base font-bold group-hover:text-primary transition-colors truncate cursor-pointer"
                      onClick={() => {
                        setViewingTask(task);
                        setIsDescExpanded(false);
                      }}
                    >
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

      {viewingTask && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-background border border-border/50 w-full max-w-4xl shadow-2xl relative overflow-hidden rounded-[5px] max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            {/* Color Accent Indicator Strip */}
            <div className="absolute top-0 left-0 w-full h-1.5 shrink-0" style={{ backgroundColor: viewingTask.priority === "high" ? "#ef4444" : viewingTask.priority === "medium" ? "#f59e0b" : "#3b82f6" }} />
            
            {/* Header Area */}
            <div className="bg-secondary/20 border-b border-border/30 p-6 shrink-0 flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-border/50 bg-background/50 px-2 opacity-70 font-mono">
                    TASK_{viewingTask.id.slice(0, 8).toUpperCase()}
                  </Badge>
                  
                  {(() => {
                    const currentCats = isEditingInModal ? newCategory : viewingTask.category;
                    const taskCategories = currentCats ? currentCats.split(",").map(c => c.trim()).filter(Boolean) : [];
                    return taskCategories.map(catName => (
                      <Badge
                        key={catName}
                        variant="outline"
                        className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-[5px] font-mono shrink-0 transition-all border border-primary/20 bg-primary/5 text-primary"
                      >
                        {catName}
                      </Badge>
                    ));
                  })()}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground line-clamp-2">
                  {isEditingInModal ? "Modify Task Parameters" : viewingTask.title}
                </h3>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[5px] hover:bg-secondary/80 shrink-0 self-start" onClick={() => { setViewingTask(null); setIsDescExpanded(false); setIsEditingInModal(false); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 overflow-y-auto flex-1">
              
              {/* LEFT COLUMN */}
              <div className="flex-1 space-y-6">
                {isEditingInModal ? (
                  /* EDIT MODE Left Column */
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Task Title</span>
                      <Input
                        placeholder="Task Title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="bg-secondary/20 border-border/30 rounded-[5px] h-11 text-sm font-bold w-full"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">Task Description Protocol</span>
                      <div className="flex gap-1 mb-1 bg-secondary/25 p-1 rounded-[5px] border border-border/10 w-fit">
                        <button type="button" onClick={() => insertMarkdownHelper("bold")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => insertMarkdownHelper("italic")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => insertMarkdownHelper("bullet")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => insertMarkdownHelper("todo")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Checklist Item"><CheckSquare className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => insertMarkdownHelper("code")} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-all" title="Code Block"><Code className="w-3.5 h-3.5" /></button>
                      </div>
                      <textarea
                        id="task-description-textarea"
                        placeholder="Write task details or checklist items (e.g. - [ ] Item name)"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        rows={10}
                        className="w-full bg-background/50 border border-border/30 rounded-[5px] p-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/40 font-mono text-foreground leading-relaxed transition-all hover:border-primary/40 focus:border-primary"
                      />
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE Left Column */
                  <div className="space-y-6">
                    {/* Prose Markdown Viewer */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">Task Details & Context</h4>
                      <div className="bg-secondary/5 border border-border/20 p-5 rounded-[5px] shadow-inner relative overflow-hidden">
                        <div className={cn(
                          "transition-all duration-500 overflow-hidden relative",
                          !isDescExpanded && getProseOnly(viewingTask.description || "").length > 250 ? "max-h-48" : "max-h-none"
                        )}>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed font-mono whitespace-pre-wrap text-foreground/90 prose-p:my-0 prose-ul:my-2 prose-li:my-0.5 prose-ul:list-disc prose-ul:pl-4 prose-ol:list-decimal prose-ol:pl-4">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {getProseOnly(viewingTask.description || "") || "No descriptive notes logged."}
                            </ReactMarkdown>
                          </div>
                          
                          {/* Blurred Bottom Fade if truncated */}
                          {!isDescExpanded && getProseOnly(viewingTask.description || "").length > 250 && (
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                          )}
                        </div>
                        
                        {getProseOnly(viewingTask.description || "").length > 250 && (
                          <div className="flex justify-start mt-4 border-t border-border/10 pt-3">
                            <button
                              onClick={() => setIsDescExpanded(!isDescExpanded)}
                              className="text-[9px] font-extrabold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors font-mono"
                            >
                              {isDescExpanded ? "Show Less" : "Read More Description"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interactive Subtask Checklist */}
                    {(() => {
                      const checklist = parseChecklist(viewingTask.description || "");
                      const completed = checklist.filter(c => c.completed).length;
                      return (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono flex items-center justify-between">
                            <span>Active Workstream checklist</span>
                            <span className="text-primary font-bold">{completed}/{checklist.length} Completed</span>
                          </h4>
                          
                          <div className="bg-secondary/5 border border-border/20 p-5 rounded-[5px] space-y-3 shadow-inner">
                            {checklist.length > 0 && (
                              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden border border-border/10 mb-4">
                                <div 
                                  className="bg-primary h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${(completed / checklist.length) * 100}%` }}
                                />
                              </div>
                            )}

                            {checklist.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground font-mono italic">No checklist items logged. Add one below!</p>
                            ) : (
                              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {checklist.map((item) => (
                                  <div key={item.id} className="flex items-start justify-between gap-3 group/chk py-0.5 border-b border-border/5 last:border-b-0 pb-1">
                                    <label className="flex items-start gap-2.5 cursor-pointer text-xs font-mono text-foreground/90 select-none flex-1">
                                      <input
                                        type="checkbox"
                                        checked={item.completed}
                                        onChange={(e) => toggleChecklistItem(viewingTask, item.lineIndex, e.target.checked)}
                                        className="rounded border-border/40 text-primary bg-background focus:ring-primary/20 mt-0.5 h-3.5 w-3.5 transition-all cursor-pointer"
                                      />
                                      <span className={cn(
                                        "leading-relaxed transition-all duration-200",
                                        item.completed ? "line-through text-muted-foreground/60 italic" : "text-foreground/90"
                                      )}>
                                        {item.text}
                                      </span>
                                    </label>
                                    <button
                                      onClick={() => deleteChecklistItem(viewingTask, item.lineIndex)}
                                      className="opacity-0 group-hover/chk:opacity-100 p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-all shrink-0"
                                      title="Delete checklist subtask"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add checklist item inline form */}
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (newChecklistItem.trim()) {
                                  addChecklistItem(viewingTask, newChecklistItem.trim());
                                  setNewChecklistItem("");
                                }
                              }}
                              className="flex gap-2 pt-3 border-t border-border/10 mt-3"
                            >
                              <Input
                                placeholder="Add checklist subtask (e.g. Design assets)"
                                value={newChecklistItem}
                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                className="h-8 text-xs bg-background/50 border-border/30 rounded-[5px] font-mono text-foreground focus-visible:ring-primary"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                disabled={!newChecklistItem.trim()}
                                className="h-8 rounded-[5px] bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-[9px] px-3 shrink-0"
                              >
                                Add
                              </Button>
                            </form>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="w-full md:w-80 space-y-5 shrink-0 bg-secondary/5 border border-border/20 p-5 rounded-[5px] flex flex-col justify-between">
                <div className="space-y-5">
                  
                  {isEditingInModal ? (
                    /* EDIT MODE Right Column inputs */
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono border-b border-border/20 pb-2.5 mb-1">Edit Parameters</h4>
                      
                      {/* Priority */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Priority Protocol</span>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                          className="w-full h-9 px-2 bg-background border border-border/30 rounded-[5px] text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      {/* Workspace */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Node Workspace</span>
                        <select
                          value={newWorkspaceId}
                          onChange={(e) => setNewWorkspaceId(e.target.value)}
                          className="w-full h-9 px-2 bg-background border border-border/30 rounded-[5px] text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        >
                          <option value="">General Task</option>
                          {workspaces
                            .filter(ws => {
                              if (activeOrgId === "standalone") return !ws.organization_id;
                              if (activeOrgId !== "all") return ws.organization_id === activeOrgId;
                              return true;
                            })
                            .map((ws) => (
                              <option key={ws.id} value={ws.id}>{ws.name}</option>
                            ))}
                        </select>
                      </div>

                      {/* Project */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Project Context</span>
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
                          className="w-full h-9 px-2 bg-background border border-border/30 rounded-[5px] text-xs font-semibold text-foreground focus:outline-none"
                        >
                          <option value="">Standalone Project</option>
                          {projects
                            .filter(p => !newWorkspaceId || p.workspace_id === newWorkspaceId)
                            .filter(p => {
                              const ws = workspaces.find(w => w.id === p.workspace_id);
                              if (activeOrgId === "standalone") return !p.workspace_id || (ws && !ws.organization_id);
                              if (activeOrgId !== "all") return p.workspace_id && ws && ws.organization_id === activeOrgId;
                              return true;
                            })
                            .map((proj) => (
                              <option key={proj.id} value={proj.id}>{proj.name}</option>
                            ))}
                        </select>
                      </div>

                      {/* Due Date */}
                      <div className="space-y-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Target Deadline</span>
                        <Input
                          type="date"
                          value={newDueDate}
                          onChange={(e) => setNewDueDate(e.target.value)}
                          className="bg-background border border-border/30 rounded-[5px] h-9 text-xs"
                        />
                      </div>

                      {/* Category multiselect inside modal */}
                      <div className="space-y-1 relative">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Category protocol</span>
                        <button
                          type="button"
                          onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                          className="w-full flex items-center justify-between min-h-[36px] px-2 py-1.5 bg-background border border-border/30 rounded-[5px] text-left hover:border-primary/50 transition-all focus:outline-none"
                        >
                          <div className="flex flex-wrap gap-1 items-center max-w-[200px] overflow-hidden">
                            {(() => {
                              const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                              if (selectedCats.length === 0) {
                                return <span className="text-[10px] text-muted-foreground/50 font-mono">Select...</span>;
                              }
                              return selectedCats.slice(0, 2).map(catName => (
                                <span key={catName} className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-[3px] font-mono">{catName}</span>
                              ));
                            })()}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 ml-1 shrink-0" />
                        </button>
                        
                        {isCategoryDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsCategoryDropdownOpen(false)} />
                            <div className="absolute right-0 left-0 bottom-full mb-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2 rounded-[5px] max-h-[160px] overflow-y-auto custom-scrollbar grid grid-cols-1 gap-1">
                              {AVAILABLE_CATEGORIES.map(cat => {
                                const selectedCats = newCategory ? newCategory.split(",").map(c => c.trim()).filter(Boolean) : [];
                                const isSelected = selectedCats.includes(cat.name);
                                return (
                                  <button
                                    key={cat.name}
                                    type="button"
                                    onClick={() => {
                                      let updated: string[];
                                      if (isSelected) {
                                        updated = selectedCats.filter(c => c !== cat.name);
                                      } else {
                                        updated = [...selectedCats, cat.name];
                                      }
                                      setNewCategory(updated.length === 0 ? "Other" : updated.join(", "));
                                    }}
                                    className={cn(
                                      "text-[8.5px] uppercase font-bold tracking-widest px-2 py-1.5 rounded-[3px] border transition-all flex items-center gap-1.5 font-mono",
                                      isSelected ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-muted-foreground border-border/30 hover:border-foreground/30 hover:text-foreground"
                                    )}
                                  >
                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cat.color)} />
                                    {cat.name}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Team multi-select in modal */}
                      <div className="space-y-1 relative">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Assign Operations Team</span>
                        <button
                          type="button"
                          onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                          className="w-full flex items-center justify-between min-h-[36px] px-2 py-1.5 bg-background border border-border/30 rounded-[5px] text-left hover:border-primary/50 transition-all focus:outline-none"
                        >
                          <div className="flex -space-x-1 items-center max-w-[200px] overflow-hidden">
                            {(() => {
                              const selectedAssigneeIds = newTaskAssigneeId ? newTaskAssigneeId.split(",").map(s => s.trim()).filter(Boolean) : [];
                              if (selectedAssigneeIds.length === 0) {
                                return <span className="text-[10px] text-muted-foreground/50 font-mono">Unassigned</span>;
                              }
                              return selectedAssigneeIds.slice(0, 3).map(id => {
                                const u = allUsers.find(user => user.id === id);
                                if (!u) return null;
                                return (
                                  <Avatar key={id} className="w-5 h-5 border border-background shrink-0">
                                    <AvatarImage src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                                    <AvatarFallback className="text-[6px]">{u.username.slice(0, 2)}</AvatarFallback>
                                  </Avatar>
                                );
                              });
                            })()}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 ml-1 shrink-0" />
                        </button>
                        
                        {isAssigneeDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsAssigneeDropdownOpen(false)} />
                            <div className="absolute right-0 left-0 bottom-full mb-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2 rounded-[5px] max-h-[160px] overflow-y-auto custom-scrollbar grid grid-cols-1 gap-1">
                              {allowedUsersForNewTask.length === 0 ? (
                                <div className="p-2 text-center text-xs text-muted-foreground uppercase font-mono">No Users</div>
                              ) : (
                                allowedUsersForNewTask.map(user => {
                                  const selectedAssigneeIds = newTaskAssigneeId ? newTaskAssigneeId.split(",").map(s => s.trim()).filter(Boolean) : [];
                                const isSelected = selectedAssigneeIds.includes(user.id);
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      let updated: string[];
                                      if (isSelected) {
                                        updated = selectedAssigneeIds.filter(id => id !== user.id);
                                      } else {
                                        updated = [...selectedAssigneeIds, user.id];
                                      }
                                      setNewTaskAssigneeId(updated.join(","));
                                    }}
                                    className={cn(
                                      "text-[9px] font-bold px-2 py-1.5 rounded-[3px] border transition-all flex items-center gap-1.5 font-mono",
                                      isSelected ? "bg-primary/10 text-primary border-primary/30" : "bg-background text-muted-foreground border-border/30 hover:border-foreground/30 hover:text-foreground"
                                    )}
                                  >
                                    <Avatar className="w-4 h-4 border border-background shrink-0">
                                      <AvatarImage src={user.avatar_url ? resolveDriveImage(user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} />
                                      <AvatarFallback className="text-[6px]">{user.username.slice(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{user.display_name || user.username}</span>
                                  </button>
                                );
                              }))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* VIEW MODE Right Column parameters */
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono border-b border-border/20 pb-2.5 mb-3">Task Parameters</h4>
                        
                        <div className="space-y-4">
                          {/* Organization Mapping */}
                          {(() => {
                            const wsObj = workspaces.find(w => w.id === viewingTask.workspace_id);
                            const orgObj = wsObj ? organizations.find(o => o.id === wsObj.organization_id) : null;
                            if (!orgObj) return null;
                            return (
                              <div className="space-y-1 animate-fade-in">
                                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Root Organization</span>
                                <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                                  <Briefcase className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
                                  <span className="truncate">{orgObj.name}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Workspace Mapping */}
                          {(() => {
                            const wsObj = workspaces.find(w => w.id === viewingTask.workspace_id);
                            if (!wsObj) return null;
                            return (
                              <div className="space-y-1 animate-fade-in">
                                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Parent Workspace</span>
                                <div className="flex items-center gap-1.5 text-xs font-bold font-mono" style={{ color: wsObj.color }}>
                                  <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: wsObj.color }} />
                                  <span className="truncate">{wsObj.name}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Project Mapping */}
                          {(() => {
                            const projObj = projects.find(p => p.id === viewingTask.project_id);
                            if (!projObj) return null;
                            return (
                              <div className="space-y-1 animate-fade-in">
                                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Project Context</span>
                                <div className="flex items-center gap-1.5 text-xs font-bold font-mono" style={{ color: projObj.color }}>
                                  <FolderKanban className="w-3.5 h-3.5 shrink-0" style={{ color: projObj.color }} />
                                  <span className="truncate">{projObj.name}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Priority details */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Priority Protocol</span>
                            <Badge 
                              className={cn(
                                "text-[8px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-[5px] font-mono border",
                                viewingTask.priority === "high" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                viewingTask.priority === "medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                "bg-primary/10 text-primary border-primary/20"
                              )}
                            >
                              {viewingTask.priority}
                            </Badge>
                          </div>

                          {/* Due date details */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Target Deadline</span>
                            <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                              <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              <span>{viewingTask.due_date || "No deadline assigned"}</span>
                            </div>
                          </div>

                          {/* Status Toggle control */}
                          <div className="space-y-2">
                            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono block">Workstream Progress</span>
                            <select
                              value={revStatusMapping[viewingTask.status] || "Backlog"}
                              onChange={(e) => changeTaskStatus(viewingTask, e.target.value as any)}
                              className="w-full h-9 px-2 bg-background border border-border/30 rounded-[5px] text-xs font-bold uppercase tracking-wider font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                            >
                              <option value="Backlog">BACKLOG</option>
                              <option value="Active">ACTIVE</option>
                              <option value="Review">REVIEW</option>
                              <option value="Completed">COMPLETED</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Responsible Members List */}
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono border-b border-border/20 pb-2">Assigned Team</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const assigneeIds = viewingTask.assignee_id ? viewingTask.assignee_id.split(",").map(s => s.trim()).filter(Boolean) : [];
                            if (assigneeIds.length === 0) {
                              return <span className="text-[9px] font-bold font-mono text-muted-foreground/40 uppercase">Unassigned</span>;
                            }
                            return assigneeIds.map(id => {
                              const u = allUsers.find(user => user.id === id);
                              if (!u) return null;
                              return (
                                <Badge key={id} variant="secondary" className="text-[8.5px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-[5px] border border-border/10 font-mono flex items-center gap-1">
                                  <Avatar className="w-4 h-4 shrink-0">
                                    <AvatarImage src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                                    <AvatarFallback className="text-[6px] font-bold">{u.username.slice(0, 2)}</AvatarFallback>
                                  </Avatar>
                                  {u.display_name || u.username}
                                </Badge>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Button Panels */}
                <div className="pt-4 border-t border-border/10 flex flex-col gap-2 shrink-0">
                  {isEditingInModal ? (
                    <>
                      <Button
                        onClick={async () => {
                          if (!newTitle.trim()) return;
                          
                          // Smart inheritance logic
                          const selectedProj = projects.find(p => p.id === newProjectId);
                          const inheritedWorkspaceId = selectedProj ? (selectedProj.workspace_id || undefined) : (newWorkspaceId || undefined);

                          const updatedTask: Task = {
                            ...viewingTask,
                            title: newTitle,
                            description: newDesc,
                            priority: newPriority.toLowerCase() as any,
                            due_date: newDueDate || new Date().toISOString().split("T")[0],
                            category: newCategory,
                            workspace_id: inheritedWorkspaceId,
                            project_id: newProjectId || undefined,
                            assignee_id: newTaskAssigneeId || undefined,
                          };

                          try {
                            await updateItem(viewingTask.id, updatedTask);
                            
                            // Emits customized notification
                            window.dispatchEvent(
                              new CustomEvent("myos:notification", {
                                detail: {
                                  title: "Task Refactored",
                                  message: `Task "${newTitle}" has been successfully saved in workspace.`,
                                  category: "task",
                                  link_to: "todo"
                                }
                              })
                            );
                            
                            // Sync states
                            setTasks(prev => prev.map(t => t.id === viewingTask.id ? updatedTask : t));
                            setViewingTask(updatedTask);
                            setIsEditingInModal(false);
                            loadTasks();
                            window.dispatchEvent(new CustomEvent("myos:data-changed"));
                          } catch (err: any) {
                            console.error("Failed to save inline edits:", err);
                            import("@/lib/utils").then(m => m.emitError("Refactor Saved Failed", err?.message || "Failed to update task"));
                          }
                        }}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Apply Work Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingInModal(false)}
                        className="w-full rounded-[5px] border-border/50 text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-[9px] h-10 font-mono"
                      >
                        Cancel Refactor
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          setNewTitle(viewingTask.title || "");
                          setNewDesc(viewingTask.description || "");
                          
                          let parsedPriority: TaskPriority = "Medium";
                          if (viewingTask.priority) {
                            const normalized = viewingTask.priority.toLowerCase();
                            if (normalized === "high") parsedPriority = "High";
                            else if (normalized === "low") parsedPriority = "Low";
                          }
                          setNewPriority(parsedPriority);
                          
                          setNewDueDate(viewingTask.due_date || "");
                          setNewCategory(viewingTask.category || "Development");
                          setNewWorkspaceId(viewingTask.workspace_id || "");
                          setNewProjectId(viewingTask.project_id || "");
                          setNewTaskAssigneeId(viewingTask.assignee_id || "");
                          setIsCategoryDropdownOpen(false);
                          setIsAssigneeDropdownOpen(false);
                          setIsEditingInModal(true);
                        }}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Transition to Edit Mode
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewingTask(null);
                          setIsDescExpanded(false);
                          setIsEditingInModal(false);
                        }}
                        className="w-full rounded-[5px] border-border/50 text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest text-[9px] h-10 font-mono"
                      >
                        Close Workspace
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
