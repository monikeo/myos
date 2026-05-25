import React, { useState, useEffect } from "react";
import { Organization, RoleAssignment, Workspace, Project, Task, FinancialTransaction } from "@/src/types";
import { updateItem, deleteItem, createItem, lookupUserByEmail, getItems, getAllUsers, getCurrentSession } from "@/lib/api";
import { X, Settings2, Users, ShieldAlert, ShieldCheck, Trash2, Search, UserPlus, Building2, Loader2, AlertTriangle, Wallet, TrendingDown, Clock, TrendingUp, FolderKanban, Layers, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createPortal } from "react-dom";
import { resolveDriveImage, cn } from "@/lib/utils";

interface OrganizationSettingsModalProps {
  organization: Organization;
  onClose: () => void;
  onUpdate: () => void; // Triggered when organization details or members change
}

export function OrganizationSettingsModal({ organization, onClose, onUpdate }: OrganizationSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "members" | "danger" | "info">("info");
  
  // General Tab
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || "");
  const [logoUrl, setLogoUrl] = useState(organization.logo_url || "");
  const [saving, setSaving] = useState(false);

  // Members Tab
  const [members, setMembers] = useState<{ assignmentId: string; user: any; role: string; status: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Organization analysis and listings states
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Danger Zone confirmation
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const currentUser = getCurrentSession();
  const currentUserMember = members.find(m => m.user?.id === currentUser?.id);
  const isOwner = organization.user_id === currentUser?.id || organization.owner_id === currentUser?.id;
  const userRole = isOwner ? "Owner" : (currentUserMember?.role || "Member");
  const isAllowedToEdit = userRole === "Owner" || userRole === "Admin";

  useEffect(() => {
    loadMembersData();
    loadOrgInfoData();
  }, [organization.id]);

  useEffect(() => {
    if (!loadingMembers && (userRole === "Member" || userRole === "Guest")) {
      setActiveTab("info");
    }
  }, [userRole, loadingMembers]);

  const loadMembersData = async () => {
    try {
      setLoadingMembers(true);
      
      const users = await getAllUsers();
      
      const assignments = await getItems<RoleAssignment>("role_assignment");
      const orgAssignments = assignments.filter(a => a.scope_type === "organization" && a.scope_id === organization.id);
      
      const mappedMembers = orgAssignments.map(a => {
        const u = users.find(user => user.id === a.user_id);
        return {
          assignmentId: a.id,
          user: u || { display_name: "Unknown User", email: "unknown", id: a.user_id },
          role: a.role,
          status: a.status || "active"
        };
      });

      setMembers(mappedMembers);
    } catch (err) {
      console.error("Failed to load members", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadOrgInfoData = async () => {
    try {
      setLoadingInfo(true);
      const [wsList, projList, taskList, txList] = await Promise.all([
        getItems<Workspace>("workspace"),
        getItems<Project>("project"),
        getItems<Task>("task"),
        getItems<FinancialTransaction>("transaction")
      ]);
      
      const orgWorkspaces = wsList.filter(w => w.organization_id === organization.id);
      setWorkspaces(orgWorkspaces);
      
      const orgProjects = projList.filter(p => p.workspace_id && orgWorkspaces.some(w => w.id === p.workspace_id));
      setProjects(orgProjects);
      
      const orgTasks = taskList.filter(t => t.workspace_id && orgWorkspaces.some(w => w.id === t.workspace_id));
      setTasks(orgTasks);
      
      setTransactions(txList);
    } catch (err) {
      console.error("Failed to load organization info dashboard:", err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleUpdateGeneral = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateItem(organization.id, {
        ...organization,
        name,
        description,
        logo_url: logoUrl
      });
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Organization Updated", message: "Successfully updated organization details.", category: "system" }
        })
      );
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrg = async () => {
    // Require org name confirmation
    if (deleteConfirmText.trim().toLowerCase() !== organization.name.toLowerCase()) return;
    try {
      setSaving(true);
      await deleteItem(organization.id);
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Organization Deleted", message: "The organization and all its data was permanently deleted.", category: "system" }
        })
      );
      // Reset active org + force all views to reload
      localStorage.setItem("myos_active_organization_id", "all");
      window.dispatchEvent(new CustomEvent("myos:active-org-changed", { detail: { activeOrgId: "all" } }));
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    
    try {
      const invitedUser = await lookupUserByEmail(inviteEmail.trim());
      
      if (members.some(m => m.user.id === invitedUser.id)) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: { title: "Already Member", message: "User is already in this organization.", category: "system" }
          })
        );
        setInviteLoading(false);
        return;
      }

      // Create a pending role assignment
      const newAssignment = await createItem({
        type: "role_assignment",
        scope_type: "organization",
        scope_id: organization.id,
        user_id: invitedUser.id,
        role: selectedRole,
        status: "pending"
      });

      // Send the user a notification with the link_to flag
      await createItem({
        type: "notification",
        title: "Organization Invitation",
        message: `You have been invited to join ${organization.name} as a ${selectedRole}.`,
        category: "security",
        read: false,
        user_id: invitedUser.id,
        link_to: `invitation-modal:${newAssignment.id}`
      });

      setInviteEmail("");
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Invitation Sent", message: `Invitation sent to ${invitedUser.display_name}.`, category: "system" }
        })
      );

      await loadMembersData();
      onUpdate();
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Error", message: err.message || "Failed to invite user.", category: "system" }
        })
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (assignmentId: string) => {
    try {
      await deleteItem(assignmentId);
      await loadMembersData();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangeMemberRole = async (assignmentId: string, newRole: string) => {
    try {
      const assignment = members.find(m => m.assignmentId === assignmentId);
      if (!assignment) return;
      
      const roleAssignments = await getItems<RoleAssignment>("role_assignment");
      const ra = roleAssignments.find(item => item.id === assignmentId);
      if (!ra) return;

      await updateItem(assignmentId, {
        ...ra,
        role: newRole
      });

      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { 
            title: "Role Updated", 
            message: `Updated role for ${assignment.user.display_name} to ${newRole}.`, 
            category: "system" 
          }
        })
      );
      
      await loadMembersData();
      onUpdate();
    } catch (err) {
      console.error("Failed to update role", err);
    }
  };


  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-background border border-border/50 sm:rounded-[5px] w-full max-w-4xl h-full sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50 bg-secondary/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[5px] bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              {organization.logo_url ? (
                <img src={resolveDriveImage(organization.logo_url)} className="w-full h-full object-cover" alt="Logo" />
              ) : (
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{organization.name}</h2>
              <p className="text-[10px] uppercase font-mono tracking-widest text-primary mt-1">Organization Settings</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-[5px] text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border/50 transition-colors">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-0 sm:min-h-[400px]">
            {/* Sidebar */}
            <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r border-border/50 bg-secondary/5 p-2 sm:p-4 space-y-0 sm:space-y-1 shrink-0 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto flex sm:flex-col gap-1 sm:gap-0 scrollbar-none items-center sm:items-stretch">
              <button
                onClick={() => setActiveTab("info")}
                className={`w-auto sm:w-full shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[5px] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  activeTab === "info" ? "bg-primary text-primary-foreground border-primary/20 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.2)]" : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground hover:border-border/30"
                }`}
              >
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Overview Info
              </button>
              <button
                onClick={() => setActiveTab("general")}
                className={`w-auto sm:w-full shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[5px] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  activeTab === "general" ? "bg-primary text-primary-foreground border-primary/20 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.2)]" : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground hover:border-border/30"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                General
              </button>
              {(userRole === "Owner" || userRole === "Admin") && (
                <button
                  onClick={() => setActiveTab("members")}
                  className={`w-auto sm:w-full shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[5px] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border ${
                    activeTab === "members" ? "bg-primary text-primary-foreground border-primary/20 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.2)]" : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground hover:border-border/30"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  Members
                </button>
              )}
              {(userRole === "Owner" || userRole === "Admin") && (
                <div className="sm:pt-6 sm:mt-auto sm:border-t sm:border-border/50 shrink-0">
                  <button
                    onClick={() => setActiveTab("danger")}
                    className={`w-auto sm:w-full shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[5px] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      activeTab === "danger" ? "bg-destructive text-destructive-foreground border-destructive/20 shadow-[inset_2px_0_0_0_rgba(255,255,255,0.2)]" : "border-transparent text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    Danger Zone
                  </button>
                </div>
              )}
            </div>

          {/* Content Area */}
          <div className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar bg-background">
            {activeTab === "info" && (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b border-border/50 pb-4">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">Organization Overview</h3>
                  <p className="text-xs text-muted-foreground mt-1">Audit active workspaces, projects, task metrics, and budget consumption in real-time.</p>
                </div>

                {loadingInfo ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Auditing Organization Nodes...</p>
                  </div>
                ) : (
                  <>
                    {/* Basic Analyze Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Workspaces Card */}
                      <div className="p-4 border border-border/40 bg-secondary/5 rounded-[5px] space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-[8px] font-extrabold uppercase tracking-widest font-mono">Workspaces</span>
                          <Layers className="w-4 h-4 text-primary shrink-0" />
                        </div>
                        <p className="text-2xl font-black font-mono tracking-tight text-foreground">{workspaces.length}</p>
                        <p className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground/60">Active Workspace Nodes</p>
                      </div>

                      {/* Projects Card */}
                      <div className="p-4 border border-border/40 bg-secondary/5 rounded-[5px] space-y-2 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-[8px] font-extrabold uppercase tracking-widest font-mono">Projects</span>
                          <FolderKanban className="w-4 h-4 text-primary shrink-0" />
                        </div>
                        <p className="text-2xl font-black font-mono tracking-tight text-foreground">{projects.length}</p>
                        <p className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground/60">Linked Project Clusters</p>
                      </div>

                      {/* Budget Tracker Card */}
                      {(() => {
                        const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
                        const totalSpent = transactions
                          .filter(t => t.transaction_type === 'expense' && projects.some(p => p.id === t.project_id))
                          .reduce((sum, tx) => sum + tx.amount, 0);
                        const percent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
                        return (
                          <div className="p-4 border border-border/40 bg-secondary/5 rounded-[5px] space-y-2 flex flex-col justify-between col-span-1">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest font-mono">Spent / Limit</span>
                              <Wallet className="w-4 h-4 text-primary shrink-0" />
                            </div>
                            <div>
                              <p className="text-sm font-bold font-mono tracking-tight text-foreground">${totalSpent.toLocaleString()}</p>
                              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Limit: ${totalBudget.toLocaleString()}</p>
                            </div>
                            {totalBudget > 0 ? (
                              <div className="w-full bg-secondary h-1 rounded-[5px] overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                              </div>
                            ) : (
                              <p className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground/40">No limit defined</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Tasks Tracker Card */}
                      {(() => {
                        const totalTasks = tasks.length;
                        const completed = tasks.filter(t => t.status === "completed" || t.status === "archived").length;
                        const percent = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
                        return (
                          <div className="p-4 border border-border/40 bg-secondary/5 rounded-[5px] space-y-2 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest font-mono">Tasks Done</span>
                              <Clock className="w-4 h-4 text-primary shrink-0" />
                            </div>
                            <p className="text-2xl font-black font-mono tracking-tight text-foreground">{percent}%</p>
                            <p className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground/60">{completed} / {totalTasks} Complete</p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Structural Directory List of Workspaces & Projects */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.25em] font-mono flex items-center gap-2 border-b border-border/10 pb-2">
                        <Layers className="w-4 h-4 text-primary" /> Workspace Registry Directory
                      </h4>

                      {workspaces.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-border/30 bg-secondary/5 rounded-[5px] text-muted-foreground/60 font-mono uppercase tracking-widest text-[9px]">
                          No active workspaces in this organization.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {workspaces.map(ws => {
                            const wsProj = projects.filter(p => p.workspace_id === ws.id);
                            const wsBudget = wsProj.reduce((sum, p) => sum + (p.budget || 0), 0);
                            const wsSpent = transactions
                              .filter(t => t.transaction_type === 'expense' && wsProj.some(p => p.id === t.project_id))
                              .reduce((sum, tx) => sum + tx.amount, 0);

                            return (
                              <div key={ws.id} className="border border-border/50 bg-secondary/5 rounded-[5px] p-4 space-y-3">
                                {/* Workspace Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/10 pb-2.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-[5px] bg-background border border-border/50 flex items-center justify-center shrink-0 shadow-sm font-bold text-xs uppercase text-primary" style={{ borderColor: ws.color }}>
                                      {ws.name.slice(0, 2)}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h5 className="text-sm font-extrabold uppercase text-foreground leading-none">{ws.name}</h5>
                                        <Badge variant="outline" className="text-[7px] font-mono font-bold uppercase tracking-wider h-4 bg-background/50 border-border/50 text-muted-foreground px-1.5">{ws.company}</Badge>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ws.description || "No description overview logged."}</p>
                                    </div>
                                  </div>

                                  <div className="text-left sm:text-right shrink-0">
                                    <p className="text-[9px] font-bold font-mono text-foreground uppercase">
                                      Spent: <span className="text-red-400 font-extrabold">${wsSpent.toLocaleString()}</span>
                                    </p>
                                    <p className="text-[8px] font-mono text-muted-foreground mt-0.5 uppercase">
                                      Limit: ${wsBudget.toLocaleString()} • {wsProj.length} Projects
                                    </p>
                                  </div>
                                </div>

                                {/* Nested Projects Registry list */}
                                <div className="pl-0 sm:pl-4 space-y-2">
                                  <p className="text-[8px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">Linked Project Nodes</p>
                                  {wsProj.length === 0 ? (
                                    <div className="py-4 text-center border border-dashed border-border/20 bg-background/25 text-[8.5px] font-mono text-muted-foreground uppercase tracking-widest">
                                      No linked project nodes registered.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {wsProj.map(proj => {
                                        const projSpent = transactions
                                          .filter(t => t.project_id === proj.id && t.transaction_type === 'expense')
                                          .reduce((sum, tx) => sum + tx.amount, 0);
                                        const projLimit = proj.budget;

                                        return (
                                          <div key={proj.id} className="p-3 bg-background border border-border/40 rounded-[5px] flex flex-col justify-between gap-2.5" style={{ borderLeft: `3px solid ${proj.color || "#3b82f6"}` }}>
                                            <div className="flex justify-between items-start gap-2">
                                              <div className="min-w-0">
                                                <h6 className="text-[11px] font-bold uppercase text-foreground leading-none truncate">{proj.name}</h6>
                                                <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate uppercase">{proj.status}</p>
                                              </div>
                                              <Badge variant="outline" className={cn(
                                                "text-[6.5px] uppercase font-bold tracking-widest h-4 px-1 rounded-[5px] shrink-0 font-mono",
                                                proj.priority === "critical" ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.25)]" :
                                                proj.priority === "high" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                "bg-primary/10 text-primary border-primary/20"
                                              )}>
                                                {proj.priority}
                                              </Badge>
                                            </div>

                                            <div className="space-y-1">
                                              <div className="flex justify-between items-center text-[7.5px] font-mono text-muted-foreground/60 tracking-wider">
                                                <span>BUDGET CONSUMED</span>
                                                <span className={cn(
                                                  "font-extrabold text-foreground",
                                                  projLimit && projSpent >= projLimit ? "text-red-500" : ""
                                                )}>
                                                  ${projSpent.toLocaleString()} {projLimit ? `/ $${projLimit.toLocaleString()}` : ""}
                                                </span>
                                              </div>
                                              {projLimit ? (
                                                <div className="w-full bg-secondary h-1 rounded-[5px] overflow-hidden border border-border/10">
                                                  <div 
                                                    className={cn(
                                                      "h-full transition-all duration-300",
                                                      projSpent >= projLimit ? "bg-red-500" : projSpent >= projLimit * 0.75 ? "bg-amber-500" : "bg-emerald-500"
                                                    )}
                                                    style={{ width: `${Math.min(100, (projSpent / projLimit) * 100)}%` }}
                                                  />
                                                </div>
                                              ) : (
                                                <div className="text-[7.5px] font-mono text-muted-foreground/40 uppercase">No budget limit set</div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "general" && (
              <div className="max-w-2xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b border-border/50 pb-4">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">Organization Profile</h3>
                  <p className="text-xs text-muted-foreground mt-1">Update the core identity of your organization. This is visible to all members.</p>
                </div>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Organization Name</label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      disabled={!isAllowedToEdit}
                      className="max-w-md rounded-[5px] border-border/50 h-10 focus-visible:ring-primary bg-secondary/5 font-mono text-sm disabled:opacity-60"
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Description (Optional)</label>
                    <Input 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      disabled={!isAllowedToEdit}
                      className="max-w-md rounded-[5px] border-border/50 h-10 focus-visible:ring-primary bg-secondary/5 text-sm disabled:opacity-60"
                      placeholder="Brief description"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">Organization Logo URL</label>
                    <Input 
                      value={logoUrl} 
                      onChange={(e) => setLogoUrl(e.target.value)} 
                      disabled={!isAllowedToEdit}
                      className="max-w-md rounded-[5px] border-border/50 h-10 focus-visible:ring-primary bg-secondary/5 font-mono text-xs disabled:opacity-60"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>

                {isAllowedToEdit && (
                  <div className="pt-4 border-t border-border/50">
                    <Button 
                      onClick={handleUpdateGeneral} 
                      disabled={saving}
                      className="rounded-[5px] bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[9px] px-6 h-10"
                    >
                      {saving ? "Saving Changes..." : "Save Configuration"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "members" && (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full min-h-[400px]">
                <div className="border-b border-border/50 pb-4 shrink-0">
                  <h3 className="text-xl font-bold text-foreground tracking-tight">Access Management</h3>
                  <p className="text-xs text-muted-foreground mt-1">Control who has access to this organization and define their authorization roles.</p>
                </div>

                {/* Invite Section */}
                <div className="bg-secondary/5 border border-border/50 rounded-[5px] p-4 sm:p-5 space-y-4 shrink-0">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                    <UserPlus className="w-4 h-4 shrink-0" /> Invite New Members
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Input 
                        placeholder="Enter exact email address to invite..." 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-background/50 border-border/50 rounded-[5px] focus-visible:ring-primary h-10 font-mono text-xs"
                        onKeyDown={(e) => e.key === "Enter" && handleInviteUser()}
                      />
                    </div>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="h-10 px-4 rounded-[5px] bg-background/50 border border-border/50 text-xs font-bold font-mono uppercase tracking-widest text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shrink-0 transition-all hover:bg-background/80"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                      <option value="Guest">Guest</option>
                    </select>
                    <Button 
                      onClick={handleInviteUser} 
                      disabled={inviteLoading || !inviteEmail.trim()}
                      className="rounded-[5px] bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[9px] h-10 px-6 shrink-0"
                    >
                      {inviteLoading ? "Sending..." : "Send Invite"}
                    </Button>
                  </div>
                </div>

                {/* Member List */}
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest font-mono flex items-center gap-2 shrink-0">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" /> Current Personnel
                  </h4>
                  {loadingMembers ? (
                    <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : members.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-border/50 rounded-[5px] text-muted-foreground text-xs font-mono uppercase tracking-widest">No members found.</div>
                  ) : (
                    <div className="border border-border/50 rounded-[5px] divide-y divide-border/50 overflow-y-auto custom-scrollbar flex-1 bg-background">
                      {members.map(m => (
                        <div key={m.assignmentId} className="flex items-center justify-between p-3 sm:p-4 hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img src={m.user.avatar_url ? resolveDriveImage(m.user.avatar_url) : `https://api.dicebear.com/7.x/bottts/svg?seed=${m.user.id}`} className="w-9 h-9 sm:w-10 sm:h-10 rounded-[5px] border border-border/50 bg-secondary shrink-0" alt="Avatar" />
                            <div className="min-w-0 flex items-center gap-2">
                              <p className="text-xs font-bold uppercase text-foreground truncate">{m.user.display_name}</p>
                              {m.status === "pending" && (
                                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-widest">Pending</span>
                              )}
                              <p className="text-[10px] text-muted-foreground font-mono truncate hidden sm:block">{m.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2">
                            {isAllowedToEdit && m.role !== "Owner" ? (
                              <select
                                value={m.role}
                                onChange={(e) => handleChangeMemberRole(m.assignmentId, e.target.value)}
                                className="text-[10px] font-bold font-mono tracking-wider uppercase bg-secondary/50 border border-border/30 rounded-[5px] px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                              >
                                <option value="Admin">Admin</option>
                                <option value="Member">Member</option>
                                <option value="Guest">Guest</option>
                              </select>
                            ) : (
                              <span className={`text-[8px] sm:text-[9px] font-bold font-mono tracking-widest uppercase px-2 py-1 rounded-[5px] border ${
                                m.role === "Owner" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                                m.role === "Admin" ? "bg-primary/10 text-primary border-primary/30" :
                                m.role === "Member" ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                                m.role === "Guest" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                "bg-secondary/50 text-foreground border-border/30"
                              }`}>
                                {m.role}
                              </span>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveMember(m.assignmentId)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-[5px] h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "danger" && (
              <div className="max-w-2xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b border-border/50 pb-4">
                  <h3 className="text-xl font-bold text-destructive tracking-tight">Danger Zone</h3>
                  <p className="text-xs text-muted-foreground mt-1">Irreversible destructive actions. Proceed with extreme caution.</p>
                </div>
                
                <div className="border border-destructive/30 bg-destructive/5 rounded-[5px] p-4 sm:p-6 space-y-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[5px] shrink-0 flex items-center justify-center">
                       <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h4 className="text-foreground font-bold uppercase tracking-wider mb-1 text-sm">Terminate Organization</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                        This will permanently cascade-delete the organization, all attached workspaces, projects, tasks, role assignments, and files. <strong className="text-foreground">This action cannot be undone.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-destructive/20">
                    <label className="text-[10px] uppercase font-bold tracking-widest font-mono text-foreground block">
                      Type <span className="text-destructive">"{organization.name}"</span> to confirm
                    </label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={`Type "${organization.name}"`}
                      className="max-w-md bg-background border-destructive/40 focus-visible:ring-destructive rounded-[5px] h-10 font-mono text-sm"
                    />
                  </div>

                  <div className="pt-2">
                    <Button 
                      variant="destructive"
                      onClick={handleDeleteOrg}
                      disabled={saving || deleteConfirmText.trim().toLowerCase() !== organization.name.toLowerCase()}
                      className="rounded-[5px] font-bold text-[9px] uppercase tracking-widest px-6 h-10"
                    >
                      {saving ? "Purging Data..." : "Delete Organization"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
