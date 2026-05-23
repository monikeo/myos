import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Briefcase, ExternalLink, Trash2, Edit3, Search, X, Save, Layers, Clock, AlertCircle, AlertTriangle, CheckSquare, Square, Calendar as CalendarIcon, Loader2, Link2, Globe, FolderKanban, ShieldAlert, UserPlus, UserMinus, ShieldCheck, Building2, Terminal } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Workspace, Task, QuickLink, Project, RoleAssignment, Organization } from "@/src/types";
import { getItems, createItem, deleteItem, updateItem, uploadFile, getAllUsers, getCurrentSession } from "@/lib/api";
import { cn, resolveDriveImage } from "@/lib/utils";
import { SafeLogo } from "@/src/components/SafeLogo";


// Curated Sleek Corporate Palettes for Workspace Node Tints
const SPECTRUM_COLORS = [
  { hex: "#3b82f6", name: "Indigo Protocol" },
  { hex: "#14b8a6", name: "Neon Teal" },
  { hex: "#ec4899", name: "Rose Pink" },
  { hex: "#f59e0b", name: "Amber Gold" },
  { hex: "#10b981", name: "Cyber Green" },
  { hex: "#8b5cf6", name: "Purple Haze" },
  { hex: "#ef4444", name: "Crimson Red" }
];

const LINK_CATEGORIES = ["Work", "Dev", "Social", "Finance", "Research", "Tools", "Entertainment", "Other"];

const PRIORITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
type PriorityLevel = typeof PRIORITY_LEVELS[number];

// Add custom typing fields for extending workspace with priority in app scope
interface ExtendedWorkspace extends Workspace {
  priority?: PriorityLevel;
}

const emptyForm = {
  name: "",
  description: "",
  purpose: "",
  company: "Personal",
  color: "#3b82f6",
  priority: "Medium" as PriorityLevel,
  logo: "",
  organization_id: ""
};

