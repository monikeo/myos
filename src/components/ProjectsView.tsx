import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Briefcase, 
  FolderKanban, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  Loader2, 
  ChevronRight, 
  Grid, 
  List, 
  Layers, 
  Link2, 
  User,
  Sparkles,
  Info,
  ShieldCheck,
  UserMinus,
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Project, Workspace, Task, Organization, RoleAssignment, FinancialTransaction } from "@/src/types";
import { getItems, createItem, deleteItem, updateItem, getAllUsers, getCurrentSession } from "@/lib/api";
import { cn, resolveDriveImage } from "@/lib/utils";

const SPECTRUM_COLORS = [
  { hex: "#3b82f6", name: "Indigo Protocol" },
  { hex: "#14b8a6", name: "Neon Teal" },
  { hex: "#ec4899", name: "Rose Pink" },
  { hex: "#f59e0b", name: "Amber Gold" },
  { hex: "#10b981", name: "Cyber Green" },
  { hex: "#8b5cf6", name: "Purple Haze" },
  { hex: "#ef4444", name: "Crimson Red" }
];

const PROJECT_STATUSES = ["planning", "active", "on-hold", "completed", "cancelled"] as const;
type ProjectStatus = typeof PROJECT_STATUSES[number];

const PROJECT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
type ProjectPriority = typeof PROJECT_PRIORITIES[number];

const emptyProjectForm = {
  name: "",
  description: "",
  status: "active" as ProjectStatus,
  priority: "medium" as ProjectPriority,
  start_date: "",
  end_date: "",
  workspace_id: "personal", // "personal" indicates standalone/no workspace
  color: "#3b82f6",
  category: "Development",
  budget: ""
};

