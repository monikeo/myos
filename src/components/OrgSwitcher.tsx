import React, { useState, useEffect, useRef } from "react";
import { getItems, createItem, getCurrentSession } from "@/lib/api";
import { Organization } from "@/src/types";
import { Building2, ChevronDown, Plus, Globe, Check, Terminal, Settings2 } from "lucide-react";
import { OrganizationSettingsModal } from "./OrganizationSettingsModal";
import { resolveDriveImage } from "@/lib/utils";

export function OrgSwitcher() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDesc, setNewOrgDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsOrg, setSettingsOrg] = useState<Organization | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadOrgs = async () => {
    try {
      const list = await getItems<Organization>("organization");
      setOrganizations(list);
    } catch (err) {
      console.error("Failed to load organizations:", err);
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem("myos_active_organization_id") || "all";
    setActiveOrgId(cached);
    loadOrgs();

    const handleDataChanged = () => loadOrgs();
    window.addEventListener("myos:data-changed", handleDataChanged);
    return () => window.removeEventListener("myos:data-changed", handleDataChanged);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectOrg = (id: string) => {
    setActiveOrgId(id);
    localStorage.setItem("myos_active_organization_id", id);
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent("myos:active-org-changed", { detail: { activeOrgId: id } }));
    window.dispatchEvent(new CustomEvent("myos:data-changed"));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setLoading(true);
    try {
      const newOrg = await createItem({
        type: "organization",
        name: newOrgName,
        description: newOrgDesc,
      });

      // Get current user session so we can assign them as Owner
      const session = getCurrentSession();
      await createItem({
        type: "role_assignment",
        scope_type: "organization",
        scope_id: newOrg.id,
        user_id: session?.id,
        role: "Owner",
        status: "active"
      });

      setNewOrgName("");
      setNewOrgDesc("");
      setIsCreating(false);
      await loadOrgs();
      handleSelectOrg(newOrg.id);
    } catch (err) {
      console.error("Failed to create organization:", err);
    } finally {
      setLoading(false);
    }
  };

  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Premium Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-11 px-4 flex items-center gap-2.5 transition-all duration-500 text-xs font-mono uppercase tracking-widest relative overflow-hidden group border ${
          isOpen ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_rgba(20,184,166,0.15)]" : "border-border/40 hover:border-primary/40 bg-secondary/30 hover:bg-secondary/60"
        }`}
      >
        {/* Dynamic Glow background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 bg-[length:200%_auto] animate-shimmer" />
        
        {activeOrgId === "all" ? (
          <>
            <Globe className="h-4 w-4 text-primary animate-pulse relative z-10" />
            <span className="text-primary font-bold relative z-10">All Nodes</span>
          </>
        ) : activeOrgId === "standalone" ? (
          <>
            <Terminal className="h-4 w-4 text-amber-500 animate-pulse relative z-10" />
            <span className="text-amber-500 font-bold relative z-10">Standalone</span>
          </>
        ) : (
          <>
            {activeOrg?.logo_url ? (
              <img src={resolveDriveImage(activeOrg.logo_url)} className="w-4 h-4 object-contain relative z-10" alt="Logo" />
            ) : (
              <Building2 className="h-4 w-4 text-primary relative z-10" />
            )}
            <span className="max-w-[120px] truncate font-bold text-foreground relative z-10">
              {activeOrg?.name}
            </span>
          </>
        )}
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-500 relative z-10 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Premium Dropdown Card */}
      {isOpen && (
        <div className="absolute top-[3.25rem] left-0 w-80 border border-border/50 bg-background/95 backdrop-blur-3xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-[0.25em] mb-3 px-2 pb-2 border-b border-border/40 flex items-center justify-between">
            <span>Select Scope</span>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {/* Option: All */}
            <button
              onClick={() => handleSelectOrg("all")}
              className={`w-full flex items-center justify-between p-2.5 transition-all duration-300 font-mono text-xs uppercase tracking-wider border ${
                activeOrgId === "all" ? "text-primary bg-primary/10 border-primary/20 shadow-inner" : "text-muted-foreground border-transparent hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className={`h-3.5 w-3.5 ${activeOrgId === "all" ? "text-primary animate-pulse" : "opacity-60"}`} />
                <span className={activeOrgId === "all" ? "font-bold" : ""}>Global Scope</span>
              </div>
              {activeOrgId === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>

            {/* Option: Standalone */}
            <button
              onClick={() => handleSelectOrg("standalone")}
              className={`w-full flex items-center justify-between p-2.5 transition-all duration-300 font-mono text-xs uppercase tracking-wider border ${
                activeOrgId === "standalone" ? "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-inner" : "text-muted-foreground border-transparent hover:bg-secondary/40 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Terminal className={`h-3.5 w-3.5 ${activeOrgId === "standalone" ? "text-amber-500 animate-pulse" : "opacity-60"}`} />
                <span className={activeOrgId === "standalone" ? "font-bold" : ""}>Standalone Core</span>
              </div>
              {activeOrgId === "standalone" && <Check className="h-3.5 w-3.5 text-amber-500" />}
            </button>

            <div className="h-px w-full bg-border/30 my-2" />

            {/* Organizations List */}
            {organizations.map((org) => (
              <div
                key={org.id}
                className={`w-full flex items-center justify-between p-2.5 transition-all duration-300 font-mono text-xs border group ${
                  activeOrgId === org.id ? "text-primary bg-primary/10 border-primary/20 shadow-inner" : "text-muted-foreground border-transparent hover:bg-secondary/40 hover:border-border/30"
                }`}
              >
                <button
                  onClick={() => handleSelectOrg(org.id)}
                  className="flex-1 flex items-center gap-2.5 overflow-hidden text-left"
                >
                  {org.logo_url ? (
                    <img src={resolveDriveImage(org.logo_url)} className="w-3.5 h-3.5 object-contain shrink-0" alt="Logo" />
                  ) : (
                    <Building2 className={`h-3.5 w-3.5 shrink-0 ${activeOrgId === org.id ? "text-primary" : "opacity-60 group-hover:text-primary/70 transition-colors"}`} />
                  )}
                  <span className={`truncate uppercase tracking-wider ${activeOrgId === org.id ? "font-bold text-primary" : "group-hover:text-foreground"}`}>
                    {org.name}
                  </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(false); setSettingsOrg(org); }}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Manage Organization"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {activeOrgId === org.id && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </div>
            ))}
          </div>

          {/* New Org Modal Trigger / Action */}
          <div className="mt-3 pt-3 border-t border-border/40">
            {isCreating ? (
              <form onSubmit={handleCreateOrg} className="space-y-2.5 p-1 font-mono animate-in fade-in duration-300">
                <div>
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization Name"
                    className="w-full h-9 px-3 bg-background border border-border/50 text-foreground placeholder-muted-foreground text-xs focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={newOrgDesc}
                    onChange={(e) => setNewOrgDesc(e.target.value)}
                    placeholder="Short Description (Optional)"
                    className="w-full h-9 px-3 bg-background border border-border/50 text-foreground placeholder-muted-foreground text-xs focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="h-8 px-4 bg-transparent text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors border border-transparent hover:border-border/50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-8 px-4 bg-primary/20 text-primary border border-primary/30 text-[10px] uppercase tracking-widest font-bold hover:bg-primary hover:text-white transition-all flex items-center justify-center shadow-[0_0_10px_rgba(20,184,166,0.1)]"
                  >
                    {loading ? "..." : "Deploy"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full h-10 border border-dashed border-border/60 hover:border-primary/50 bg-secondary/20 hover:bg-primary/5 text-muted-foreground hover:text-primary font-mono text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all duration-300"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Provision Organization</span>
              </button>
            )}
          </div>
        </div>
      )}

      {settingsOrg && (
        <OrganizationSettingsModal 
          organization={settingsOrg} 
          onClose={() => setSettingsOrg(null)} 
          onUpdate={loadOrgs} 
        />
      )}
    </div>
  );
}