export function WorkspacesView() {
  const [workspaces, setWorkspaces] = useState<ExtendedWorkspace[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, organization_id: "" });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);

  // Big workspace modal states
  const [activeWorkspace, setActiveWorkspace] = useState<ExtendedWorkspace | null>(null);
  const [modalTab, setModalTab] = useState<"tasks" | "links" | "projects" | "access">("tasks");
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploading, setUploading] = useState(false);

  // Hierarchical states
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("all");

  // Manage Access assignment state
  const [selectedUserForRole, setSelectedUserForRole] = useState<string>("");
  const [selectedRoleForUser, setSelectedRoleForUser] = useState<string>("Member");

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const res = await uploadFile(file);
      if (res && res.drive_url) {
        setForm((prev) => ({ ...prev, logo: res.drive_url }));
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Logo Uploaded",
              message: `Successfully uploaded logo "${file.name}".`,
              category: "workspace",
              link_to: "workspaces"
            }
          })
        );
      }
    } catch (err) {
      console.error("Failed to upload logo:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleBulletKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, fieldName: 'description' | 'purpose') => {
    if (e.key === "Enter") {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;

      // Find the start of the current line
      const lastNewline = value.lastIndexOf("\n", selectionStart - 1);
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const currentLine = value.substring(lineStart, selectionStart);

      // Check if current line starts with "- " (or whitespace and "- ")
      const match = currentLine.match(/^(\s*-\s)/);
      if (match) {
        e.preventDefault();
        const bulletText = match[1]; // e.g., "- "

        // If the current line is JUST "- " (empty bullet), hitting enter should erase the bullet (to exit the list)
        if (currentLine.trim() === "-") {
          const newValue = value.substring(0, lineStart) + value.substring(selectionEnd);
          setForm(prev => ({ ...prev, [fieldName]: newValue }));
          
          // Re-adjust cursor position in next tick
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
          }, 0);
          return;
        }

        // Otherwise, insert newline and pre-populate next line with "- "
        const newValue = value.substring(0, selectionStart) + "\n" + bulletText + value.substring(selectionEnd);
        setForm(prev => ({ ...prev, [fieldName]: newValue }));

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1 + bulletText.length;
        }, 0);
      }
    }
  };
  
  // Inline project form state inside workspace modal
  const [newProjName, setNewProjName] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newProjPriority, setNewProjPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [newProjColor, setNewProjColor] = useState("#3b82f6");
  
  // New task form fields inside workspace workspace modal
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState("");

  // New quick link form fields inside workspace workspace modal
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkCategory, setNewLinkCategory] = useState("Work");
  const [newLinkDesc, setNewLinkDesc] = useState("");

  // Custom warning deletes (no native confirms)
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await getItems<ExtendedWorkspace>("workspace");
      setWorkspaces(data);
      const allTasks = await getItems<Task>("task");
      setTasks(allTasks);
      const allLinks = await getItems<QuickLink>("link");
      setLinks(allLinks);
      const allProjects = await getItems<Project>("project");
      setProjects(allProjects);

      // Load hierarchical scopes & permissions
      const allOrgs = await getItems<Organization>("organization");
      setOrganizations(allOrgs);
      const allRoles = await getItems<RoleAssignment>("role_assignment");
      setRoleAssignments(allRoles);

      // Load registered users
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (err) {
      console.error("Failed to load workspaces, tasks, links, projects, and RBAC mappings:", err);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();

    const cached = localStorage.getItem("myos_active_organization_id") || "all";
    setActiveOrgId(cached);

    const handleDataChanged = () => {
      loadWorkspaces();
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
  }, [loadWorkspaces]);

  const handleSaveWorkspace = async () => {
    if (!form.name.trim()) return;

    if (editingWorkspaceId) {
      const updatedWorkspace: ExtendedWorkspace = {
        id: editingWorkspaceId,
        type: "workspace",
        name: form.name,
        description: form.description || "Workspace to organize your projects and tasks.",
        purpose: form.purpose || "",
        company: form.company || "Personal",
        color: form.color,
        priority: form.priority,
        icon: "Briefcase",
        logo: form.logo,
        organization_id: form.organization_id || undefined
      };

      try {
        await updateItem(editingWorkspaceId, updatedWorkspace);
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Workspace Updated",
              message: `Workspace "${form.name}" has been successfully updated.`,
              category: "workspace",
              link_to: "workspaces"
            }
          })
        );
        setForm({ ...emptyForm, organization_id: "" });
        setEditingWorkspaceId(null);
        setShowForm(false);
        loadWorkspaces();
      } catch (err: any) {
        console.error("Failed to update workspace:", err);
        import("@/lib/utils").then(m => m.emitError("Update Failed", err?.message || "Failed to update workspace"));
      }
    } else {
      const newWorkspace: ExtendedWorkspace = {
        id: crypto.randomUUID(),
        type: "workspace",
        name: form.name,
        description: form.description || "Workspace to organize your projects and tasks.",
        purpose: form.purpose || "",
        company: form.company || "Personal",
        color: form.color,
        priority: form.priority,
        icon: "Briefcase",
        logo: form.logo,
        organization_id: form.organization_id || undefined
      };

      try {
        await createItem(newWorkspace);

        // Automatically assign Owner role assignment for the creator in this workspace
        const session = getCurrentSession();
        if (session && session.id) {
          await createItem({
            type: "role_assignment",
            scope_type: "workspace",
            scope_id: newWorkspace.id,
            user_id: session.id,
            role: "Owner"
          });
        }

        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Workspace Created",
              message: `Workspace "${form.name}" has been successfully created.`,
              category: "workspace",
              link_to: "workspaces"
            }
          })
        );
        setForm({ ...emptyForm, organization_id: "" });
        setShowForm(false);
        loadWorkspaces();
      } catch (err: any) {
        console.error("Failed to create workspace:", err);
        import("@/lib/utils").then(m => m.emitError("Creation Failed", err?.message || "Failed to create workspace"));
      }
    }
  };

  const handleDelete = (id: string) => {
    setWorkspaceToDelete(id);
  };

  const handleConfirmDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    const wsObj = workspaces.find(w => w.id === workspaceToDelete);
    try {
      await deleteItem(workspaceToDelete);
      if (wsObj) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Workspace Deleted",
              message: `Workspace "${wsObj.name}" has been permanently deleted.`,
              category: "workspace",
              link_to: "workspaces"
            }
          })
        );
      }
      if (activeWorkspace?.id === workspaceToDelete) {
        setActiveWorkspace(null);
      }
      setWorkspaceToDelete(null);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to delete workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Deletion Failed", err?.message || "Failed to delete workspace"));
    }
  };

  const handleCreateWorkspaceTask = async () => {
    if (!activeWorkspace || !newTitle.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      type: "task",
      title: newTitle,
      description: newDesc || "No description provided.",
      status: "pending",
      priority: newPriority,
      due_date: newDueDate || new Date().toISOString().split("T")[0],
      workspace_id: activeWorkspace.id,
      tags: []
    };

    try {
      await createItem(newTask);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      setNewDueDate("");
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to create task inside workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Task Creation Failed", err?.message || "Failed to create task"));
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const updated: Task = {
      ...task,
      status: task.status === "completed" ? "pending" : "completed",
      updated_at: new Date().toISOString()
    };

    try {
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      await updateItem(task.id, updated);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to toggle task status:", err);
      import("@/lib/utils").then(m => m.emitError("Update Failed", err?.message || "Failed to update task status"));
      loadWorkspaces();
    }
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      setTasks(prev => prev.filter(t => t.id !== taskToDelete));
      await deleteItem(taskToDelete);
      setTaskToDelete(null);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      import("@/lib/utils").then(m => m.emitError("Deletion Failed", err?.message || "Failed to delete task"));
      loadWorkspaces();
    }
  };

  function getFavicon(url: string) {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch { return ""; }
  }

  const handleCreateWorkspaceLink = async () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !activeWorkspace) return;
    const fullUrl = newLinkUrl.startsWith("http") ? newLinkUrl : `https://${newLinkUrl}`;
    
    const newLink: QuickLink = {
      id: crypto.randomUUID(),
      type: "link",
      title: newLinkTitle,
      url: fullUrl,
      category: newLinkCategory,
      description: newLinkDesc || "No description provided.",
      workspace_id: activeWorkspace.id,
      favicon: getFavicon(fullUrl) || ""
    };

    try {
      await createItem(newLink);
      setNewLinkTitle("");
      setNewLinkUrl("");
      setNewLinkCategory("Work");
      setNewLinkDesc("");
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to create quick link inside workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Link Creation Failed", err?.message || "Failed to create quick link"));
    }
  };

  const handleDeleteWorkspaceLink = async (linkId: string) => {
    try {
      setLinks(prev => prev.filter(l => l.id !== linkId));
      await deleteItem(linkId);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to delete quick link inside workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Link Deletion Failed", err?.message || "Failed to delete quick link"));
      loadWorkspaces();
    }
  };

  const handleCreateWorkspaceProject = async () => {
    if (!activeWorkspace || !newProjName.trim()) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      type: "project",
      name: newProjName,
      description: newProjDesc || "Project workspace.",
      status: "active",
      priority: newProjPriority,
      workspace_id: activeWorkspace.id,
      color: newProjColor,
      category: "Development"
    };

    try {
      await createItem(newProject);
      setNewProjName("");
      setNewProjDesc("");
      setNewProjPriority("medium");
      setNewProjColor("#3b82f6");
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to create project inside workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Project Creation Failed", err?.message || "Failed to create project"));
    }
  };

  const handleDeleteWorkspaceProject = async (projId: string) => {
    try {
      setProjects(prev => prev.filter(p => p.id !== projId));
      await deleteItem(projId);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to delete project inside workspace:", err);
      import("@/lib/utils").then(m => m.emitError("Project Deletion Failed", err?.message || "Failed to delete project"));
      loadWorkspaces();
    }
  };

  const handleAssignWorkspaceRole = async () => {
    if (!selectedUserForRole || !selectedRoleForUser || !activeWorkspace) return;
    try {
      await createItem({
        type: "role_assignment",
        scope_type: "workspace",
        scope_id: activeWorkspace.id,
        user_id: selectedUserForRole,
        role: selectedRoleForUser
      });
      setSelectedUserForRole("");
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to assign workspace role:", err);
      import("@/lib/utils").then(m => m.emitError("Role Assignment Failed", err?.message || "Failed to assign workspace role"));
    }
  };

  const handleRevokeWorkspaceRole = async (assignmentId: string) => {
    try {
      await deleteItem(assignmentId);
      loadWorkspaces();
    } catch (err: any) {
      console.error("Failed to revoke workspace role:", err);
      import("@/lib/utils").then(m => m.emitError("Role Revocation Failed", err?.message || "Failed to revoke workspace role"));
    }
  };

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


  const companies = ["All", ...Array.from(new Set(workspaces.map(w => w.company || "Unassigned")))];

  const filteredWorkspaces = useMemo(() => {
    const priorityWeights: Record<string, number> = {
      "Critical": 4,
      "High": 3,
      "Medium": 2,
      "Low": 1
    };

    return workspaces
      .filter(w => {
        const wCompany = w.company || "Unassigned";
        const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCompany = filterCompany === "All" || wCompany === filterCompany;

        // Active Org Filtration
        let matchesOrg = true;
        if (activeOrgId === "standalone") {
          matchesOrg = !w.organization_id;
        } else if (activeOrgId !== "all") {
          matchesOrg = w.organization_id === activeOrgId;
        }

        return matchesSearch && matchesCompany && matchesOrg;
      })
      .sort((a, b) => {
        const weightA = priorityWeights[a.priority || "Medium"] || 2;
        const weightB = priorityWeights[b.priority || "Medium"] || 2;
        return weightB - weightA;
      });
  }, [workspaces, searchQuery, filterCompany, activeOrgId]);

  const renderWorkspaceCard = (ws: ExtendedWorkspace) => {
    return (
      <Card 
        key={ws.id} 
        onMouseEnter={() => setHoveredId(ws.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          borderLeft: `4px solid ${ws.color || "#3b82f6"}`,
          boxShadow: hoveredId === ws.id ? `0 0 25px ${(ws.color || "#3b82f6")}33` : undefined
        }}
        className="overflow-hidden border border-border/50 shadow-2xl glass-panel group hover:border-primary/50 transition-all duration-500 rounded-[5px] flex flex-col justify-between"
      >
        {/* Highlight Palette Top Line Bar */}
        <div 
          className="h-1.5 w-full opacity-40 group-hover:opacity-100 transition-opacity shrink-0" 
          style={{ backgroundColor: ws.color }} 
        />
        
        <CardHeader className="p-5 pb-3 relative shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shadow-xl group-hover:border-primary transition-colors duration-500 overflow-hidden shrink-0">
              <SafeLogo
                src={ws.logo ? resolveDriveImage(ws.logo) : undefined}
                alt={ws.name}
                className="w-full h-full object-cover"
                fallbackIcon={<Briefcase className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />}
              />
            </div>
            <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity duration-300">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-secondary rounded-[5px]"
                onClick={() => {
                  setForm({
                    name: ws.name,
                    company: ws.company || "Personal",
                    description: ws.description || "",
                    purpose: ws.purpose || "",
                    color: ws.color || "#3b82f6",
                    priority: ws.priority || "Medium",
                    logo: ws.logo || "",
                    organization_id: ws.organization_id || ""
                  });
                  setEditingWorkspaceId(ws.id);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-red-500 hover:bg-red-500/10 rounded-[5px]"
                onClick={() => handleDelete(ws.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          <CardTitle className="text-lg font-bold tracking-tight uppercase group-hover:text-primary transition-colors leading-snug line-clamp-1">{ws.name}</CardTitle>
          <CardDescription className="text-muted-foreground font-medium mt-1 leading-relaxed opacity-80 text-xs line-clamp-2 min-h-[2rem] whitespace-pre-wrap">{ws.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="p-5 pt-1 space-y-4 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline" className="font-mono text-[8px] uppercase font-bold tracking-[0.2em] px-2 py-0.5 border-border/50 bg-background/50 text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
              {ws.company}
            </Badge>

            {/* Dynamic Glowing Priority Badges */}
            {ws.priority && (
              <Badge 
                className={cn(
                  "text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-[5px] border shrink-0",
                  ws.priority === "Critical" 
                    ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                    : ws.priority === "High"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : ws.priority === "Medium"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : "bg-secondary/40 text-muted-foreground border-border/20"
                )}
                variant="secondary"
              >
                {ws.priority}
              </Badge>
            )}

            {ws.organization_id && (
              <Badge variant="outline" className="text-[8px] font-mono tracking-widest px-2 py-0.5 font-bold uppercase text-primary border-primary/20 bg-primary/5 shrink-0 animate-pulse">
                {organizations.find(o => o.id === ws.organization_id)?.name || "Org Workspace"}
              </Badge>
            )}

            <div className="flex items-center gap-1 ml-auto shrink-0">
               <div className="w-1 h-1 rounded-[5px]-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
               <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest font-mono">ACTIVE</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background/40 border border-border/20 p-3 rounded-[5px] text-center shadow-inner group-hover:border-primary/20 transition-all">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/40 mb-1 tracking-[0.25em] font-mono">Tasks</p>
              <p className="text-lg font-bold font-mono">
                {tasks.filter(t => t.workspace_id === ws.id && t.status !== "completed").length} Active
              </p>
            </div>
            <div className="bg-background/40 border border-border/20 p-3 rounded-[5px] text-center shadow-inner group-hover:border-primary/20 transition-all">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/40 mb-1 tracking-[0.25em] font-mono">Completed</p>
              <p className="text-lg font-bold font-mono">
                {tasks.filter(t => t.workspace_id === ws.id && t.status === "completed").length} Done
              </p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="bg-background/30 border-t border-border/20 p-3 shrink-0">
          <Button 
            onClick={() => setActiveWorkspace(ws)}
            variant="ghost" 
            className="w-full h-11 rounded-[5px] text-[9px] font-bold uppercase tracking-[0.25em] hover:bg-primary hover:text-white transition-all group/btn shadow-inner"
          >
            <Layers className="w-3.5 h-3.5 mr-3 text-primary group-hover/btn:text-white" />
            Open Workspace
            <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-20 group-hover/btn:opacity-100 transition-opacity" />
          </Button>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Workspaces</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Create and manage workspaces to organize your work.</p>
        </div>
        <Button 
          onClick={() => { setForm(emptyForm); setEditingWorkspaceId(null); setShowForm(true); }} 
          className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 h-11 px-5 font-bold text-xs uppercase tracking-[0.2em]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Deployment Form Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-background border border-border/60 rounded-[5px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
            {/* Top Palette Indicator Accent Line */}
            <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: form.color || "#3b82f6" }} />
            
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold uppercase tracking-widest text-xs text-primary">
                {editingWorkspaceId ? "Edit Workspace Node" : "Create Workspace Node"}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] border border-border/20 hover:bg-secondary" onClick={() => { setShowForm(false); setForm(emptyForm); setEditingWorkspaceId(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Workspace Name</label>
                <Input 
                  placeholder="Workspace Name" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                  className="bg-background/50 border-border/30 rounded-[5px] h-11" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Workspace Group / Company</label>
                <Input 
                  placeholder="e.g. Personal, Work, Client" 
                  value={form.company} 
                  onChange={(e) => setForm({ ...form, company: e.target.value })} 
                  className="bg-background/50 border-border/30 rounded-[5px] h-11" 
                />
              </div>
            </div>

            {/* Priority & Org Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}
                  className="h-11 px-4 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {PRIORITY_LEVELS.map((level) => (
                    <option key={level} value={level}>{level} Priority</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1.5">Parent Organization</label>
                <select
                  value={form.organization_id}
                  onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                  className="h-11 px-4 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">None (Standalone)</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Purpose input (full-width textarea) */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Workspace Purpose</label>
              <textarea
                placeholder="What is the primary purpose of this workspace? (e.g., Host company Taekwondo analytics, secure database sandboxes...)"
                value={form.purpose || ""}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                onKeyDown={(e) => handleBulletKeyDown(e, 'purpose')}
                className="w-full min-h-[60px] p-3 text-xs bg-background/50 border border-border/30 hover:border-border/50 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/30 text-foreground"
              />
            </div>

            {/* Description input (full-width textarea) */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Workspace Description</label>
              <textarea
                placeholder="Write detailed descriptions or bullet lists. Start a line with '- ' and hitting Enter will automatically pre-populate the next bullet point."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onKeyDown={(e) => handleBulletKeyDown(e, 'description')}
                className="w-full min-h-[120px] p-3 text-xs bg-background/50 border border-border/30 hover:border-border/50 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/30 text-foreground"
              />
            </div>

            {/* Curated Color Spectrum Grid & Custom Color Picker */}
            <div className="space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 font-mono">Workspace Color</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-secondary/20 p-4 border border-border/20">
                
                {/* Preset buttons */}
                <div className="flex flex-wrap gap-2.5">
                  {SPECTRUM_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setForm({ ...form, color: c.hex })}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      className={cn(
                        "w-7 h-7 rounded-[5px] transition-all duration-300 transform active:scale-95 border",
                        form.color.toLowerCase() === c.hex.toLowerCase()
                          ? "ring-2 ring-primary border-background scale-110 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                          : "border-transparent opacity-65 hover:opacity-100 hover:scale-105"
                      )}
                    />
                  ))}
                </div>

                {/* Custom Picker Separator */}
                <div className="hidden sm:block w-px h-6 bg-border/40" />

                {/* Custom Picker Group */}
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-[5px] border border-border/40 flex items-center justify-center bg-background shrink-0 cursor-pointer overflow-hidden group/picker">
                    {/* Real hidden color input click element */}
                    <input
                      type="color"
                      value={form.color.startsWith("#") && form.color.length === 7 ? form.color : "#3b82f6"}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    {/* Visual preview */}
                    <div 
                      className="w-full h-full transition-all duration-300"
                      style={{ backgroundColor: form.color }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono text-muted-foreground/60">HEX:</span>
                    <Input
                      placeholder="#3B82F6"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-24 h-8 bg-background/70 border-border/30 rounded-[5px] text-[11px] font-bold font-mono text-foreground uppercase px-2"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Branding identity / logo section */}
            <div className="space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 font-mono">Workspace Logo / Branding</p>
              <div className="bg-secondary/20 p-4 border border-border/20 flex flex-col md:flex-row gap-4 items-start md:items-center">
                {/* Logo Preview */}
                <div className="w-16 h-16 bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden relative group/logo-preview shadow-xl">
                  {form.logo ? (
                    <>
                      <SafeLogo 
                        src={resolveDriveImage(form.logo)} 
                        alt="Logo preview" 
                        className="w-full h-full object-cover"
                        fallbackIcon={<Briefcase className="w-6 h-6 text-muted-foreground/50" />}
                      />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, logo: "" }))}
                        className="absolute inset-0 bg-black/60 md:opacity-0 md:group-hover/logo-preview:opacity-100 opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </>
                  ) : (
                    <Briefcase className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>

                {/* Upload & Paste Controls */}
                <div className="flex-1 w-full space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* File Upload Input Button */}
                    <div className="relative shrink-0">
                      <input
                        type="file"
                        id="workspace-logo-upload"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploading}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        className="w-full sm:w-auto rounded-[5px] border-border/30 h-10 text-[10px] uppercase font-bold tracking-widest font-mono"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin text-primary" />
                            Uploading...
                          </>
                        ) : (
                          "Upload Image"
                        )}
                      </Button>
                    </div>

                    {/* Logo URL Paste Input */}
                    <div className="flex-1 relative">
                      <Link2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                      <Input
                        placeholder="Paste Logo Image URL..."
                        value={form.logo}
                        onChange={(e) => setForm(prev => ({ ...prev, logo: e.target.value }))}
                        className="pl-9 bg-background/50 border-border/30 rounded-[5px] h-10 text-xs placeholder:text-muted-foreground/40 font-medium"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 leading-normal font-mono">
                    Upload an image from your device or paste a web URL. A default icon is used if no logo is supplied.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
              <Button 
                variant="outline" 
                onClick={() => { setShowForm(false); setForm(emptyForm); setEditingWorkspaceId(null); }} 
                className="rounded-[5px] border-border/50 px-8 h-11 font-bold uppercase tracking-widest text-[10px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveWorkspace} 
                disabled={!form.name.trim()} 
                className="rounded-[5px] bg-primary px-8 h-11 font-bold uppercase tracking-widest text-[10px] shadow-[0_0_20px_rgba(59,130,246,0.2)]"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingWorkspaceId ? "Update Workspace" : "Save Workspace"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Filter and Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex flex-1 w-full gap-3 sm:max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search workspaces..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-12 bg-secondary/30 border-border/50 rounded-[5px]"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex p-1.5 bg-secondary/30 rounded-[5px] border border-border/50 min-w-max">
            {companies.map(c => (
              <Button
                key={c}
                variant={filterCompany === c ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterCompany(c)}
                className={cn(
                  "rounded-[5px] font-bold text-[10px] uppercase tracking-widest px-5 h-10",
                  filterCompany === c ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
                )}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkspaces.length === 0 ? (
          <Card className="col-span-full p-12 text-center border border-border/20 glass-panel rounded-[5px] shadow-2xl">
            <div className="w-16 h-16 rounded-[5px] bg-secondary/30 flex items-center justify-center mx-auto mb-6 border border-border/10 shadow-inner">
               <Briefcase className="w-8 h-8 text-primary opacity-20" />
            </div>
            <h3 className="text-xl font-bold uppercase tracking-widest mb-3">No Workspaces Found</h3>
            <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-6 font-medium leading-relaxed">Adjust your search filters or create a brand new workspace.</p>
            <Button onClick={() => setShowForm(true)} className="rounded-[5px] font-bold uppercase tracking-widest text-[9px] bg-primary h-11 px-8">Create Your First Workspace</Button>
          </Card>
        ) : activeOrgId === "all" ? (
          <>
            {organizations.map(org => {
              const orgWorkspaces = filteredWorkspaces.filter(w => w.organization_id === org.id);
              if (orgWorkspaces.length === 0) return null;
              return (
                <div key={org.id} className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="col-span-full flex items-center gap-3 border-b border-border/30 pb-2 mt-4">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-primary font-mono">{org.name}</h2>
                    <span className="text-[10px] text-muted-foreground font-mono">({orgWorkspaces.length} workspaces)</span>
                    <div className="flex-1 h-px bg-border/20 ml-2" />
                  </div>
                  {orgWorkspaces.map(ws => renderWorkspaceCard(ws))}
                </div>
              );
            })}
            
            {/* Standalone Workspaces */}
            {(() => {
              const standaloneWorkspaces = filteredWorkspaces.filter(w => !w.organization_id);
              if (standaloneWorkspaces.length === 0) return null;
              return (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="col-span-full flex items-center gap-3 border-b border-border/30 pb-2 mt-6">
                    <Terminal className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground font-mono">Standalone Workspaces</h2>
                    <span className="text-[10px] text-muted-foreground font-mono">({standaloneWorkspaces.length} workspaces)</span>
                    <div className="flex-1 h-px bg-border/20 ml-2" />
                  </div>
                  {standaloneWorkspaces.map(ws => renderWorkspaceCard(ws))}
                </div>
              );
            })()}
          </>
        ) : (
          filteredWorkspaces.map(ws => renderWorkspaceCard(ws))
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. MASSIVE WORKSPACE MODAL OVERLAY */}
      {/* ============================================================ */}
      {activeWorkspace && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-300">
          <div className="bg-background border border-border/60 rounded-[5px] w-full max-w-7xl h-[90vh] max-h-[90vh] lg:h-[85vh] overflow-y-auto lg:overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
            
            {/* Top Palette Indicator Accent Line */}
            <div className="h-2 w-full shrink-0" style={{ backgroundColor: activeWorkspace.color || "#3b82f6" }} />

            {/* Header section inside massive modal */}
            <div className="p-4 sm:p-6 md:p-8 border-b border-border/20 flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-4 shrink-0 bg-secondary/10">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shadow-xl overflow-hidden shrink-0">
                  <SafeLogo
                    src={activeWorkspace.logo ? resolveDriveImage(activeWorkspace.logo) : undefined}
                    alt={activeWorkspace.name}
                    className="w-full h-full object-cover"
                    fallbackIcon={<Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />}
                  />
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[8px] sm:text-[9px] font-mono tracking-widest px-2 py-0.5 border-border/50 bg-background/50 text-muted-foreground uppercase font-bold">
                      {activeWorkspace.company || "Personal"}
                    </Badge>
                    <Badge 
                      style={{ borderColor: `${activeWorkspace.color || "#3b82f6"}33`, color: activeWorkspace.color || "#3b82f6", backgroundColor: `${activeWorkspace.color || "#3b82f6"}11` }}
                      variant="outline" 
                      className="text-[8px] sm:text-[9px] font-mono tracking-widest px-2 py-0.5 font-bold uppercase"
                    >
                      Active Node
                    </Badge>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-extrabold tracking-tighter uppercase truncate">{activeWorkspace.name}</h2>
                  <p className="text-[11px] sm:text-xs text-muted-foreground font-medium max-w-xl leading-relaxed whitespace-pre-wrap">{activeWorkspace.description}</p>
                  {activeWorkspace.purpose && (
                    <div className="mt-3 text-[10px] sm:text-[11px] text-primary font-mono uppercase tracking-wider flex items-center gap-2 bg-primary/5 px-3 py-1.5 border border-primary/20 w-fit rounded-[5px] shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="font-bold text-muted-foreground">Purpose:</span> {activeWorkspace.purpose}
                    </div>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={() => {
                  setActiveWorkspace(null);
                  loadWorkspaces();
                }}
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-[5px] border border-border/20 hover:bg-secondary shrink-0 self-end sm:self-auto"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Double column grid inside workspace console */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 bg-secondary/5">
              
              {/* Left Column: Metrics & Information summary */}
              <div className="lg:col-span-4 flex flex-col gap-6 lg:overflow-y-auto pr-2 lg:shrink-0 lg:max-h-full">
                <div className="border border-border/20 bg-background/50 p-6 space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary border-b border-border/10 pb-2 font-mono">Workspace Details</h3>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between py-1.5 border-b border-dashed border-border/10">
                      <span className="text-muted-foreground">priority:</span>
                      <span className="font-bold text-foreground uppercase">{activeWorkspace.priority || "Medium"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-border/10">
                      <span className="text-muted-foreground">color tag:</span>
                      <span className="font-bold uppercase" style={{ color: activeWorkspace.color || "#3b82f6" }}>
                        {activeWorkspace.color || "#3B82F6"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-dashed border-border/10">
                      <span className="text-muted-foreground">group:</span>
                      <span className="font-bold text-foreground">{activeWorkspace.company}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">registered:</span>
                      <span className="font-bold text-foreground">Active Node</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Inline form to create tasks, links, or projects within this workspace */}
                {modalTab === "tasks" ? (
                  <div className="border border-primary/20 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
                      <Plus className="w-4 h-4" />
                      <span>Create Workspace Task</span>
                    </div>
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="Task Title"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        className="bg-background/70 border-border/30 rounded-[5px] h-10 text-xs placeholder:text-muted-foreground/30 font-medium focus-visible:ring-primary"
                      />
                      
                      <textarea
                        placeholder="Task Description..."
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        className="w-full min-h-[60px] p-2.5 text-xs bg-background/70 border border-border/30 hover:border-border/50 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/30 text-foreground"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newPriority}
                          onChange={e => setNewPriority(e.target.value as any)}
                          className="h-10 px-2 rounded-[5px] bg-background/70 border border-border/30 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground font-mono"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                        
                        <Input
                          type="date"
                          value={newDueDate}
                          onChange={e => setNewDueDate(e.target.value)}
                          className="bg-background/70 border-border/30 rounded-[5px] h-10 text-[10px] font-bold font-mono focus-visible:ring-primary"
                        />
                      </div>

                      <Button
                        onClick={handleCreateWorkspaceTask}
                        disabled={!newTitle.trim()}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-sm"
                      >
                        Deploy Task
                      </Button>
                    </div>
                  </div>
                ) : modalTab === "links" ? (
                  <div className="border border-primary/20 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
                      <Plus className="w-4 h-4" />
                      <span>Create Workspace Link</span>
                    </div>
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="Link Title (e.g. Google Docs)"
                        value={newLinkTitle}
                        onChange={e => setNewLinkTitle(e.target.value)}
                        className="bg-background/70 border-border/30 rounded-[5px] h-10 text-xs placeholder:text-muted-foreground/30 font-medium focus-visible:ring-primary"
                      />

                      <Input
                        placeholder="Link URL (e.g. docs.google.com)"
                        value={newLinkUrl}
                        onChange={e => setNewLinkUrl(e.target.value)}
                        className="bg-background/70 border-border/30 rounded-[5px] h-10 text-xs placeholder:text-muted-foreground/30 font-medium focus-visible:ring-primary"
                      />
                      
                      <textarea
                        placeholder="Link Description (optional)..."
                        value={newLinkDesc}
                        onChange={e => setNewLinkDesc(e.target.value)}
                        className="w-full min-h-[50px] p-2.5 text-xs bg-background/70 border border-border/30 hover:border-border/50 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/30 text-foreground"
                      />

                      <select
                        value={newLinkCategory}
                        onChange={e => setNewLinkCategory(e.target.value)}
                        className="w-full h-10 px-2 rounded-[5px] bg-background/70 border border-border/30 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground font-mono"
                      >
                        {LINK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <Button
                        onClick={handleCreateWorkspaceLink}
                        disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-sm"
                      >
                        Deploy Quick Link
                      </Button>
                    </div>
                  </div>
                ) : modalTab === "projects" ? (
                  <div className="border border-primary/20 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
                      <Plus className="w-4 h-4" />
                      <span>Create Workspace Project</span>
                    </div>
                    
                    <div className="space-y-3">
                      <Input
                        placeholder="Project Name"
                        value={newProjName}
                        onChange={e => setNewProjName(e.target.value)}
                        className="bg-background/70 border-border/30 rounded-[5px] h-10 text-xs placeholder:text-muted-foreground/30 font-medium focus-visible:ring-primary"
                      />
                      
                      <textarea
                        placeholder="Project Description..."
                        value={newProjDesc}
                        onChange={e => setNewProjDesc(e.target.value)}
                        className="w-full min-h-[60px] p-2.5 text-xs bg-background/70 border border-border/30 hover:border-border/50 focus:border-primary focus:outline-none transition-colors rounded-[5px] placeholder:text-muted-foreground/30 text-foreground"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newProjPriority}
                          onChange={e => setNewProjPriority(e.target.value as any)}
                          className="h-10 px-2 rounded-[5px] bg-background/70 border border-border/30 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground font-mono"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                          <option value="critical">Critical Priority</option>
                        </select>
                        
                        <div className="flex items-center gap-2 bg-background/70 border border-border/30 px-2 h-10 rounded-[5px]">
                          <input
                            type="color"
                            value={newProjColor}
                            onChange={e => setNewProjColor(e.target.value)}
                            className="w-6 h-6 border-0 cursor-pointer"
                          />
                          <span className="text-[9px] font-bold text-muted-foreground/80 font-mono">COLOR</span>
                        </div>
                      </div>

                      <Button
                        onClick={handleCreateWorkspaceProject}
                        disabled={!newProjName.trim()}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-sm"
                      >
                        Deploy Project Node
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Access Tab Left Form
                  <div className="border border-primary/20 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
                      <UserPlus className="w-4 h-4" />
                      <span>Assign User Role</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Select User</label>
                        <select
                          value={selectedUserForRole}
                          onChange={e => setSelectedUserForRole(e.target.value)}
                          className="w-full h-10 px-2 rounded-[5px] bg-background/70 border border-border/30 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground"
                        >
                          <option value="">-- Choose User --</option>
                          {allUsers.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.display_name || user.username} (@{user.username})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Role Scope</label>
                        <select
                          value={selectedRoleForUser}
                          onChange={e => setSelectedRoleForUser(e.target.value)}
                          className="w-full h-10 px-2 rounded-[5px] bg-background/70 border border-border/30 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground font-mono"
                        >
                          <option value="Owner">Owner</option>
                          <option value="Admin">Admin</option>
                          <option value="Editor">Editor</option>
                          <option value="Member">Member</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      </div>

                      <Button
                        onClick={handleAssignWorkspaceRole}
                        disabled={!selectedUserForRole}
                        className="w-full rounded-[5px] bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[9px] h-10 shadow-sm"
                      >
                        Grant Workspace Access
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Dynamic Workspace Task List / Workspace Links List / Workspace Projects List */}
              <div className="lg:col-span-8 flex flex-col gap-4 lg:overflow-hidden min-h-[400px] lg:min-h-0">
                <div className="flex flex-col sm:flex-row border-b border-border/10 pb-3 justify-between items-start sm:items-center gap-3 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={modalTab === "tasks" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setModalTab("tasks")}
                      className={cn(
                        "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        modalTab === "tasks" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <CheckSquare className="w-3.5 h-3.5 mr-2" />
                      Trackers ({tasks.filter(t => t.workspace_id === activeWorkspace.id).length})
                    </Button>
                    <Button
                      variant={modalTab === "links" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setModalTab("links")}
                      className={cn(
                        "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        modalTab === "links" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <Link2 className="w-3.5 h-3.5 mr-2" />
                      Quick Links ({links.filter(l => l.workspace_id === activeWorkspace.id).length})
                    </Button>
                    <Button
                      variant={modalTab === "projects" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setModalTab("projects")}
                      className={cn(
                        "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        modalTab === "projects" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <FolderKanban className="w-3.5 h-3.5 mr-2" />
                      Projects ({projects.filter(p => p.workspace_id === activeWorkspace.id).length})
                    </Button>
                    <Button
                      variant={modalTab === "access" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setModalTab("access")}
                      className={cn(
                        "rounded-[5px] text-[9px] uppercase font-bold tracking-widest px-3 h-8 font-mono border border-border/20",
                        modalTab === "access" ? "bg-primary text-white border-primary" : "text-muted-foreground hover:bg-secondary/40"
                      )}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                      Access Control ({roleAssignments.filter(ra => ra.scope_type === "workspace" && ra.scope_id === activeWorkspace.id).length})
                    </Button>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[8px] bg-secondary border border-border/20 px-3 py-1 shrink-0 uppercase tracking-widest self-end sm:self-auto">
                    {modalTab === "tasks" ? "Task Queue" : modalTab === "links" ? "Link Node Cluster" : modalTab === "projects" ? "Project Node Cluster" : "Access Governance"}
                  </Badge>

                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                  {modalTab === "tasks" ? (
                    tasks.filter(t => t.workspace_id === activeWorkspace.id).length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/20">
                        <Clock className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <h4 className="text-sm font-bold uppercase tracking-wide">No Linked Workspace Tasks</h4>
                        <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">Use the left input form to deploy a tracking node under this workspace.</p>
                      </div>
                    ) : (
                      tasks.filter(t => t.workspace_id === activeWorkspace.id).map(task => {
                        const isCompleted = task.status === "completed";
                        return (
                          <div 
                            key={task.id} 
                            className={cn(
                              "p-4 border bg-background/40 hover:bg-background/80 transition-all rounded-[5px] flex items-center justify-between gap-4 group/item",
                              isCompleted ? "border-border/30 opacity-60" : "border-border/50"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                onClick={() => handleToggleTaskStatus(task)}
                                className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                              >
                                {isCompleted ? (
                                  <CheckSquare className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                                ) : (
                                  <Square className="w-5 h-5 text-muted-foreground/50" />
                                )}
                              </button>
                              
                              <div className="min-w-0">
                                <h4 className={cn("text-xs font-bold uppercase tracking-tight truncate", isCompleted && "line-through text-muted-foreground")}>
                                  {task.title}
                                </h4>
                                <p className="text-[10px] text-muted-foreground truncate max-w-sm mt-0.5">{task.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[8px] font-bold font-mono text-muted-foreground/60 flex items-center gap-1">
                                <CalendarIcon className="w-2.5 h-2.5 text-primary" />
                                {task.due_date}
                              </span>

                              <Badge 
                                className={cn(
                                  "text-[7px] uppercase font-bold tracking-widest px-1.5 py-0 rounded-[5px] font-mono",
                                  task.priority === "high" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                  task.priority === "medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  "bg-primary/10 text-primary border-primary/20"
                                )}
                                variant="outline"
                              >
                                {task.priority}
                              </Badge>

                              <Button
                                onClick={() => setTaskToDelete(task.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/item:opacity-100 opacity-100 transition-all rounded-[5px]"
                                title="Delete tracker"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : modalTab === "links" ? (
                    links.filter(l => l.workspace_id === activeWorkspace.id).length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/20">
                        <Link2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <h4 className="text-sm font-bold uppercase tracking-wide">No Linked Workspace Links</h4>
                        <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">Use the left input form to deploy a quick link node under this workspace.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {links.filter(l => l.workspace_id === activeWorkspace.id).map(link => {
                          const favicon = link.favicon || getFavicon(link.url);
                          return (
                            <div 
                              key={link.id} 
                              className="p-3 border border-border/40 bg-background/30 hover:bg-background/70 transition-all rounded-[5px] flex items-center justify-between gap-3 group/linkitem"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shrink-0 overflow-hidden">
                                  {favicon ? <img src={favicon} alt="" className="w-4 h-4 object-contain" /> : <Globe className="w-3.5 h-3.5 text-muted-foreground/40" />}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-[11px] font-bold uppercase tracking-tight truncate group-hover/linkitem:text-primary transition-colors">
                                    {link.title}
                                  </h4>
                                  <p className="text-[8.5px] text-muted-foreground truncate font-mono mt-0.5">{link.url}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[5px] text-primary hover:bg-primary/10">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </a>
                                <Button
                                  onClick={() => handleDeleteWorkspaceLink(link.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/linkitem:opacity-100 opacity-100 transition-all rounded-[5px]"
                                  title="Delete Link"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : modalTab === "projects" ? (
                    projects.filter(p => p.workspace_id === activeWorkspace.id).length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/20">
                        <FolderKanban className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <h4 className="text-sm font-bold uppercase tracking-wide">No Linked Workspace Projects</h4>
                        <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">Use the left input form to deploy a project node under this workspace.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {projects.filter(p => p.workspace_id === activeWorkspace.id).map(proj => {
                          const statsObj = getProjectStats(proj.id);
                          return (
                            <div 
                              key={proj.id} 
                              className="p-4 border border-border/40 bg-background/30 hover:bg-background/70 transition-all rounded-[5px] flex flex-col justify-between gap-3 group/projitem"
                              style={{ borderLeft: `3px solid ${proj.color || "#3b82f6"}` }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold uppercase tracking-tight truncate group-hover/projitem:text-primary transition-colors">
                                    {proj.name}
                                  </h4>
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{proj.description}</p>
                                </div>
                                <Badge variant="outline" className={cn(
                                  "text-[7px] uppercase font-bold tracking-widest px-1.5 py-0 rounded-[5px] font-mono shrink-0",
                                  proj.priority === "critical" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                  proj.priority === "high" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  "bg-primary/10 text-primary border-primary/20"
                                )}>
                                  {proj.priority}
                                </Badge>
                              </div>

                              {/* Progress bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[8px] font-mono tracking-wider text-muted-foreground/60">
                                  <span>PROGRESS</span>
                                  <span className="text-foreground">{statsObj.percent}% ({statsObj.completed}/{statsObj.total})</span>
                                </div>
                                <div className="w-full bg-secondary/50 h-1.5 rounded-[5px] overflow-hidden border border-border/10">
                                  <div className="h-full transition-all" style={{ width: `${statsObj.percent}%`, backgroundColor: proj.color || "#3b82f6" }} />
                                </div>
                              </div>

                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[7.5px] font-mono font-bold text-muted-foreground/60 uppercase">
                                  {proj.status}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    onClick={() => {
                                      localStorage.setItem("myos_auto_open_project", proj.id);
                                      window.history.pushState({}, "", "/projects");
                                      window.dispatchEvent(new PopStateEvent("popstate"));
                                    }}
                                    variant="outline" 
                                    size="sm" 
                                    className="h-6 rounded-[5px] text-[8px] font-mono font-bold uppercase tracking-wider px-2"
                                  >
                                    Workspace
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteWorkspaceProject(proj.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/projitem:opacity-100 opacity-100 transition-all rounded-[5px]"
                                    title="Delete Project"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    // Access Tab Right List
                    roleAssignments.filter(ra => ra.scope_type === "workspace" && ra.scope_id === activeWorkspace.id).length === 0 ? (
                      <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-border/20 bg-background/20">
                        <ShieldCheck className="w-8 h-8 text-muted-foreground/30 mb-3" />
                        <h4 className="text-sm font-bold uppercase tracking-wide">No Workspace Access Roles Defined</h4>
                        <p className="text-[11px] text-muted-foreground/60 max-w-xs mt-1">Use the left input form to assign users to specific roles inside this workspace.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {roleAssignments.filter(ra => ra.scope_type === "workspace" && ra.scope_id === activeWorkspace.id).map(ra => {
                          const u = allUsers.find(user => user.id === ra.user_id);
                          return (
                            <div 
                              key={ra.id} 
                              className="p-4 border border-border/40 bg-background/30 hover:bg-background/70 transition-all rounded-[5px] flex items-center justify-between gap-4 group/accessitem"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex items-center justify-center font-bold text-xs uppercase text-primary shrink-0">
                                  {u?.display_name ? u.display_name.slice(0, 2) : u?.username ? u.username.slice(0, 2) : "??"}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold uppercase tracking-tight truncate">
                                    {u?.display_name || u?.username || "Unknown User"}
                                  </h4>
                                  <p className="text-[9px] text-muted-foreground truncate font-mono mt-0.5">@{u?.username || "unknown"}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-[5px] font-mono border",
                                      ra.role === "Owner" ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" :
                                      ra.role === "Admin" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                      ra.role === "Editor" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                      ra.role === "Member" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                      "bg-secondary/40 text-muted-foreground border-border/20"
                                    )}
                                  >
                                  {ra.role}
                                </Badge>
                                <Button
                                  onClick={() => handleRevokeWorkspaceRole(ra.id!)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 md:opacity-0 md:group-hover/accessitem:opacity-100 opacity-100 transition-all rounded-[5px]"
                                  title="Revoke access"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="p-6 border-t border-border/20 bg-secondary/15 flex justify-end shrink-0">
              <Button
                onClick={() => {
                  setActiveWorkspace(null);
                  loadWorkspaces();
                }}
                className="rounded-[5px] border border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] px-8 h-12"
              >
                Close Console
              </Button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* 2. CUSTOM WORKSPACE DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {workspaceToDelete && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-background border border-red-500/30 p-8 rounded-[5px] max-w-sm w-full space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[8px] font-mono tracking-widest px-2.5 py-0.5 rounded-[5px] font-bold uppercase mb-1">Warning</Badge>
                <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">Delete Workspace</h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete this workspace? This will remove all local nodes but preserve linked task associations in the system.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setWorkspaceToDelete(null)}
                className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] px-5 h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDeleteWorkspace}
                className="rounded-[5px] bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[9px] px-6 h-10 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                Purge Workspace
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* 3. CUSTOM WORKSPACE TASK DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {taskToDelete && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-background border border-red-500/30 p-8 rounded-[5px] max-w-sm w-full space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[8px] font-mono tracking-widest px-2.5 py-0.5 rounded-[5px] font-bold uppercase mb-1">Warning</Badge>
                <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">Delete Tracker</h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this task tracker from this workspace and your unified task list?
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
                Purge Tracker
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
