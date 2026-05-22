import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getItems, updateItem, deleteItem } from "@/lib/api";
import { RoleAssignment, Organization } from "@/src/types";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, X } from "lucide-react";
import { resolveDriveImage } from "@/lib/utils";

interface InvitationModalProps {
  assignmentId: string;
  onClose: () => void;
}

export function InvitationModal({ assignmentId, onClose }: InvitationModalProps) {
  const [assignment, setAssignment] = useState<RoleAssignment | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const assignments = await getItems<RoleAssignment>("role_assignment");
        const a = assignments.find((x) => x.id === assignmentId);
        if (!a) {
          throw new Error("Invitation not found");
        }
        setAssignment(a);

        if (a.scope_type === "organization") {
          const orgs = await getItems<Organization>("organization");
          const o = orgs.find((x) => x.id === a.scope_id);
          if (o) setOrganization(o);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [assignmentId]);

  const handleAccept = async () => {
    if (!assignment) return;
    setProcessing(true);
    try {
      await updateItem(assignment.id, {
        ...assignment,
        status: "active",
      });
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Invitation Accepted", message: `You are now a ${assignment.role}.`, category: "security" },
        })
      );
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!assignment) return;
    setProcessing(true);
    try {
      await deleteItem(assignment.id);
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: { title: "Invitation Declined", message: "You have declined the invitation.", category: "system" },
        })
      );
      window.dispatchEvent(new CustomEvent("myos:data-changed"));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return null;
  if (!assignment || !organization) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-background border border-border/50 p-6 text-center shadow-2xl max-w-sm w-full font-mono">
          <p className="text-red-400 uppercase tracking-widest font-bold text-xs mb-4">Invitation Expired or Invalid</p>
          <Button onClick={onClose} variant="outline" className="w-full rounded-[5px]">Close</Button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-background border border-border/50 shadow-2xl w-full max-w-md relative overflow-hidden flex flex-col font-mono text-sm">
        
        {/* Glow */}
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />

        {/* Header */}
        <div className="p-5 border-b border-border/50 flex items-center gap-4 bg-secondary/30 relative z-10">
          {organization.logo_url ? (
            <img src={resolveDriveImage(organization.logo_url)} alt="Logo" className="w-12 h-12 border border-border/50 object-contain bg-background shrink-0" />
          ) : (
            <div className="w-12 h-12 bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h2 className="text-primary font-bold uppercase tracking-widest">Organization Invitation</h2>
            <p className="text-xs text-muted-foreground mt-1">Pending Approval</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 relative z-10">
          <div className="space-y-4 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-foreground leading-relaxed">
              You have been invited to join <strong className="text-primary uppercase tracking-widest px-1">{organization.name}</strong> as <strong className="uppercase">{assignment.role}</strong>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-secondary/10 flex gap-3 relative z-10">
          <Button
            onClick={handleDecline}
            disabled={processing}
            variant="outline"
            className="flex-1 rounded-[5px] border-border/50 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/50 uppercase tracking-widest text-xs font-bold"
          >
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 rounded-[5px] bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] uppercase tracking-widest text-xs font-bold"
          >
            {processing ? "Processing..." : "Accept"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