const PRESET_EXPENSE_CATEGORIES = [
  "General",
  "Hardware",
  "Software License",
  "Freelance/Contractor",
  "Marketing",
  "Travel & Dining",
  "Office Supplies",
  "Infrastructure",
  "Miscellaneous"
];

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWorkspace, setFilterWorkspace] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [viewStyle, setViewStyle] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProjectForm);
  
  // Details Modal
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  // Inner task creation inside active project modal
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isProjCategoryDropdownOpen, setIsProjCategoryDropdownOpen] = useState(false);
  const [activeReassignTaskId, setActiveReassignTaskId] = useState<string | null>(null);
  const [popoverRenderUpwards, setPopoverRenderUpwards] = useState(false);
  
  // Deletion warnings
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Hierarchical and Access Control states
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("all");

  const [projectModalTab, setProjectModalTab] = useState<"tasks" | "access" | "finance">("tasks");
  const [selectedUserForProjRole, setSelectedUserForProjRole] = useState<string>("");
  const [selectedRoleForUserOnProj, setSelectedRoleForUserOnProj] = useState<string>("Contributor");

  // Project inline finance logging states
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("General");
  const [newExpenseDate, setNewExpenseDate] = useState("");

  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const projData = await getItems<Project>("project");
      setProjects(projData);
      
      const wsData = await getItems<Workspace>("workspace");
      setWorkspaces(wsData);
      
      const taskData = await getItems<Task>("task");
      setTasks(taskData);

      // Load transactions context
      const txData = await getItems<FinancialTransaction>("transaction");
      setTransactions(txData);

      // Load organizations, role assignments, and all users
      const allOrgs = await getItems<Organization>("organization");
      setOrganizations(allOrgs);
      const allRoles = await getItems<RoleAssignment>("role_assignment");
      setRoleAssignments(allRoles);
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (err) {
      console.error("Failed to load Projects view data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const cached = localStorage.getItem("myos_active_organization_id") || "all";
    setActiveOrgId(cached);

    const handleDataChanged = () => {
      loadData();
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
  }, [loadData]);

  useEffect(() => {
    const autoOpenId = localStorage.getItem("myos_auto_open_project");
    if (autoOpenId && projects.length > 0) {
      localStorage.removeItem("myos_auto_open_project");
      const found = projects.find(p => p.id === autoOpenId);
      if (found) {
        setActiveProject(found);
        setProjectModalTab("tasks");
      }
    }
  }, [projects]);

  // Project progress tracker
  const getProjectStats = useCallback((projectId: string) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId);
    const completed = projectTasks.filter(t => t.status === "completed" || t.status === "archived");
    const percent = projectTasks.length > 0 ? Math.round((completed.length / projectTasks.length) * 100) : 0;
    return {
      total: projectTasks.length,
      completed: completed.length,
      percent
    };
  }, [tasks]);

  // Active project live sync (keeps modal up to date)
  const syncedActiveProject = useMemo(() => {
    if (!activeProject) return null;
    return projects.find(p => p.id === activeProject.id) || activeProject;
  }, [activeProject, projects]);

  const allowedProjectUsers = useMemo(() => {
    if (!syncedActiveProject) return [];
    
    // Find parent workspace
    const parentWorkspace = workspaces.find(w => w.id === syncedActiveProject.workspace_id);
    if (!parentWorkspace) {
      // Standalone project: allow all registered users
      return allUsers;
    }

    const orgId = parentWorkspace.organization_id;
    
    return allUsers.filter(user => {
      // Check if user is the workspace owner/creator
      const isWsOwner = parentWorkspace.user_id === user.id || parentWorkspace.owner_id === user.id;

      // Check if user has explicit workspace role assignment
      const hasWsRole = roleAssignments.some(
        ra => ra.scope_type === "workspace" && 
              ra.scope_id === parentWorkspace.id && 
              ra.user_id === user.id
      );

      // Check if user is the organization owner or member
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
  }, [syncedActiveProject, workspaces, allUsers, roleAssignments, organizations]);

  const availableCategories = useMemo(() => {
    const customCats = new Set<string>();
    PRESET_EXPENSE_CATEGORIES.forEach(cat => customCats.add(cat));
    transactions.forEach(t => {
      if (t.project_id === syncedActiveProject?.id && t.category) {
        const clean = t.category.trim();
        if (clean) {
          const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
          customCats.add(formatted);
        }
      }
    });
    return Array.from(customCats);
  }, [transactions, syncedActiveProject?.id]);

  const projectUserRole = useMemo(() => {
    if (!syncedActiveProject) return null;
    const session = getCurrentSession();
    if (!session || !session.id) return null;
    const currentUserId = session.id;

    // 1. Check if user is explicit owner / creator via fields
    const isProjOwnerField = syncedActiveProject.user_id === currentUserId || syncedActiveProject.owner_id === currentUserId;
    
    // Check if user has explicit project lead role assignment
    const hasProjLeadRole = roleAssignments.some(
      ra => ra.scope_type === "project" && 
            ra.scope_id === syncedActiveProject.id && 
            ra.user_id === currentUserId && 
            ra.role === "Project Lead"
    );

    // Fallback if standalone project with no owner info at all
    const hasAnyProjOwner = roleAssignments.some(
      ra => ra.scope_type === "project" && 
            ra.scope_id === syncedActiveProject.id && 
            ra.role === "Project Lead"
    );
    const hasNoProjOwnerInfo = !syncedActiveProject.user_id && !syncedActiveProject.owner_id && !hasAnyProjOwner;

    if (isProjOwnerField || hasProjLeadRole || hasNoProjOwnerInfo) {
      return "Project Lead";
    }

    // 2. Check explicit project assignment
    const projAssignment = roleAssignments.find(
      ra => ra.scope_type === "project" && 
            ra.scope_id === syncedActiveProject.id && 
            ra.user_id === currentUserId
    );
    if (projAssignment) {
      return projAssignment.role; // e.g. "Project Lead", "Contributor", "Viewer"
    }

    // 3. Fallback to parent workspace assignment
    const parentWorkspace = workspaces.find(w => w.id === syncedActiveProject.workspace_id);
    if (parentWorkspace) {
      const isWsOwner = parentWorkspace.user_id === currentUserId || parentWorkspace.owner_id === currentUserId;
      const hasWsOwnerRole = roleAssignments.some(
        ra => ra.scope_type === "workspace" && 
              ra.scope_id === parentWorkspace.id && 
              ra.user_id === currentUserId && 
              ra.role === "Owner"
      );
      if (isWsOwner || hasWsOwnerRole) return "Project Lead";

      const wsAssignment = roleAssignments.find(
        ra => ra.scope_type === "workspace" && 
              ra.scope_id === parentWorkspace.id && 
              ra.user_id === currentUserId
      );
      if (wsAssignment) {
        if (wsAssignment.role === "Admin" || wsAssignment.role === "Owner") return "Project Lead";
        if (wsAssignment.role === "Editor" || wsAssignment.role === "Member") return "Contributor";
        if (wsAssignment.role === "Viewer") return "Viewer";
      }

      // 4. Fallback to parent organization assignment
      const orgId = parentWorkspace.organization_id;
      if (orgId) {
        const org = organizations.find(o => o.id === orgId);
        const isOrgOwner = org && (org.user_id === currentUserId || org.owner_id === currentUserId);
        if (isOrgOwner) return "Project Lead";

        const orgAssignment = roleAssignments.find(
          ra => ra.scope_type === "organization" && 
                ra.scope_id === orgId && 
                ra.user_id === currentUserId
        );
        if (orgAssignment) {
          if (orgAssignment.role === "Admin" || orgAssignment.role === "Owner") return "Project Lead";
          if (orgAssignment.role === "Member") return "Contributor";
          if (orgAssignment.role === "Guest") return "Viewer";
        }
      }
    }

    return "Viewer"; // Default fallback
  }, [syncedActiveProject, workspaces, roleAssignments, organizations]);

  const handleSaveProject = async () => {
    if (!form.name.trim()) return;

    const projectPayload = {
      type: "project" as const,
      name: form.name,
      description: form.description || "Project workspace.",
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      workspace_id: form.workspace_id === "personal" ? undefined : form.workspace_id,
      color: form.color,
      category: form.category || "Development",
      budget: form.budget ? parseFloat(form.budget) : undefined
    };

    try {
      if (editingProjectId) {
        await updateItem(editingProjectId, {
          ...projectPayload,
          id: editingProjectId
        });
      } else {
        const newProjId = crypto.randomUUID();
        await createItem({
          ...projectPayload,
          id: newProjId
        });

        // Automatically assign Project Lead role assignment for the creator in this project
        const session = getCurrentSession();
        if (session && session.id) {
          await createItem({
            type: "role_assignment",
            scope_type: "project",
            scope_id: newProjId,
            user_id: session.id,
            role: "Project Lead"
          });
        }
      }
      
      // Cleanup
      setForm(emptyProjectForm);
      setEditingProjectId(null);
      setShowForm(false);
      loadData();
    } catch (err: any) {
      console.error("Failed to save project:", err);
      import("@/lib/utils").then(m => m.emitError("Project Save Failed", err?.message || "Failed to save project"));
    }
  };

  const handleEditClick = (project: Project) => {
    setForm({
      name: project.name,
      description: project.description || "",
      status: project.status,
      priority: project.priority,
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      workspace_id: project.workspace_id || "personal",
      color: project.color || "#3b82f6",
      category: project.category || "Development",
      budget: project.budget !== undefined ? String(project.budget) : ""
    });
    setEditingProjectId(project.id);
    setShowForm(true);
  };

  const handleAddProjectExpense = async (activeProj: Project) => {
    if (!newExpenseDesc.trim() || !newExpenseAmount) return;

    const amountVal = parseFloat(newExpenseAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const newTx: FinancialTransaction = {
      id: crypto.randomUUID(),
      type: "transaction",
      description: newExpenseDesc,
      amount: amountVal,
      transaction_type: "expense",
      category: newExpenseCategory || "General",
      date: newExpenseDate || new Date().toISOString().split("T")[0],
      workspace_id: activeProj.workspace_id || undefined,
      project_id: activeProj.id
    };

    try {
      await createItem(newTx);

      // Dispatch normal notification for project spend
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: {
            title: "Project Spend Logged",
            message: `Logged expense of $${amountVal.toLocaleString()} for project "${activeProj.name}": "${newExpenseDesc}".`,
            category: "finance",
            link_to: "finance"
          }
        })
      );

      // Budget warnings
      const limit = activeProj.budget || 0;
      const spent = transactions
        .filter(t => t.project_id === activeProj.id && t.transaction_type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0) + amountVal;

      if (limit > 0 && spent >= limit) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "CRITICAL: Project Budget Exceeded",
              message: `Project "${activeProj.name}" has exceeded its budget of $${limit.toLocaleString()}! Current spent is $${spent.toLocaleString()}.`,
              category: "finance",
              link_to: "finance"
            }
          })
        );
      } else if (limit > 0 && spent >= limit * 0.75) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Warning: Low Project Budget",
              message: `Project "${activeProj.name}" has consumed over 75% of its budget. Current spent is $${spent.toLocaleString()} / $${limit.toLocaleString()}.`,
              category: "finance",
              link_to: "finance"
            }
          })
        );
      }

      setNewExpenseDesc("");
      setNewExpenseAmount("");
      setNewExpenseCategory("General");
      setNewExpenseDate("");
      loadData();
    } catch (err) {
      console.error("Failed to log project expense:", err);
    }
  };

  const handleDeleteProjectExpense = async (txId: string, description: string, amount: number) => {
    try {
      await deleteItem(txId);
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: {
            title: "Project Expense Purged",
            message: `Deleted project expense of $${amount.toLocaleString()} for "${description}".`,
            category: "finance",
            link_to: "finance"
          }
        })
      );
      loadData();
    } catch (err) {
      console.error("Failed to delete project expense:", err);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteItem(projectToDelete);
      if (activeProject?.id === projectToDelete) {
        setActiveProject(null);
      }
      setProjectToDelete(null);
      loadData();
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      import("@/lib/utils").then(m => m.emitError("Project Deletion Failed", err?.message || "Failed to delete project"));
    }
  };

  const handleAssignProjectRole = async () => {
    if (!selectedUserForProjRole || !selectedRoleForUserOnProj || !syncedActiveProject) return;
    try {
      await createItem({
        type: "role_assignment",
        scope_type: "project",
        scope_id: syncedActiveProject.id,
        user_id: selectedUserForProjRole,
        role: selectedRoleForUserOnProj
      });
      setSelectedUserForProjRole("");
      loadData();
    } catch (err: any) {
      console.error("Failed to assign project role:", err);
      import("@/lib/utils").then(m => m.emitError("Role Assignment Failed", err?.message || "Failed to assign project role"));
    }
  };

  const handleRevokeProjectRole = async (assignmentId: string) => {
    try {
      await deleteItem(assignmentId);
      loadData();
    } catch (err: any) {
      console.error("Failed to revoke project role:", err);
      import("@/lib/utils").then(m => m.emitError("Role Revocation Failed", err?.message || "Failed to revoke project role"));
    }
  };

  const handleUpdateProjectRole = async (assignmentId: string, newRole: string) => {
    try {
      const ra = roleAssignments.find(item => item.id === assignmentId);
      if (!ra) return;
      await updateItem(assignmentId, { ...ra, role: newRole });
      loadData();
    } catch (err: any) {
      console.error("Failed to update project role:", err);
      import("@/lib/utils").then(m => m.emitError("Role Update Failed", err?.message || "Failed to update project role"));
    }
  };

  // Add Task directly inside the active project workspace
  const handleAddTaskToProject = async (proj: Project) => {
    if (!newTaskTitle.trim()) return;

    if (projectUserRole === "Viewer") {
      import("@/lib/utils").then(m => m.emitError("Access Denied", "Viewers do not have permission to deploy tasks in this project context."));
      return;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      type: "task",
      title: newTaskTitle,
      description: newTaskDesc,
      status: "pending",
      priority: newTaskPriority,
      due_date: newTaskDueDate || new Date().toISOString().split("T")[0],
      project_id: proj.id,
      workspace_id: proj.workspace_id || undefined,
      tags: [],
      category: proj.category || "Development",
      assignee_id: newTaskAssigneeId || undefined
    };

    try {
      await createItem(newTask);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskPriority("medium");
      setNewTaskDueDate("");
      setNewTaskAssigneeId("");
      loadData();
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err: any) {
      console.error("Failed to create sub-task:", err);
      import("@/lib/utils").then(m => m.emitError("Task Creation Failed", err?.message || "Failed to create task"));
    }
  };

  // Toggle sub-task status instantly
  const handleToggleTaskStatus = async (task: Task) => {
    const session = getCurrentSession();
    const currentUserId = session?.id;

    const assignees = task.assignee_id ? task.assignee_id.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (projectUserRole === "Viewer" && !assignees.includes(currentUserId || "")) {
      import("@/lib/utils").then(m => m.emitError("Access Denied", "You do not have permission to modify this task. Only the assignee or leads may toggle it."));
      return;
    }

    const updatedTask: Task = {
      ...task,
      status: task.status === "completed" ? "pending" : "completed"
    };
    try {
      await updateItem(task.id, updatedTask);
      loadData();
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err: any) {
      console.error("Failed to toggle sub-task status:", err);
      import("@/lib/utils").then(m => m.emitError("Task Update Failed", err?.message || "Failed to toggle task status"));
    }
  };

  const handleSaveTaskDetail = async () => {
    if (!selectedTaskDetail || !selectedTaskDetail.title.trim()) return;
    try {
      await updateItem(selectedTaskDetail.id, selectedTaskDetail);
      loadData();
      setSelectedTaskDetail(null);
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err: any) {
      console.error("Failed to update task details:", err);
      import("@/lib/utils").then(m => m.emitError("Task Details Update Failed", err?.message || "Failed to save task details"));
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteItem(taskToDelete);
      setTaskToDelete(null);
      loadData();
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      import("@/lib/utils").then(m => m.emitError("Task Deletion Failed", err?.message || "Failed to delete task"));
    }
  };

  // Filter computation
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Organizational context filter
      const pWorkspace = workspaces.find(w => w.id === p.workspace_id);
      if (activeOrgId === "standalone") {
        const isStandaloneProject = !p.workspace_id || (pWorkspace && !pWorkspace.organization_id);
        if (!isStandaloneProject) return false;
      } else if (activeOrgId !== "all") {
        if (!p.workspace_id || !pWorkspace || pWorkspace.organization_id !== activeOrgId) {
          return false;
        }
      }

      // 2. Main filters
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesWorkspace = filterWorkspace === "All" ||
        (filterWorkspace === "personal" && !p.workspace_id) ||
        (p.workspace_id === filterWorkspace);

      const matchesStatus = filterStatus === "All" || p.status === filterStatus;
      const matchesPriority = filterPriority === "All" || p.priority === filterPriority;

      return matchesSearch && matchesWorkspace && matchesStatus && matchesPriority;
    });
  }, [projects, searchQuery, filterWorkspace, filterStatus, filterPriority, activeOrgId, workspaces]);

  // Overall Stats counters
  const totalStats = useMemo(() => {
    const orgFilteredProjects = projects.filter(p => {
      const pWorkspace = workspaces.find(w => w.id === p.workspace_id);
      if (activeOrgId === "standalone") {
        return !p.workspace_id || (pWorkspace && !pWorkspace.organization_id);
      } else if (activeOrgId !== "all") {
        return p.workspace_id && pWorkspace && pWorkspace.organization_id === activeOrgId;
      }
      return true;
    });

    const activeCount = orgFilteredProjects.filter(p => p.status === "active").length;
    const completedCount = orgFilteredProjects.filter(p => p.status === "completed").length;
    
    const orgFilteredProjIds = new Set(orgFilteredProjects.map(p => p.id));
    const linkedTasks = tasks.filter(t => t.project_id && orgFilteredProjIds.has(t.project_id)).length;
    
    return {
      total: orgFilteredProjects.length,
      active: activeCount,
      completed: completedCount,
      tasks: linkedTasks
    };
  }, [projects, tasks, activeOrgId, workspaces]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4 relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Projects</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">
            Manage your projects, track progress, and organize tasks.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-border/50 p-0.5 bg-secondary/30 shrink-0">
            <button
              onClick={() => setViewStyle("grid")}
              className={cn("p-2 transition-all rounded-[8px]", viewStyle === "grid" ? "bg-background text-primary shadow-sm border border-border/20" : "text-muted-foreground hover:text-foreground")}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewStyle("list")}
              className={cn("p-2 transition-all rounded-[8px]", viewStyle === "list" ? "bg-background text-primary shadow-sm border border-border/20" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <Button 
            onClick={() => {
              setForm(emptyProjectForm);
              setEditingProjectId(null);
              setShowForm(true);
            }}
            className="rounded-[8px] bg-primary hover:bg-primary/95 text-white shadow-xl h-11 px-6 font-bold text-xs uppercase tracking-widest flex items-center justify-center shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* STATS COUNT GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Projects", value: totalStats.total, color: "text-blue-500", icon: FolderKanban },
          { label: "Active Pipelines", value: totalStats.active, color: "text-emerald-500", icon: Layers },
          { label: "Completed Hubs", value: totalStats.completed, color: "text-purple-500", icon: CheckSquare },
          { label: "Connected Tasks", value: totalStats.tasks, color: "text-amber-500", icon: Sparkles }
        ].map((stat, idx) => (
          <Card key={idx} className="border border-border/50 glass-panel rounded-[8px] shadow-md overflow-hidden relative group">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.25em] mb-1 font-mono">{stat.label}</p>
                <h3 className="text-3xl font-bold tracking-tighter font-mono">{String(stat.value).padStart(2, "0")}</h3>
              </div>
              <div className={cn("p-3 bg-secondary/30 shrink-0", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SEARCH AND FILTER BAR */}
      <Card className="border border-border/50 bg-secondary/5 rounded-[8px] p-5 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border/30 h-10 rounded-[8px] w-full focus-visible:ring-primary"
            />
          </div>

          <div>
            <select
              value={filterWorkspace}
              onChange={(e) => setFilterWorkspace(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border/30 text-xs font-medium rounded-[8px] focus:outline-none focus:border-primary font-mono text-muted-foreground"
            >
              <option value="All">All Workspace Contexts</option>
              <option value="personal">Standalone (Personal)</option>
              {workspaces.filter(w => {
                if (activeOrgId === "standalone") return !w.organization_id;
                if (activeOrgId !== "all") return w.organization_id === activeOrgId;
                return true;
              }).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border/30 text-xs font-medium rounded-[8px] focus:outline-none focus:border-primary font-mono text-muted-foreground"
            >
              <option value="All">All Statuses</option>
              {PROJECT_STATUSES.map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border/30 text-xs font-medium rounded-[8px] focus:outline-none focus:border-primary font-mono text-muted-foreground"
            >
              <option value="All">All Priorities</option>
              {PROJECT_PRIORITIES.map(p => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* CORE CONTENT LOADING OR POPULATED */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-xs uppercase tracking-widest font-mono font-bold">Synchronizing core systems...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-20 text-center border border-dashed border-border/50 bg-secondary/5 rounded-[8px]">
          <FolderKanban className="w-16 h-16 mx-auto mb-4 opacity-20 text-muted-foreground" />
          <h3 className="text-lg font-bold uppercase tracking-widest font-mono text-muted-foreground mb-1">No Projects Found</h3>
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wide font-mono">Create a project pipeline or adjust your filters.</p>
        </div>
      ) : viewStyle === "grid" ? (
        
        /* GRID LAYOUT VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((p) => {
            const statsObj = getProjectStats(p.id);
            const pWorkspace = workspaces.find(w => w.id === p.workspace_id);
            
            return (
              <Card 
                key={p.id} 
                className="overflow-hidden border border-border/50 shadow-xl glass-panel group hover:border-primary/50 transition-all duration-500 rounded-[8px] flex flex-col relative"
              >
                {/* Project Color Border Node */}
                <div 
                  className="h-1.5 w-full shrink-0" 
                  style={{ backgroundColor: p.color || "#3b82f6" }}
                />

                <CardHeader className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[8px] font-extrabold uppercase tracking-widest text-primary font-mono mb-1">{p.category || "General"}</p>
                      <CardTitle className="text-xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors truncate max-w-[200px]" onClick={() => setActiveProject(p)}>
                        {p.name}
                      </CardTitle>
                    </div>
                    
                    {/* Status Badge */}
                    <Badge className={cn(
                      "text-[8px] font-bold tracking-wider uppercase rounded-[8px] shrink-0 border",
                      p.status === "completed" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
                      p.status === "active" && "bg-blue-500/10 text-blue-500 border-blue-500/25",
                      p.status === "on-hold" && "bg-amber-500/10 text-amber-500 border-amber-500/25",
                      p.status === "planning" && "bg-purple-500/10 text-purple-500 border-purple-500/25",
                      p.status === "cancelled" && "bg-red-500/10 text-red-500 border-red-500/25"
                    )} variant="outline">
                      {p.status}
                    </Badge>
                  </div>
                  
                  {/* Workspace Linkage Label */}
                  <div className="flex items-center gap-1.5 mt-3">
                    {pWorkspace ? (
                      <>
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                        <span 
                          className="text-[9px] font-bold uppercase tracking-wider font-mono"
                          style={{ color: pWorkspace.color }}
                        >
                          {pWorkspace.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                        <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-wider font-mono">
                          Personal Project
                        </span>
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-muted-foreground/80 line-clamp-3 mb-6 leading-relaxed">
                    {p.description || "No project overview provided."}
                  </p>
                  
                  {/* Dynamic Progress Metric */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-bold font-mono tracking-wider text-muted-foreground/80">
                      <span>PROGRESS</span>
                      <span className="text-foreground">{statsObj.percent}% ({statsObj.completed}/{statsObj.total} Tasks)</span>
                    </div>
                    
                    <div className="w-full bg-secondary/50 h-1.5 rounded-[8px] overflow-hidden border border-border/10">
                      <div 
                        className="h-full transition-all duration-700" 
                        style={{ 
                          width: `${statsObj.percent}%`,
                          backgroundColor: p.color || "#3b82f6" 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-6 pt-0 border-t border-border/10 bg-secondary/20 flex justify-between items-center mt-auto">
                  {/* Start/End dates */}
                  <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase font-mono text-muted-foreground/60 shrink-0">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>
                      {p.start_date || "N/A"} - {p.end_date || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(p)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setProjectToDelete(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      className="h-8 rounded-[8px] border border-border/40 text-[9px] font-bold tracking-widest uppercase hover:bg-primary hover:text-white px-3" 
                      variant="outline"
                      onClick={() => setActiveProject(p)}
                    >
                      OPEN
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        
        /* LIST LAYOUT VIEW */
        <Card className="border border-border/50 glass-panel rounded-[8px] shadow-xl overflow-hidden">
          <div className="divide-y divide-border/20">
            {filteredProjects.map((p) => {
              const statsObj = getProjectStats(p.id);
              const pWorkspace = workspaces.find(w => w.id === p.workspace_id);
              
              return (
                <div key={p.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-secondary/10 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-3.5 h-3.5 rounded-[8px] shrink-0" style={{ backgroundColor: p.color || "#3b82f6" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="font-extrabold text-base cursor-pointer truncate" onClick={() => setActiveProject(p)}>{p.name}</h4>
                        <Badge className="text-[7.5px] py-0 px-2 rounded-[8px] font-bold uppercase tracking-widest font-mono" variant="secondary">{p.category}</Badge>
                        <Badge variant="outline" className={cn(
                          "text-[7px] py-0 px-2 rounded-[8px] font-bold uppercase tracking-widest font-mono shrink-0",
                          p.status === "completed" && "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
                          p.status === "active" && "text-blue-500 border-blue-500/20 bg-blue-500/5",
                          p.status === "on-hold" && "text-amber-500 border-amber-500/20 bg-amber-500/5",
                          p.status === "planning" && "text-purple-500 border-purple-500/20 bg-purple-500/5",
                          p.status === "cancelled" && "text-red-500 border-red-500/20 bg-red-500/5"
                        )}>
                          {p.status}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest font-mono">
                        {pWorkspace ? (
                          <div className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3 shrink-0" />
                            <span style={{ color: pWorkspace.color }}>{pWorkspace.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground/80">
                            <User className="w-3 h-3 shrink-0" />
                            <span>Standalone</span>
                          </div>
                        )}
                        <span>Priority: {p.priority}</span>
                        {p.end_date && <span>Due: {p.end_date}</span>}
                      </div>
                    </div>
                  </div>

                  {/* dynamic progress */}
                  <div className="w-full sm:w-48 shrink-0 space-y-1">
                    <div className="flex justify-between items-center text-[8px] font-bold font-mono tracking-wider text-muted-foreground/60">
                      <span>PROGRESS</span>
                      <span className="text-foreground">{statsObj.percent}%</span>
                    </div>
                    <div className="w-full bg-secondary/50 h-1.5 rounded-[8px] border border-border/10 overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${statsObj.percent}%`, backgroundColor: p.color || "#3b82f6" }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(p)}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setProjectToDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      className="h-8 rounded-[8px] border border-border/40 text-[9px] font-bold tracking-widest uppercase hover:bg-primary hover:text-white px-3 font-mono" 
                      variant="outline"
                      onClick={() => setActiveProject(p)}
                    >
                      OPEN
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* PROJECT CREATOR/EDITOR MODAL OVERLAY */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-background border border-border/50 rounded-[8px] shadow-2xl overflow-visible animate-in zoom-in duration-300 flex flex-col ring-1 ring-foreground/10 text-card-foreground">
            <CardHeader className="bg-secondary/20 border-b border-border/30 p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight uppercase font-mono text-foreground">
                  {editingProjectId ? "Modify Project Protocol" : "Launch Project Pipeline"}
                </CardTitle>
                <CardDescription className="text-[10px] tracking-wide uppercase font-mono text-muted-foreground/60 mt-1">Configure project system node settings</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Project Name</label>
                <Input 
                  placeholder="E.g. Helios Core Infrastructure" 
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Description Summary</label>
                <textarea
                  placeholder="Provide deep architectural overview..."
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full min-h-[70px] p-3 text-xs bg-secondary/20 border border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-[8px] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative z-20">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Category</label>
                  <div className="relative">
                    <Input 
                      value={form.category}
                      onChange={(e) => setForm({...form, category: e.target.value})}
                      placeholder="Enter custom category or choose..."
                      className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs pr-8"
                      onClick={() => setIsProjCategoryDropdownOpen(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsProjCategoryDropdownOpen(!isProjCategoryDropdownOpen)}
                      className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none"
                    >
                      <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isProjCategoryDropdownOpen ? "rotate-90 text-primary" : "")} />
                    </button>

                    {isProjCategoryDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setIsProjCategoryDropdownOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2.5 rounded-[8px] animate-in slide-in-from-top-2 fade-in duration-200 max-h-[160px] overflow-y-auto custom-scrollbar font-mono text-[9px]">
                          <div className="grid grid-cols-2 gap-1.5">
                            {["Development", "Design", "Marketing", "Finance", "Research", "Security", "Operations", "Legal", "Personal", "Strategy", "Content", "Other"].map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setForm({...form, category: cat});
                                  setIsProjCategoryDropdownOpen(false);
                                }}
                                className={cn(
                                  "text-[9px] uppercase font-bold tracking-widest px-2.5 py-2 rounded-[8px] border transition-all text-left flex items-center gap-1.5",
                                  form.category === cat 
                                    ? "bg-primary/10 text-primary border-primary/30 font-extrabold" 
                                    : "bg-background/40 text-muted-foreground/80 border-border/30 hover:border-muted-foreground/40 hover:bg-secondary/40 hover:text-foreground"
                                )}
                              >
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  cat === "Development" ? "bg-blue-500" :
                                  cat === "Design" ? "bg-pink-500" :
                                  cat === "Marketing" ? "bg-purple-500" :
                                  cat === "Finance" ? "bg-emerald-500" :
                                  cat === "Research" ? "bg-amber-500" :
                                  cat === "Security" ? "bg-red-500" :
                                  cat === "Operations" ? "bg-cyan-500" :
                                  cat === "Legal" ? "bg-orange-500" :
                                  cat === "Personal" ? "bg-teal-500" :
                                  cat === "Strategy" ? "bg-violet-500" :
                                  cat === "Content" ? "bg-lime-500" :
                                  "bg-slate-400"
                                )} />
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Workspace Context</label>
                  <select
                    value={form.workspace_id}
                    onChange={(e) => setForm({...form, workspace_id: e.target.value})}
                    className="w-full h-10 px-3 bg-secondary/20 border border-border/30 text-xs text-foreground font-medium rounded-[8px] focus:outline-none focus:border-primary"
                  >
                    <option value="personal">Standalone (Personal Goal)</option>
                    {workspaces.filter(w => {
                      if (activeOrgId === "standalone") return !w.organization_id;
                      if (activeOrgId !== "all") return w.organization_id === activeOrgId;
                      return true;
                    }).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Status Node</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value as ProjectStatus})}
                    className="w-full h-10 px-3 bg-secondary/20 border border-border/30 text-xs text-foreground font-medium rounded-[8px] focus:outline-none focus:border-primary"
                  >
                    {PROJECT_STATUSES.map(s => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Priority Tier</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({...form, priority: e.target.value as ProjectPriority})}
                    className="w-full h-10 px-3 bg-secondary/20 border border-border/30 text-xs text-foreground font-medium rounded-[8px] focus:outline-none focus:border-primary"
                  >
                    {PROJECT_PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Start Date</label>
                  <Input 
                    type="date" 
                    value={form.start_date}
                    onChange={(e) => setForm({...form, start_date: e.target.value})}
                    className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Target Deadline</label>
                  <Input 
                    type="date" 
                    value={form.end_date}
                    onChange={(e) => setForm({...form, end_date: e.target.value})}
                    className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Project Budget Limit ($)</label>
                <Input 
                  type="number"
                  placeholder="E.g. 5000 (Leave empty for no limit)"
                  value={form.budget}
                  onChange={(e) => setForm({...form, budget: e.target.value})}
                  className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/75 font-mono">Spectrum Node Color Tint</label>
                <div className="flex flex-wrap gap-2.5">
                  {SPECTRUM_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setForm({...form, color: c.hex})}
                      className={cn(
                        "w-7 h-7 rounded-[8px] border-2 transition-transform hover:scale-110 shrink-0",
                        form.color === c.hex ? "border-foreground scale-110 shadow-lg" : "border-transparent"
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="bg-secondary/20 border-t border-border/30 p-6 flex justify-end gap-3">
              <Button variant="ghost" className="rounded-[8px] font-bold uppercase tracking-widest text-[9px] h-10 font-mono" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="rounded-[8px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 font-mono" onClick={handleSaveProject}>
                <Save className="w-3.5 h-3.5 mr-2" />
                Initialize Node
              </Button>
            </CardFooter>
          </div>
        </div>
      )}

      {/* FULLY FEATURED PROJECT DETAILED WORKSPACE MODAL OVERLAY */}
      {syncedActiveProject && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-[1400px] w-full h-[90vh] lg:h-[85vh] bg-background border border-border/50 rounded-[8px] shadow-2xl overflow-y-auto lg:overflow-visible flex flex-col animate-in zoom-in duration-300 ring-1 ring-foreground/10 text-card-foreground">
            
            {/* Modal Header */}
            <CardHeader className="bg-secondary/20 border-b border-border/30 p-4 sm:p-6 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-3.5 h-8 shrink-0" style={{ backgroundColor: syncedActiveProject.color || "#3b82f6" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-wider text-[8px] font-bold uppercase">{syncedActiveProject.category}</Badge>
                    <Badge variant="secondary" className="text-[7.5px] uppercase font-bold tracking-widest font-mono bg-secondary/80 text-foreground">{syncedActiveProject.status}</Badge>
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 truncate">{syncedActiveProject.name}</CardTitle>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:bg-secondary shrink-0 self-end sm:self-auto" onClick={() => {
                setActiveProject(null);
                setActiveReassignTaskId(null);
              }}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>

            {/* Modal Scrollable Workspace Content split into 2 Columns */}
            <div className="flex-1 overflow-visible flex flex-col lg:flex-row">
              
              {/* LEFT PANE: Project details summary */}
              <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-border/20 p-6 space-y-6 lg:overflow-y-auto shrink-0 bg-secondary/5">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">Overview</h4>
                  <p className="text-xs text-foreground/80 leading-relaxed bg-background/50 border border-border/20 p-4 font-mono shadow-inner whitespace-pre-wrap">
                    {syncedActiveProject.description || "No deep description logged."}
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">System Parameters</h4>
                  
                  <div className="grid grid-cols-2 gap-4 divide-x divide-border/20 bg-background/50 border border-border/20 p-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-muted-foreground/60 uppercase font-mono block">Context</span>
                      <span className="text-xs font-bold font-mono">
                        {workspaces.find(w => w.id === syncedActiveProject.workspace_id)?.name || "Standalone"}
                      </span>
                    </div>
                    <div className="space-y-1 pl-4">
                      <span className="text-[8px] font-bold text-muted-foreground/60 uppercase font-mono block">Priority</span>
                      <span className="text-xs font-bold font-mono text-primary uppercase">{syncedActiveProject.priority}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 divide-x divide-border/20 bg-background/50 border border-border/20 p-4">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-muted-foreground/60 uppercase font-mono block">Start Date</span>
                      <span className="text-xs font-bold font-mono">{syncedActiveProject.start_date || "N/A"}</span>
                    </div>
                    <div className="space-y-1 pl-4">
                      <span className="text-[8px] font-bold text-muted-foreground/60 uppercase font-mono block">Deadline</span>
                      <span className="text-xs font-bold font-mono">{syncedActiveProject.end_date || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar details */}
                <div className="space-y-2 bg-background/50 border border-border/20 p-4">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">Live Metrics</h4>
                  <div className="flex justify-between items-center text-[9px] font-bold font-mono text-muted-foreground/80">
                    <span>Task Completion</span>
                    <span className="text-foreground">{getProjectStats(syncedActiveProject.id).percent}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-[8px] border border-border/10 overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500" 
                      style={{ 
                        width: `${getProjectStats(syncedActiveProject.id).percent}%`, 
                        backgroundColor: syncedActiveProject.color || "#3b82f6" 
                      }} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/10 text-[9px] font-bold font-mono">
                    <div>
                      <span className="text-muted-foreground">TOTAL TASKS:</span>
                      <span className="ml-1 text-foreground">{getProjectStats(syncedActiveProject.id).total}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">COMPLETED:</span>
                      <span className="ml-1 text-foreground">{getProjectStats(syncedActiveProject.id).completed}</span>
                    </div>
                  </div>
                </div>

                {/* Finance progress bar details */}
                <div className="space-y-3 bg-background/50 border border-border/20 p-4">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">Financial Metrics</h4>
                  {syncedActiveProject.budget ? (
                    (() => {
                      const limit = syncedActiveProject.budget || 0;
                      const spent = transactions
                        .filter(t => t.project_id === syncedActiveProject.id && t.transaction_type === 'expense')
                        .reduce((sum, tx) => sum + tx.amount, 0);
                      const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
                      
                      let barColor = "#10b981"; // emerald
                      let textColor = "text-emerald-500";
                      if (spent >= limit) {
                        barColor = "#ef4444"; // crimson red
                        textColor = "text-red-500 font-extrabold animate-pulse";
                      } else if (spent >= limit * 0.75) {
                        barColor = "#f59e0b"; // amber gold
                        textColor = "text-amber-500 font-bold";
                      }

                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-bold font-mono text-muted-foreground/80">
                            <span>Budget Consumed</span>
                            <span className={textColor}>{percent}%</span>
                          </div>
                          <div className="w-full bg-secondary h-2 rounded-[8px] border border-border/10 overflow-hidden">
                            <div 
                              className="h-full transition-all duration-500" 
                              style={{ 
                                width: `${percent}%`, 
                                backgroundColor: barColor 
                              }} 
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/10 text-[9px] font-bold font-mono">
                            <div>
                              <span className="text-muted-foreground">SPENT:</span>
                              <span className="ml-1 text-foreground">${spent.toLocaleString()}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">LIMIT:</span>
                              <span className="ml-1 text-foreground">${limit.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                      No budget configured for this project pipeline. Click edit to define.
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Dedicated Workspace Panel (Sub-Tasks & Project Access) */}
              <div className="flex-1 p-6 flex flex-col lg:overflow-visible min-h-[400px] lg:min-h-0 bg-background">
                <div className="border-b border-border/20 pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={projectModalTab === "tasks" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setProjectModalTab("tasks");
                        setActiveReassignTaskId(null);
                      }}
                      className={cn(
                        "rounded-[8px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        projectModalTab === "tasks" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <CheckSquare className="w-3.5 h-3.5 mr-2" />
                      Sub-Tasks ({tasks.filter(t => t.project_id === syncedActiveProject.id).length})
                    </Button>
                    <Button
                      variant={projectModalTab === "access" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setProjectModalTab("access");
                        setActiveReassignTaskId(null);
                      }}
                      className={cn(
                        "rounded-[8px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        projectModalTab === "access" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                      Manage Access ({roleAssignments.filter(ra => ra.scope_type === "project" && ra.scope_id === syncedActiveProject.id).length})
                    </Button>
                    <Button
                      variant={projectModalTab === "finance" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setProjectModalTab("finance");
                        setActiveReassignTaskId(null);
                      }}
                      className={cn(
                        "rounded-[8px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        projectModalTab === "finance" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <Wallet className="w-3.5 h-3.5 mr-2" />
                      Finance & Budget (${transactions.filter(t => t.project_id === syncedActiveProject.id && t.transaction_type === 'expense').reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()})
                    </Button>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[8px] bg-secondary border border-border/20 px-3 py-1 shrink-0 uppercase tracking-widest self-end sm:self-auto">
                    {projectModalTab === "tasks" ? "Task Queue" : projectModalTab === "access" ? "Project Governance" : "Finance Ledger"}
                  </Badge>
                </div>

                {projectModalTab === "tasks" ? (
                  <>
                    {/* Sub-Task Insertion Panel */}
                    <div className="border border-border/50 bg-secondary/15 rounded-[8px] p-4 mb-6 shrink-0 relative z-30 shadow-lg bg-card text-card-foreground text-sm ring-1 ring-foreground/10 flex flex-col gap-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/80 font-mono mb-3">Push New Sub-Task Node</p>
                      
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1">
                          <Input 
                            placeholder="Task title..." 
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="bg-background border-border/30 h-9 rounded-[8px] text-xs focus-visible:ring-primary placeholder:text-muted-foreground/50"
                          />
                        </div>
                        
                        <div className="w-full md:w-36">
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                            className="w-full h-9 px-2 bg-background border border-border/30 text-xs font-semibold rounded-[8px] focus:outline-none focus:border-primary font-mono text-muted-foreground"
                          >
                            <option value="low">LOW</option>
                            <option value="medium">MEDIUM</option>
                            <option value="high">HIGH</option>
                          </select>
                        </div>

                        <div className="w-full md:w-40">
                          <Input 
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="bg-background border-border/30 h-9 rounded-[8px] text-xs font-mono text-muted-foreground"
                          />
                        </div>

                        <div className="w-full md:w-48 relative z-40">
                          {/* Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                            className="w-full h-9 px-2 flex items-center justify-between bg-background border border-border/30 rounded-[8px] text-left hover:border-primary/50 transition-all focus:outline-none text-[10px]"
                          >
                            <div className="flex items-center gap-1 overflow-hidden truncate max-w-[85%]">
                              {(() => {
                                const selectedAssigneeIds = newTaskAssigneeId ? newTaskAssigneeId.split(",").map(s => s.trim()).filter(Boolean) : [];
                                if (selectedAssigneeIds.length === 0) {
                                  return <span className="text-[10px] text-muted-foreground/60 font-semibold font-mono uppercase">NO ASSIGNEE</span>;
                                }
                                return (
                                  <div className="flex -space-x-1.5 items-center">
                                    {selectedAssigneeIds.map(id => {
                                      const u = allowedProjectUsers.find(user => user.id === id);
                                      if (!u) return null;
                                      return (
                                        <img 
                                          key={id}
                                          src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} 
                                          className="w-5 h-5 rounded-[8px] border border-background bg-secondary shrink-0" 
                                          alt="Assignee" 
                                          title={u.display_name || u.username}
                                        />
                                      );
                                    })}
                                    <span className="text-[9px] font-bold font-mono text-primary uppercase ml-1.5">
                                      ({selectedAssigneeIds.length})
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground/50 transition-transform shrink-0 ml-1", isAssigneeDropdownOpen ? "rotate-90 text-primary" : "")} />
                          </button>

                          {/* Multi-select Dropdown list */}
                          {isAssigneeDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setIsAssigneeDropdownOpen(false)} />
                              <div className="absolute right-0 left-0 md:left-auto md:w-56 mt-1.5 z-40 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2 rounded-[8px] animate-in slide-in-from-top-2 fade-in duration-200 max-h-[200px] overflow-y-auto custom-scrollbar font-mono text-[9px]">
                                <div className="space-y-1">
                                  {allowedProjectUsers.map((user) => {
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
                                          "w-full text-left px-2 py-1.5 rounded-[8px] transition-all flex items-center justify-between border",
                                          isSelected
                                            ? "bg-primary/10 border-primary/30 text-primary font-bold"
                                            : "bg-background/40 border-border/30 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                        )}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <img 
                                            src={user.avatar_url ? resolveDriveImage(user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} 
                                            className="w-4 h-4 rounded-[8px] border border-border/30 bg-secondary shrink-0" 
                                            alt="Avatar" 
                                          />
                                          <span className="truncate">{user.display_name || user.username}</span>
                                        </div>
                                        {isSelected && (
                                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                  {allowedProjectUsers.length === 0 && (
                                    <div className="p-2 text-center text-muted-foreground">
                                      NO MEMBERS AVAILABLE
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <Button 
                          onClick={() => handleAddTaskToProject(syncedActiveProject)}
                          className="rounded-[8px] bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-[9px] h-9 px-4 shrink-0 font-mono"
                        >
                          PUSH NODE
                        </Button>
                      </div>
                    </div>

                    {/* Sub-Task Scroll Queue */}
                    <div className="flex-1 lg:overflow-y-auto overflow-visible space-y-3 custom-scrollbar pr-2 relative z-10 pb-36">
                      {tasks.filter(t => t.project_id === syncedActiveProject.id).length === 0 ? (
                        <div className="p-16 text-center text-muted-foreground border border-dashed border-border/30 rounded-[8px] bg-secondary/5">
                          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-10 text-muted-foreground" />
                          <p className="text-xs font-bold uppercase tracking-widest font-mono">No Linked Sub-Tasks</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-wider font-mono">Add tasks to initialize the work stream.</p>
                        </div>
                      ) : (
                        tasks.filter(t => t.project_id === syncedActiveProject.id).map((t) => {
                          return (
                            <div 
                              key={t.id} 
                              onClick={() => setSelectedTaskDetail(t)}
                              className="p-4 bg-secondary/20 hover:bg-secondary/30 transition-all border border-border/30 flex items-center justify-between gap-4 rounded-[8px] group/task cursor-pointer"
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Toggle Checkbox */}
                                <div 
                                  className="w-7 h-7 rounded-[8px] bg-background border border-border/40 flex items-center justify-center shrink-0 shadow-inner group-hover/task:border-primary transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTaskStatus(t);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={t.status === "completed"}
                                    onChange={() => {}} // handled by div click
                                    className="w-3.5 h-3.5 rounded-[8px] accent-primary text-primary focus:ring-0 cursor-pointer pointer-events-none"
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className={cn(
                                    "font-bold text-xs truncate transition-all duration-300",
                                    t.status === "completed" ? "line-through text-muted-foreground/40 font-medium" : "text-foreground"
                                  )}>
                                    {t.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[8px] font-bold font-mono uppercase text-muted-foreground/60 tracking-wider">
                                    <Badge variant="outline" className="text-[7px] py-0 px-1 border-border/50 opacity-50 font-bold">{t.priority}</Badge>
                                    {t.due_date && <span>DUE: {t.due_date}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {(() => {
                                  const assigneeIds = t.assignee_id ? t.assignee_id.split(",").map(s => s.trim()).filter(Boolean) : [];
                                  return (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (activeReassignTaskId === t.id) {
                                            setActiveReassignTaskId(null);
                                          } else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            setPopoverRenderUpwards(spaceBelow < 200);
                                            setActiveReassignTaskId(t.id);
                                          }
                                        }}
                                        className="flex items-center -space-x-1.5 bg-background/50 hover:bg-background/80 border border-border/30 hover:border-primary/50 transition-all rounded-[8px] px-2 py-1 select-none flex-wrap cursor-pointer"
                                        title="Click to reassign members"
                                      >
                                        {assigneeIds.length === 0 ? (
                                          <span className="text-[8px] font-bold font-mono uppercase text-muted-foreground tracking-wider">
                                            UNASSIGNED
                                          </span>
                                        ) : (
                                          assigneeIds.map(id => {
                                            const u = allUsers.find(user => user.id === id);
                                            if (!u) return null;
                                            return (
                                              <img 
                                                key={id}
                                                src={u.avatar_url ? resolveDriveImage(u.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} 
                                                className="w-5 h-5 rounded-[8px] border border-background bg-secondary shrink-0" 
                                                alt="Assignee" 
                                                title={u.display_name || u.username}
                                              />
                                            );
                                          })
                                        )}
                                      </button>

                                      {/* Inline Reassign Popover */}
                                      {activeReassignTaskId === t.id && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveReassignTaskId(null); }} />
                                          <div 
                                            className={cn(
                                              "absolute right-0 z-50 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2 rounded-[8px] fade-in duration-200 w-56 max-h-[180px] overflow-y-auto custom-scrollbar font-mono text-[9px]",
                                              popoverRenderUpwards 
                                                ? "bottom-full mb-1.5 origin-bottom animate-in slide-in-from-bottom-2" 
                                                : "top-full mt-1.5 origin-top animate-in slide-in-from-top-2"
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="border-b border-border/20 pb-1 mb-1.5 flex justify-between items-center text-[8px] font-bold uppercase tracking-wider">
                                              <span className="text-foreground">REASSIGN TASK</span>
                                              <span className="text-primary">({assigneeIds.length} SELECTED)</span>
                                            </div>
                                            <div className="space-y-1">
                                              {allowedProjectUsers.map((user) => {
                                                const isSelected = assigneeIds.includes(user.id);
                                                return (
                                                  <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={async () => {
                                                      let updatedIds: string[];
                                                      if (isSelected) {
                                                        updatedIds = assigneeIds.filter(id => id !== user.id);
                                                      } else {
                                                        updatedIds = [...assigneeIds, user.id];
                                                      }
                                                      const updatedTask = {
                                                        ...t,
                                                        assignee_id: updatedIds.join(",")
                                                      };
                                                      try {
                                                        await updateItem(t.id, updatedTask);
                                                        loadData();
                                                        window.dispatchEvent(new CustomEvent("myos:data-changed"));
                                                      } catch (err) {
                                                        console.error("Failed to reassign task:", err);
                                                      }
                                                    }}
                                                    className={cn(
                                                      "w-full text-left px-2 py-1.5 rounded-[8px] transition-all flex items-center justify-between border",
                                                      isSelected
                                                        ? "bg-primary/10 border-primary/30 text-primary font-bold"
                                                        : "bg-background/40 border-border/30 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                                    )}
                                                  >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      <img 
                                                        src={user.avatar_url ? resolveDriveImage(user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} 
                                                        className="w-4 h-4 rounded-[8px] border border-border/30 bg-secondary shrink-0" 
                                                        alt="Avatar" 
                                                      />
                                                      <span className="truncate">{user.display_name || user.username}</span>
                                                    </div>
                                                    {isSelected && (
                                                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })()}

                                <div className="shrink-0 flex items-center gap-1.5 opacity-40 group-hover/task:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTaskToDelete(t.id);
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : projectModalTab === "access" ? (
                  /* ACCESS GOVERNANCE GRID: Left input form, Right role list */
                  <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-visible lg:overflow-visible">
                    {/* Left pane: Assign Role Form */}
                    <div className="w-full lg:w-72 space-y-4 shrink-0 bg-secondary/5 border border-border/20 p-4">
                      <div className="border-b border-border/20 pb-2 mb-3">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-foreground font-mono">Assign Project Role</h4>
                        <p className="text-[8px] text-muted-foreground font-mono uppercase mt-0.5">Configure access permissions</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Select User</label>
                          <select
                            value={selectedUserForProjRole}
                            onChange={e => setSelectedUserForProjRole(e.target.value)}
                            className="w-full h-10 px-2 rounded-[8px] bg-background/70 border border-border/30 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground"
                          >
                            <option value="">-- Choose User --</option>
                            {allowedProjectUsers.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.display_name || user.username} (@{user.username})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Role Scope</label>
                          <select
                            value={selectedRoleForUserOnProj}
                            onChange={e => setSelectedRoleForUserOnProj(e.target.value)}
                            className="w-full h-10 px-2 rounded-[8px] bg-background/70 border border-border/30 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground font-mono"
                          >
                            <option value="Project Lead">Project Lead</option>
                            <option value="Contributor">Contributor</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        </div>

                        <Button
                          onClick={handleAssignProjectRole}
                          disabled={!selectedUserForProjRole}
                          className="w-full rounded-[8px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-sm"
                        >
                          Grant Project Access
                        </Button>
                      </div>
                    </div>

                    {/* Right pane: List of users with project role assignments */}
                    <div className="flex-1 flex flex-col overflow-visible lg:overflow-visible min-h-[250px] lg:min-h-0">
                      <div className="border-b border-border/20 pb-2 mb-3">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-foreground font-mono">Role Registry</h4>
                        <p className="text-[8px] text-muted-foreground font-mono uppercase mt-0.5">Active access configurations</p>
                      </div>

                      <div className="flex-1 lg:overflow-y-auto overflow-visible pr-1 space-y-3 custom-scrollbar pb-12">
                        {roleAssignments.filter(ra => ra.scope_type === "project" && ra.scope_id === syncedActiveProject.id).length === 0 ? (
                          <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/20">
                            <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mb-3" />
                            <h4 className="text-xs font-bold uppercase tracking-wide">No Role Assignments</h4>
                            <p className="text-[9px] text-muted-foreground/60 max-w-xs mt-1 uppercase tracking-wider font-mono">Assign users on the left to set project-level permissions.</p>
                          </div>
                        ) : (
                          roleAssignments.filter(ra => ra.scope_type === "project" && ra.scope_id === syncedActiveProject.id).map(ra => {
                            const u = allUsers.find(user => user.id === ra.user_id);
                            return (
                              <div 
                                key={ra.id} 
                                className="p-3 border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all rounded-[8px] flex items-center justify-between gap-4 group/projaccess"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-[8px] bg-background border border-border/50 flex items-center justify-center font-bold text-xs uppercase text-primary shrink-0">
                                    {u?.display_name ? u.display_name.slice(0, 2) : u?.username ? u.username.slice(0, 2) : "??"}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold uppercase tracking-tight truncate text-foreground">
                                      {u?.display_name || u?.username || "Unknown User"}
                                    </h4>
                                    <p className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">@{u?.username || "unknown"}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                  {projectUserRole === "Project Lead" && ra.role !== "Project Lead" ? (
                                    <select
                                      value={ra.role}
                                      onChange={(e) => handleUpdateProjectRole(ra.id!, e.target.value)}
                                      className="text-[10px] font-bold font-mono tracking-wider uppercase bg-secondary/50 border border-border/30 rounded-[8px] px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                                    >
                                      <option value="Contributor">Contributor</option>
                                      <option value="Viewer">Viewer</option>
                                    </select>
                                  ) : (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-[8px] font-mono border",
                                        ra.role === "Project Lead" ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                                        ra.role === "Contributor" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                        "bg-secondary/40 text-muted-foreground border-border/20"
                                      )}
                                    >
                                      {ra.role}
                                    </Badge>
                                  )}
                                  <Button
                                    onClick={() => handleRevokeProjectRole(ra.id!)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/projaccess:opacity-100 opacity-100 transition-all rounded-[8px] animate-in fade-in"
                                    title="Revoke project access"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FINANCE & BUDGET TAB: Summary card, inline log spent form, table ledger */
                  <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-visible lg:overflow-visible">
                    
                    {/* Left: Quick Summary & Quick inline spend logger */}
                    <div className="w-full lg:w-[320px] shrink-0 space-y-4">
                      
                      {/* Budget parameters summary */}
                      <div className="border border-border/40 bg-secondary/5 p-4 rounded-[8px] space-y-3">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-foreground font-mono">Budget Overview</h4>
                        
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-muted-foreground">TOTAL BUDGET:</span>
                            <span className="font-bold text-foreground">
                              {syncedActiveProject.budget ? `$${syncedActiveProject.budget.toLocaleString()}` : "N/A"}
                            </span>
                          </div>
                          
                          {(() => {
                            const limit = syncedActiveProject.budget || 0;
                            const spent = transactions
                              .filter(t => t.project_id === syncedActiveProject.id && t.transaction_type === 'expense')
                              .reduce((sum, tx) => sum + tx.amount, 0);
                            const remaining = limit - spent;
                            const isOverBudget = remaining < 0;

                            return (
                              <>
                                <div className="flex justify-between items-center text-[10px] font-mono">
                                  <span className="text-muted-foreground">TOTAL SPENT:</span>
                                  <span className="font-bold text-red-400">${spent.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-mono pt-2 border-t border-border/10">
                                  <span className="text-muted-foreground">REMAINING:</span>
                                  <span className={cn(
                                    "font-extrabold font-mono",
                                    isOverBudget ? "text-red-500 animate-pulse" : "text-emerald-400"
                                  )}>
                                    {isOverBudget ? `-$${Math.abs(remaining).toLocaleString()}` : `$${remaining.toLocaleString()}`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Inline log spent form */}
                      <div className="border border-border/40 bg-secondary/10 p-4 rounded-[8px] space-y-3 relative z-30 shadow-md">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary font-mono flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          Log Project Spend
                        </h4>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">Expense Name</label>
                            <Input 
                              placeholder="E.g. Supabase DB, Logo Design" 
                              value={newExpenseDesc}
                              onChange={(e) => setNewExpenseDesc(e.target.value)}
                              className="bg-background border-border/30 h-8 rounded-[8px] text-xs focus-visible:ring-primary placeholder:text-muted-foreground/45"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">Amount ($)</label>
                              <Input 
                                type="number"
                                placeholder="0.00" 
                                value={newExpenseAmount}
                                onChange={(e) => setNewExpenseAmount(e.target.value)}
                                className="bg-background border-border/30 h-8 rounded-[8px] text-xs focus-visible:ring-primary"
                              />
                            </div>
                            <div className="space-y-1 relative">
                              <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">Category</label>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                  className="w-full h-8 px-2.5 flex items-center justify-between bg-background border border-border/30 rounded-[8px] text-left hover:border-primary/50 transition-all focus:outline-none text-xs text-foreground font-mono"
                                >
                                  <span className="truncate">{newExpenseCategory || "Select Category"}</span>
                                  <ChevronRight className={cn("w-3 h-3 text-muted-foreground/60 transition-transform shrink-0", isCategoryDropdownOpen ? "rotate-90 text-primary" : "")} />
                                </button>

                                {isCategoryDropdownOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoryDropdownOpen(false)} />
                                    <div className="absolute right-0 left-0 mt-1.5 z-50 bg-background/95 backdrop-blur-md border border-primary/20 shadow-2xl p-2 rounded-[8px] animate-in slide-in-from-top-2 fade-in duration-200 max-h-[220px] overflow-y-auto custom-scrollbar font-mono text-[9px] flex flex-col gap-1.5">
                                      <div className="px-1 py-1 flex items-center gap-1.5 border-b border-border/10 pb-2 mb-1.5">
                                        <Search className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                        <input
                                          type="text"
                                          placeholder="Search or add..."
                                          value={categorySearchQuery}
                                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                                          className="w-full bg-transparent outline-none border-none text-[10px] text-foreground placeholder:text-muted-foreground/50 py-0.5"
                                          autoFocus
                                        />
                                      </div>
                                      
                                      <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                                        {availableCategories
                                          .filter(cat => cat.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                                          .map(cat => (
                                            <button
                                              key={cat}
                                              type="button"
                                              onClick={() => {
                                                setNewExpenseCategory(cat);
                                                setIsCategoryDropdownOpen(false);
                                                setCategorySearchQuery("");
                                              }}
                                              className={cn(
                                                "w-full text-left px-2 py-1.5 rounded-[6px] transition-all flex items-center justify-between text-xs",
                                                newExpenseCategory === cat 
                                                  ? "bg-primary/10 text-primary font-bold" 
                                                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                              )}
                                            >
                                              <span>{cat}</span>
                                              {newExpenseCategory === cat && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                                            </button>
                                          ))
                                        }
                                        
                                        {categorySearchQuery.trim() && !availableCategories.some(cat => cat.toLowerCase() === categorySearchQuery.trim().toLowerCase()) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cleanedQuery = categorySearchQuery.trim();
                                              setNewExpenseCategory(cleanedQuery);
                                              setIsCategoryDropdownOpen(false);
                                              setCategorySearchQuery("");
                                            }}
                                            className="w-full text-left px-2 py-1.5 rounded-[6px] text-primary bg-primary/5 hover:bg-primary/10 transition-all font-bold text-xs flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Add Custom: "{categorySearchQuery.trim()}"</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 font-mono">Transaction Date</label>
                            <Input 
                              type="date"
                              value={newExpenseDate}
                              onChange={(e) => setNewExpenseDate(e.target.value)}
                              className="bg-background border-border/30 h-8 rounded-[8px] text-xs font-mono text-muted-foreground"
                            />
                          </div>

                          <Button
                            onClick={() => handleAddProjectExpense(syncedActiveProject)}
                            disabled={!newExpenseDesc.trim() || !newExpenseAmount}
                            className="w-full rounded-[8px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[8px] h-8 shadow-sm"
                          >
                            Log Expense Node
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Spent Registry Ledger */}
                    <div className="flex-1 flex flex-col min-h-[250px] lg:min-h-0 border border-border/20 rounded-[8px] p-4 bg-background/20">
                      <div className="border-b border-border/20 pb-2 mb-3">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-foreground font-mono">Project Spent Ledger</h4>
                        <p className="text-[8px] text-muted-foreground font-mono uppercase mt-0.5">Real-time expenditure audits</p>
                      </div>

                      <div className="flex-1 lg:overflow-y-auto overflow-visible pr-1 space-y-2.5 custom-scrollbar pb-12">
                        {(() => {
                          const projectTx = transactions.filter(t => t.project_id === syncedActiveProject.id && t.transaction_type === 'expense');
                          if (projectTx.length === 0) {
                            return (
                              <div className="py-16 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/5">
                                <Wallet className="w-8 h-8 text-muted-foreground/30 mb-3" />
                                <h4 className="text-xs font-bold uppercase tracking-wide">No Project Expenditures</h4>
                                <p className="text-[9px] text-muted-foreground/60 max-w-xs mt-1 uppercase tracking-wider font-mono">Use the logging form on the left to track spend for this project pipeline.</p>
                              </div>
                            );
                          }

                          return projectTx.map(tx => (
                            <div 
                              key={tx.id} 
                              className="p-3 border border-border/40 bg-secondary/15 hover:bg-secondary/25 transition-all rounded-[8px] flex items-center justify-between gap-4 group/expenseitem"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-center justify-center font-bold text-xs uppercase text-red-500 shrink-0">
                                  <TrendingDown className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold uppercase tracking-tight truncate text-foreground">
                                    {tx.description}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] text-muted-foreground truncate font-mono">@{tx.category.toUpperCase()}</span>
                                    <span className="text-[8px] text-muted-foreground/50 font-mono">•</span>
                                    <span className="text-[8px] text-muted-foreground/80 font-mono">{tx.date || "No Date"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-xs font-mono font-bold text-foreground">
                                  -${tx.amount.toLocaleString()}
                                </span>
                                <Button
                                  onClick={() => handleDeleteProjectExpense(tx.id, tx.description, tx.amount)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/expenseitem:opacity-100 opacity-100 transition-all rounded-[8px]"
                                  title="Purge expense node"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAIL DIALOG OVERLAY */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full bg-background border border-border/50 rounded-[8px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <CardHeader className="bg-secondary/10 border-b border-border/30 p-5 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary shrink-0" />
                <CardTitle className="text-sm font-bold uppercase font-mono tracking-wide text-foreground">Task Details</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:bg-secondary rounded-[8px]" 
                onClick={() => setSelectedTaskDetail(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Task Title</label>
                <Input
                  value={selectedTaskDetail.title}
                  onChange={(e) => setSelectedTaskDetail({ ...selectedTaskDetail, title: e.target.value })}
                  className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs font-bold focus-visible:ring-primary text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Description</label>
                <textarea
                  value={selectedTaskDetail.description || ""}
                  onChange={(e) => setSelectedTaskDetail({ ...selectedTaskDetail, description: e.target.value })}
                  placeholder="No deep description logged."
                  className="w-full min-h-[100px] p-3 text-xs bg-secondary/20 border border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-[8px] transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Due Date</label>
                  <Input
                    type="date"
                    value={selectedTaskDetail.due_date || ""}
                    onChange={(e) => setSelectedTaskDetail({ ...selectedTaskDetail, due_date: e.target.value })}
                    className="bg-secondary/20 border-border/30 h-10 rounded-[8px] text-xs font-mono text-muted-foreground"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Priority Scope</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["low", "medium", "high"] as const).map((prio) => (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => setSelectedTaskDetail({ ...selectedTaskDetail, priority: prio })}
                        className={cn(
                          "h-10 rounded-[8px] border text-[8.5px] font-bold uppercase tracking-widest font-mono transition-all",
                          selectedTaskDetail.priority === prio
                            ? prio === "high" 
                              ? "bg-red-500/20 text-red-500 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                              : prio === "medium" 
                              ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.2)]" 
                              : "bg-blue-500/20 text-blue-500 border-blue-500/30"
                            : "bg-background/40 border-border/20 text-muted-foreground hover:bg-secondary/20"
                        )}
                      >
                        {prio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Status Scope</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["pending", "in-progress", "review", "completed", "archived"] as const).map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setSelectedTaskDetail({ ...selectedTaskDetail, status: stat })}
                      className={cn(
                        "h-9 rounded-[8px] border text-[8px] font-bold uppercase tracking-tight font-mono transition-all flex items-center justify-center truncate px-1",
                        selectedTaskDetail.status === stat
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-background/40 border-border/20 text-muted-foreground hover:bg-secondary/20"
                      )}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Task Assignees (Toggle members)</label>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto custom-scrollbar p-1">
                  {allowedProjectUsers.map((user) => {
                    const selectedAssigneeIds = selectedTaskDetail.assignee_id ? selectedTaskDetail.assignee_id.split(",").map(s => s.trim()).filter(Boolean) : [];
                    const isSelected = selectedAssigneeIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          let updatedIds: string[];
                          if (isSelected) {
                            updatedIds = selectedAssigneeIds.filter(id => id !== user.id);
                          } else {
                            updatedIds = [...selectedAssigneeIds, user.id];
                          }
                          setSelectedTaskDetail({
                            ...selectedTaskDetail,
                            assignee_id: updatedIds.join(",")
                          });
                        }}
                        className={cn(
                          "text-left p-2 rounded-[8px] transition-all flex items-center justify-between border text-[10px] font-mono",
                          isSelected
                            ? "bg-primary/10 border-primary/30 text-primary font-bold"
                            : "bg-background/40 border-border/20 text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <img 
                            src={user.avatar_url ? resolveDriveImage(user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} 
                            className="w-4 h-4 rounded-[8px] border border-border/30 bg-secondary shrink-0" 
                            alt="Avatar" 
                          />
                          <span className="truncate">{user.display_name || user.username}</span>
                        </div>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-secondary/15 border-t border-border/30 p-5 flex justify-between items-center gap-3">
              <Button 
                variant="ghost" 
                className="rounded-[8px] bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold uppercase tracking-wider text-[9px] h-9 font-mono" 
                onClick={() => {
                  setTaskToDelete(selectedTaskDetail.id);
                  setSelectedTaskDetail(null);
                }}
              >
                Delete Task
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="rounded-[8px] font-bold uppercase tracking-wider text-[9px] h-9 font-mono" 
                  onClick={() => setSelectedTaskDetail(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="rounded-[8px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-[9px] h-9 font-mono" 
                  onClick={handleSaveTaskDetail}
                  disabled={!selectedTaskDetail.title.trim()}
                >
                  Save Changes
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* CONFIRM PROJECT DELETE WARNING DIALOG */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-background border border-destructive/50 rounded-[8px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <CardHeader className="bg-destructive/10 border-b border-border/30 p-5 flex flex-row items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
              <CardTitle className="text-base font-bold uppercase font-mono tracking-wide text-destructive">Destructive Operation</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-xs text-muted-foreground/80 leading-relaxed font-mono">
              You are about to delete this Project Pipeline from the database. Linked sub-tasks will remain in the database but will lose their project association. This action is irreversible.
            </CardContent>
            <CardFooter className="bg-secondary/15 border-t border-border/30 p-5 flex justify-end gap-3">
              <Button variant="ghost" className="rounded-[8px] font-bold uppercase tracking-wider text-[9px] h-9 font-mono" onClick={() => setProjectToDelete(null)}>
                Abort
              </Button>
              <Button className="rounded-[8px] bg-destructive hover:bg-destructive/90 text-white font-bold uppercase tracking-wider text-[9px] h-9 font-mono" onClick={handleConfirmDeleteProject}>
                Execute Delete
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* CONFIRM TASK DELETE WARNING DIALOG */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-background border border-destructive/50 rounded-[8px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <CardHeader className="bg-destructive/10 border-b border-border/30 p-5 flex flex-row items-center gap-3">
              <AlertCircle className="w-6 h-6 text-destructive shrink-0" />
              <CardTitle className="text-base font-bold uppercase font-mono tracking-wide text-destructive">Confirm Sub-Task Deletion</CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-xs text-muted-foreground/80 leading-relaxed font-mono">
              Are you sure you want to delete this sub-task from the project? This action will permanently erase the task records from the database.
            </CardContent>
            <CardFooter className="bg-secondary/15 border-t border-border/30 p-5 flex justify-end gap-3">
              <Button variant="ghost" className="rounded-[8px] font-bold uppercase tracking-wider text-[9px] h-9 font-mono" onClick={() => setTaskToDelete(null)}>
                Abort
              </Button>
              <Button className="rounded-[8px] bg-destructive hover:bg-destructive/90 text-white font-bold uppercase tracking-wider text-[9px] h-9 font-mono" onClick={handleConfirmDeleteTask}>
                Execute Delete
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

    </div>
  );
}
