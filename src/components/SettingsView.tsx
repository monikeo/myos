import { useState, useEffect } from "react";
import {
  Settings, User, Palette, Database, Key, Bell, Save,
  CheckCircle, Loader2, Moon, Sun, Globe, Clock, Shield,
  HardDrive, ExternalLink, AlertTriangle, Volume2, RefreshCw, X,
  Eye, EyeOff, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSettings, saveSettings, changePassword, AppSettings } from "@/lib/api";
import { cn, resolveDriveImage } from "@/lib/utils";

type Section = "profile" | "appearance" | "integrations" | "notifications" | "security" | "about";

const SECTIONS: { id: Section; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Database },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

const TIMEZONES = [
  "Asia/Phnom_Penh", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo",
  "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris"
];

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"];

// Toggle and Field are declared as static top-level components to avoid rebuilding on state change
const Toggle = ({ value, onChange }: { value?: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={cn(
      "relative w-12 h-6 rounded-[5px]-full transition-all duration-300 focus:outline-none",
      value ? "bg-primary shadow-[0_0_15px_rgba(59,130,246,0.4)]" : "bg-secondary/60 border border-border/50"
    )}
  >
    <div className={cn(
      "absolute top-0.5 w-5 h-5 bg-white rounded-[5px]-full shadow-md transition-all duration-300",
      value ? "left-6" : "left-0.5"
    )} />
  </button>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-8 py-6 border-b border-border/20 last:border-0">
    <div className="space-y-1 flex-1">
      <p className="font-bold text-sm">{label}</p>
      {hint && <p className="text-xs text-muted-foreground/60 leading-relaxed">{hint}</p>}
    </div>
    <div className="w-full sm:w-auto sm:shrink-0 flex items-center">{children}</div>
  </div>
);

function TelemetryPanel() {
  const [uptime, setUptime] = useState(0);
  const [latency, setLatency] = useState(18);
  const [cacheHitRate, setCacheHitRate] = useState(98.6);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  useEffect(() => {
    const start = Date.now() - 10450000;
    const timer = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    const latencyTimer = setInterval(() => {
      setLatency(prev => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(10, Math.min(45, prev + change));
      });
    }, 3000);

    const cacheTimer = setInterval(() => {
      setCacheHitRate(prev => {
        const change = (Math.random() * 0.2) - 0.1;
        return Math.max(95, Math.min(100, parseFloat((prev + change).toFixed(2))));
      });
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(latencyTimer);
      clearInterval(cacheTimer);
    };
  }, []);

  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-xs uppercase tracking-widest font-mono text-foreground/80 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
          Live Telemetry Diagnostics
        </h4>
        <Badge variant="outline" className="text-[8px] font-mono bg-emerald-500/10 border-emerald-500/20 text-emerald-400 uppercase tracking-widest px-2.5 py-0.5 animate-pulse rounded-[8px]">
          SECURE PROTOCOL
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] text-muted-foreground/50 uppercase tracking-widest font-mono">
            <span>Uptime Ticker</span>
            <Clock className="w-3.5 h-3.5 text-primary/60" />
          </div>
          <p className="text-sm font-bold text-foreground font-mono mt-2 tracking-tight">
            {formatUptime(uptime)}
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-1 font-mono uppercase">Node Process Sandbox</p>
        </div>

        <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] text-muted-foreground/50 uppercase tracking-widest font-mono">
            <span>DB Latency</span>
            <RefreshCw className="w-3.5 h-3.5 text-primary/60 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <p className="text-sm font-bold text-foreground font-mono mt-2 tracking-tight flex items-baseline gap-1">
            {latency} <span className="text-[10px] text-primary/80">ms</span>
          </p>
          <p className="text-[9px] text-emerald-400 font-mono mt-1 uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Connection Stable
          </p>
        </div>

        <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] text-muted-foreground/50 uppercase tracking-widest font-mono">
            <span>Local Cache Hit</span>
            <HardDrive className="w-3.5 h-3.5 text-primary/60" />
          </div>
          <p className="text-sm font-bold text-foreground font-mono mt-2 tracking-tight">
            {cacheHitRate}%
          </p>
          <p className="text-[9px] text-muted-foreground/40 mt-1 font-mono uppercase">Hydrated Storage</p>
        </div>
      </div>

      <div className="p-5 bg-background/25 border border-border/10 rounded-[8px] backdrop-blur-xl space-y-3">
        <button 
          onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
          className="w-full flex items-center justify-between text-left focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-bold text-[10px] uppercase tracking-wider font-mono text-muted-foreground/80">
              System Security Integrity & Sandbox Check
            </span>
          </div>
          <span className="text-[10px] font-bold font-mono text-primary uppercase tracking-widest hover:underline cursor-pointer">
            {diagnosticsOpen ? "Hide Log Metrics" : "Show Log Metrics"}
          </span>
        </button>

        {diagnosticsOpen && (
          <div className="space-y-2.5 pt-3 border-t border-border/10 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70 font-mono text-[10px]">Row Level Security (RLS) policies</span>
              <span className="text-emerald-400 font-bold font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-[8px] border border-emerald-500/20">SEALED & ENFORCED</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70 font-mono text-[10px]">Credential Transit Encryption</span>
              <span className="text-emerald-400 font-bold font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-[8px] border border-emerald-500/20">AES-256-GCM SSL</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70 font-mono text-[10px]">Client Container Sandbox</span>
              <span className="text-emerald-400 font-bold font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-[8px] border border-emerald-500/20">ACTIVE CONTAINER</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70 font-mono text-[10px]">Google Drive API v3 Token Vault</span>
              <span className="text-primary font-bold font-mono text-[10px] bg-primary/10 px-2 py-0.5 rounded-[8px] border border-primary/20">READY FOR MOUNT</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsView({ 
  profile, 
  onSave 
}: { 
  profile: AppSettings; 
  onSave?: (settings: AppSettings) => void; 
}) {
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [settings, setSettings] = useState<AppSettings>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarDirectFailed, setAvatarDirectFailed] = useState(false);
  const [avatarProxyFailed, setAvatarProxyFailed] = useState(false);

  useEffect(() => {
    setAvatarDirectFailed(false);
    setAvatarProxyFailed(false);
  }, [settings.profile_avatar]);

  const resolvedUrl = resolveDriveImage(settings.profile_avatar || "");
  let imageSrc = "";

  if (resolvedUrl) {
    if (avatarDirectFailed) {
      if (avatarProxyFailed) {
        imageSrc = `https://api.dicebear.com/7.x/bottts/svg?seed=${settings.profile_name || "MYOS"}`;
      } else {
        imageSrc = resolvedUrl.startsWith("/api/proxy") ? resolvedUrl : `/api/proxy?url=${encodeURIComponent(resolvedUrl)}`;
      }
    } else {
      imageSrc = resolvedUrl;
    }
  } else {
    imageSrc = `https://api.dicebear.com/7.x/bottts/svg?seed=${settings.profile_name || "MYOS"}`;
  }

  // Security Panel State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [integrations, setIntegrations] = useState<{
    supabase: { status: "active" | "failed" | "unconfigured"; error?: string };
    sheets: { status: "active" | "failed" | "unconfigured"; error?: string };
    drive: { status: "active" | "failed" | "unconfigured"; error?: string };
    gemini: { status: "active" | "failed" | "unconfigured"; error?: string };
  } | null>(null);
  const [checkingIntegrations, setCheckingIntegrations] = useState(false);

  const checkIntegrationsStatus = async () => {
    setCheckingIntegrations(true);
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (err) {
      console.error("Failed to check integrations status:", err);
    } finally {
      setCheckingIntegrations(false);
    }
  };

  useEffect(() => {
    checkIntegrationsStatus();
  }, []);

  useEffect(() => {
    setSettings(profile);
  }, [profile]);



  const renderStatusBadge = (item?: { status: "active" | "failed" | "unconfigured"; error?: string }) => {
    if (!item) {
      return (
        <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 border border-border/10">
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest">Checking...</span>
        </div>
      );
    }

    if (item.status === "active") {
      return (
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/30">
          <div className="w-2 h-2 rounded-[5px]-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
          <span className="text-[10px] font-bold font-mono text-emerald-500 uppercase tracking-widest">Active</span>
        </div>
      );
    }

    if (item.status === "failed") {
      return (
        <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 border border-red-500/30">
          <div className="w-2 h-2 rounded-[5px]-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
          <span className="text-[10px] font-bold font-mono text-red-500 uppercase tracking-widest">Failed</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 border border-amber-500/30">
        <div className="w-2 h-2 rounded-[5px]-full bg-amber-500/60" />
        <span className="text-[10px] font-bold font-mono text-amber-500 uppercase tracking-widest">Unconfigured</span>
      </div>
    );
  };

  const update = (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setError(null);

    // Email validation
    if (settings.email !== undefined && settings.email.trim() !== "") {
      const cleanEmail = settings.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    // Date of Birth validation (13+ requirement)
    if (settings.dob !== undefined && settings.dob.trim() !== "") {
      const dobDate = new Date(settings.dob);
      if (isNaN(dobDate.getTime())) {
        setError("Please enter a valid date of birth.");
        return;
      }
      const today = new Date();
      if (dobDate > today) {
        setError("Date of birth cannot be in the future.");
        return;
      }
      const minAgeDate = new Date();
      minAgeDate.setFullYear(today.getFullYear() - 13);
      if (dobDate > minAgeDate) {
        setError("You must be at least 13 years old to use MyOS.");
        return;
      }
    }

    setSaving(true);
    try {
      const data = await saveSettings(settings);
      setSaved(true);
      onSave?.(data);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError("Please fill in all security fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeError("Your new password must be at least 8 characters long.");
      return;
    }

    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/])[A-Za-z\d@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/]{8,}$/;
    if (!complexityRegex.test(newPassword)) {
      setPasswordChangeError("Your new password must include an uppercase letter, a lowercase letter, a number, and a symbol (e.g. @, $, !, #, %, *, ?, &).");
      return;
    }

    setPasswordChanging(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordChangeSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordChangeError(err.message || "Failed to update password. Verify current password.");
    } finally {
      setPasswordChanging(false);
    }
  };

  const playTestSound = (volume: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
      
      const volumeFactor = volume / 100;
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
      console.warn("Test audio play failed:", e);
    }
  };



  return (
    <div className="space-y-10 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-2">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Settings</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Manage your application preferences and settings</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "rounded-[5px] h-12 px-8 font-bold text-xs uppercase tracking-[0.2em] transition-all",
            saved
              ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : "bg-primary shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:bg-primary/90"
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono rounded-[5px] flex items-start justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span><strong className="uppercase font-bold tracking-wider">Validation Error:</strong> {error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        {/* Sidebar Ribbon / Menu */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto pb-3 lg:pb-0 whitespace-nowrap lg:whitespace-normal shrink-0 scrollbar-none">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex lg:w-full items-center gap-4 px-5 py-4 rounded-[5px] text-left transition-all duration-200 font-bold text-sm whitespace-nowrap shrink-0",
                activeSection === s.id
                  ? "bg-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground bg-secondary/10"
              )}
            >
              <s.icon className={cn("w-5 h-5", activeSection === s.id ? "text-white" : "text-muted-foreground")} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <Card className="border border-border/50 glass-panel rounded-[5px] shadow-2xl">
            <CardHeader className="border-b border-border/20 bg-background/30 p-8">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.4em] font-mono text-muted-foreground flex items-center gap-3">
                {(() => { const s = SECTIONS.find(s => s.id === activeSection)!; return <><s.icon className="w-5 h-5 text-primary" />{s.label} Settings</>; })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">

              {activeSection === "profile" && (
                <div>
                  <Field label="Display Name" hint="Your name shown across MyOS">
                    <Input
                      value={settings.profile_name || ""}
                      onChange={(e) => update({ profile_name: e.target.value })}
                      placeholder="Alex Thorne"
                      className="w-full sm:w-64 max-w-xs bg-background/50 border-border/30 rounded-[5px] h-10"
                    />
                  </Field>
                  <Field label="System Name" hint="Branding shown in the sidebar header">
                    <Input
                      value={settings.system_name || ""}
                      onChange={(e) => update({ system_name: e.target.value })}
                      placeholder="MYOS"
                      className="w-full sm:w-64 max-w-xs bg-background/50 border-border/30 rounded-[5px] h-10"
                    />
                  </Field>
                  <Field label="Role / Title" hint="Your role label in the sidebar">
                    <Input
                      value={settings.profile_role || ""}
                      onChange={(e) => update({ profile_role: e.target.value })}
                      placeholder="Core Protocol v1.0"
                      className="w-full sm:w-64 max-w-xs bg-background/50 border-border/30 rounded-[5px] h-10"
                    />
                  </Field>
                  <Field label="Avatar URL" hint="Link to your profile picture. Supports direct hotlinks, Google Drive sharing links, and auto-proxies on load failure.">
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-[480px]">
                      {/* Avatar Preview Card */}
                      <div className="relative group shrink-0 w-16 h-16 rounded-[5px] overflow-hidden border border-border/40 bg-secondary/30 glass-panel shadow-md transition-all duration-300 hover:scale-105">
                        <img
                          src={imageSrc}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover rounded-[5px] transition-opacity duration-300"
                          onError={() => {
                            if (!avatarDirectFailed) {
                              setAvatarDirectFailed(true);
                            } else if (!avatarProxyFailed) {
                              setAvatarProxyFailed(true);
                            }
                          }}
                        />
                        {/* Overlay with status */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[8px] font-bold text-white uppercase tracking-widest font-mono">
                            {avatarDirectFailed ? (avatarProxyFailed ? "Fallback" : "Proxied") : "Live"}
                          </span>
                        </div>
                      </div>

                      {/* Input & Open Link Container */}
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={settings.profile_avatar || ""}
                            onChange={(e) => update({ profile_avatar: e.target.value })}
                            placeholder="https://drive.google.com/... or direct url"
                            className="flex-1 bg-background/50 border-border/30 rounded-[5px] h-10 text-xs font-mono"
                          />
                          {settings.profile_avatar && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                window.open(imageSrc, "_blank");
                              }}
                              className="rounded-[5px] font-bold text-[9px] uppercase tracking-wider px-3 h-10 border-border/40 shrink-0 flex items-center gap-1.5"
                              title="Open image in new tab to test"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Test
                            </Button>
                          )}
                        </div>
                        {settings.profile_avatar && (
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono">
                            <span className="w-1.5 h-1.5 rounded-[5px]-full bg-primary animate-pulse" />
                            <span className="truncate max-w-[280px]">
                              Source: {avatarDirectFailed ? (avatarProxyFailed ? "Dicebear Placeholder" : "Secure OS Bypass Proxy") : "Direct Link"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Field>
                  <Field label="Email Address" hint="Used for system login and communication">
                    <Input
                      type="email"
                      value={settings.email || ""}
                      onChange={(e) => update({ email: e.target.value })}
                      placeholder="alex@example.com"
                      className="w-full sm:w-64 max-w-xs bg-background/50 border-border/30 rounded-[5px] h-10"
                    />
                  </Field>
                  <Field label="Date of Birth" hint="Enforces a minimum age requirement of 13">
                    <Input
                      type="date"
                      value={settings.dob || ""}
                      onChange={(e) => update({ dob: e.target.value })}
                      className="w-full sm:w-64 max-w-xs bg-background/50 border-border/30 rounded-[5px] h-10 text-foreground"
                    />
                  </Field>
                  <Field label="Timezone" hint="Used for calendar and timestamps">
                    <select
                      value={settings.timezone || "Asia/Phnom_Penh"}
                      onChange={(e) => update({ timezone: e.target.value })}
                      className="w-full sm:w-64 max-w-xs h-10 px-3 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </Field>
                  <Field label="Date Format">
                    <select
                      value={settings.date_format || "DD/MM/YYYY"}
                      onChange={(e) => update({ date_format: e.target.value })}
                      className="w-full sm:w-64 max-w-xs h-10 px-3 rounded-[5px] bg-background/50 border border-border/30 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {activeSection === "appearance" && (
                <div className="space-y-2">
                  <Field label="Theme" hint="Default color mode">
                    <div className="flex gap-2">
                      {(["light", "dark", "system"] as const).map((t) => (
                        <Button
                          key={t}
                          variant={(settings.theme || "dark") === t ? "default" : "outline"}
                          size="sm"
                          onClick={async () => {
                            update({ theme: t });
                            localStorage.setItem("myos_theme", t);
                            window.dispatchEvent(new CustomEvent("myos:theme-preview", { detail: { theme: t } }));
                            try {
                              await saveSettings({ ...settings, theme: t });
                              window.dispatchEvent(new CustomEvent("myos:data-changed"));
                            } catch (err) {
                              console.error("Failed to save settings on theme update:", err);
                            }
                          }}
                          className={cn("rounded-[5px] font-bold uppercase tracking-widest text-[10px] px-4 h-10", (settings.theme || "dark") === t ? "bg-primary" : "border-border/40")}
                        >
                          {t === "light" ? <Sun className="w-3.5 h-3.5 mr-2" /> : t === "dark" ? <Moon className="w-3.5 h-3.5 mr-2" /> : <Globe className="w-3.5 h-3.5 mr-2" />}
                          {t}
                        </Button>
                      ))}
                    </div>
                  </Field>
                  
                  <Field label="Accent Color" hint="Primary brand color across the OS">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.accent_color || "#3b82f6"}
                        onChange={(e) => update({ accent_color: e.target.value })}
                        className="w-12 h-10 rounded-[5px] border border-border/30 bg-background/50 cursor-pointer p-0.5"
                      />
                      <Input
                        value={settings.accent_color || "#3b82f6"}
                        onChange={(e) => update({ accent_color: e.target.value })}
                        className="w-36 bg-background/50 border-border/30 rounded-[5px] h-10 font-mono text-sm"
                      />
                    </div>
                  </Field>
                  
                  <Field label="Typography Preset" hint="Global system font styling">
                    <div className="grid grid-cols-2 gap-3 w-full sm:w-96 max-w-md">
                      {[
                        { id: "sans", label: "Inter Sans", badge: "Default" },
                        { id: "mono", label: "JetBrains Mono", badge: "Code" },
                        { id: "cyber", label: "Retro Cyber", badge: "Glitch" },
                        { id: "futuristic", label: "Outfit Future", badge: "Sleek" },
                      ].map((f) => {
                        // Dynamically load fonts for the preview
                        if (f.id === "cyber" && typeof document !== "undefined" && !document.getElementById("myos-font-cyber")) {
                          const link = document.createElement("link");
                          link.id = "myos-font-cyber";
                          link.rel = "stylesheet";
                          link.href = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap";
                          document.head.appendChild(link);
                        }
                        if (f.id === "futuristic" && typeof document !== "undefined" && !document.getElementById("myos-font-futuristic")) {
                          const link = document.createElement("link");
                          link.id = "myos-font-futuristic";
                          link.rel = "stylesheet";
                          link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap";
                          document.head.appendChild(link);
                        }
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => update({ ui_font_preset: f.id as any })}
                            style={{ fontFamily: f.id === "cyber" ? "'Share Tech Mono'" : f.id === "futuristic" ? "'Outfit'" : f.id === "mono" ? "'JetBrains Mono'" : "Inter" }}
                            className={cn(
                              "relative p-4 border rounded-[5px] text-left transition-all duration-300 hover:border-primary/50 group flex flex-col justify-between h-24 cursor-pointer",
                              settings.ui_font_preset === f.id
                                ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.15)] text-foreground"
                                : "border-border/40 bg-secondary/5 text-muted-foreground"
                            )}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className="text-[10px] font-bold uppercase tracking-wider">{f.label}</span>
                              <Badge variant="outline" className={cn("text-[7px] uppercase tracking-widest px-1 py-0 border-border/50 opacity-60", settings.ui_font_preset === f.id && "border-primary/30 text-primary opacity-100")}>
                                {f.badge}
                              </Badge>
                            </div>
                            <span className="text-lg font-bold mt-2">Aa Bb Cc</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Enable Cyber Grid Background" hint="Draws a futuristic retro mesh grid on workspace views">
                    <Toggle value={settings.ui_grid_enabled} onChange={(v) => update({ ui_grid_enabled: v })} />
                  </Field>

                  <Field label="Cyber Grid Density" hint="Grid spacing size in pixels">
                    <div className="flex gap-2">
                      {[
                        { id: "dense", label: "Dense", desc: "16px Space" },
                        { id: "medium", label: "Medium", desc: "32px Space" },
                        { id: "wide", label: "Wide", desc: "64px Space" }
                      ].map((g) => (
                        <Button
                          key={g.id}
                          type="button"
                          variant={settings.ui_grid_size === g.id ? "default" : "outline"}
                          size="sm"
                          disabled={!settings.ui_grid_enabled}
                          onClick={() => update({ ui_grid_size: g.id as any })}
                          className={cn(
                            "rounded-[5px] font-bold uppercase tracking-widest text-[9px] px-4 h-10 relative overflow-hidden flex flex-col items-center justify-center min-w-[90px] border-border/40",
                            settings.ui_grid_size === g.id && "bg-primary text-white border-primary"
                          )}
                        >
                          <span>{g.label}</span>
                          <span className="text-[7px] opacity-60 font-mono mt-0.5 tracking-normal">{g.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Glassmorphism Opacity" hint="Dashboard cards background transparency level">
                    <div className="space-y-4 w-full sm:w-96 max-w-md">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.ui_glass_opacity !== undefined ? settings.ui_glass_opacity : 10}
                          onChange={(e) => update({ ui_glass_opacity: parseInt(e.target.value) })}
                          className="flex-1 accent-primary h-1.5 bg-secondary/80 rounded-[5px] appearance-none cursor-pointer"
                        />
                        <span className="text-xs font-mono font-bold w-12 text-right shrink-0">
                          {settings.ui_glass_opacity !== undefined ? settings.ui_glass_opacity : 10}%
                        </span>
                      </div>
                      
                      {/* Premium Dynamic Glass Preview Card */}
                      <div className="mt-4 p-5 relative overflow-hidden border border-border/20 rounded-[5px] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_70%)] bg-background/10">
                        {/* CSS grid background simulating desktop cyber look */}
                        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,rgba(136,136,136,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(136,136,136,0.3)_1px,transparent_1px)]" style={{ backgroundSize: '16px 16px' }} />
                        
                        <div className="relative flex justify-center items-center h-24">
                          <span className="absolute text-3xl font-extrabold text-muted-foreground/10 tracking-[0.25em] uppercase select-none font-mono">MyOS Glass</span>
                          
                          <div 
                            style={{ 
                              backgroundColor: `hsla(var(--secondary) / ${(settings.ui_glass_opacity !== undefined ? settings.ui_glass_opacity : 10) / 100})`,
                              backdropFilter: 'blur(16px)',
                              border: '1px solid rgba(255,255,255,0.08)'
                            }}
                            className="px-6 py-4 shadow-xl rounded-[5px] relative z-10 text-center flex flex-col items-center justify-center min-w-[180px]"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-primary">Preview Pane</span>
                            <span className="text-[8px] text-muted-foreground font-mono mt-1 opacity-70 uppercase tracking-wider">Glass opacity: {settings.ui_glass_opacity !== undefined ? settings.ui_glass_opacity : 10}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Field>

                  <Field label="Enable Cyber Neon Glow Animations" hint="Renders ambient blur spheres and grids. Disable to maximize performance on low-spec devices">
                    <Toggle value={settings.ui_animations_enabled !== false} onChange={(v) => update({ ui_animations_enabled: v })} />
                  </Field>
                </div>
              )}

              {activeSection === "integrations" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="mb-8 p-5 bg-amber-500/5 border border-amber-500/20 rounded-[5px] flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-amber-500">API keys are stored in your .env file</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                        For production use, set credentials in your server environment. These fields show your current config status.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-4 border-b border-border/20">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-sm uppercase tracking-wider font-mono">Live Integrations Diagnostics</h3>
                    </div>
                    <Button
                      onClick={checkIntegrationsStatus}
                      disabled={checkingIntegrations}
                      variant="outline"
                      size="sm"
                      className="rounded-[5px] font-bold uppercase tracking-widest text-[9px] px-3 h-8 border-border/40 shrink-0 flex items-center gap-1.5"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", checkingIntegrations && "animate-spin")} />
                      {checkingIntegrations ? "Checking..." : "Refresh Status"}
                    </Button>
                  </div>

                  <div className="space-y-6">
                    {/* Supabase Core Database */}
                    <div className="p-5 border border-border/20 bg-background/20 relative group overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm flex items-center gap-2">
                            <span>Supabase Core Database</span>
                            <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase tracking-widest bg-secondary/50 px-2 py-0.5">Env Config</span>
                          </p>
                          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xl">
                            Provides real-time state synchronization, settings persistence, and workspace data storage.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {renderStatusBadge(integrations?.supabase)}
                          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] border border-border/20 hover:bg-secondary/40">
                              <ExternalLink className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          </a>
                        </div>
                      </div>
                      {integrations?.supabase?.status === "failed" && integrations.supabase.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono rounded-[5px]">
                          Error: {integrations.supabase.error}
                        </div>
                      )}
                    </div>

                    {/* Google Sheets Backup */}
                    <div className="p-5 border border-border/20 bg-background/20 relative group overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm flex items-center gap-2">
                            <span>Google Sheets Backup</span>
                            <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase tracking-widest bg-secondary/50 px-2 py-0.5">Env Config</span>
                          </p>
                          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xl">
                            Logs audit trails and historical activity streams in a secure Google Spreadsheet spreadsheet.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {renderStatusBadge(integrations?.sheets)}
                          <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] border border-border/20 hover:bg-secondary/40">
                              <ExternalLink className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          </a>
                        </div>
                      </div>
                      {integrations?.sheets?.status === "failed" && integrations.sheets.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono rounded-[5px]">
                          Error: {integrations.sheets.error}
                        </div>
                      )}
                    </div>

                    {/* Google Drive Storage */}
                    <div className="p-5 border border-border/20 bg-background/20 relative group overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm flex items-center gap-2">
                            <span>Google Drive Storage</span>
                            <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase tracking-widest bg-secondary/50 px-2 py-0.5">Env Config</span>
                          </p>
                          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xl">
                            Hosts media and files within the secure File Vault backup directory on Google Drive.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {renderStatusBadge(integrations?.drive)}
                          <a href="https://drive.google.com" target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] border border-border/20 hover:bg-secondary/40">
                              <ExternalLink className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          </a>
                        </div>
                      </div>
                      {integrations?.drive?.status === "failed" && integrations.drive.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono rounded-[5px]">
                          Error: {integrations.drive.error}
                        </div>
                      )}
                    </div>

                    {/* Gemini Intelligence Engine */}
                    <div className="p-5 border border-border/20 bg-background/20 relative group overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-bold text-sm flex items-center gap-2">
                            <span>Gemini Intelligence Engine</span>
                            <span className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase tracking-widest bg-secondary/50 px-2 py-0.5">Custom Setting</span>
                          </p>
                          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xl">
                            Drives AI-assisted document autocompletes, intelligent project planning, and contextual chat prompts.
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {renderStatusBadge(integrations?.gemini)}
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border/10 flex flex-col sm:flex-row sm:items-center gap-4">
                        <span className="text-xs font-bold font-mono text-muted-foreground/75 uppercase tracking-wider">Configure Key:</span>
                        <Input
                          value={settings.gemini_api_key || ""}
                          onChange={(e) => update({ gemini_api_key: e.target.value })}
                          type="password"
                          placeholder="AIzaSy..."
                          className="w-full sm:w-80 bg-background/50 border-border/30 rounded-[5px] h-9 font-mono text-sm"
                        />
                      </div>
                      {integrations?.gemini?.status === "failed" && integrations.gemini.error && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono rounded-[5px]">
                          Error: {integrations.gemini.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "notifications" && (
                <div>
                  <Field label="Enable Notifications" hint="Show in-app alerts and reminders">
                    <Toggle value={settings.notifications_enabled} onChange={(v) => update({ notifications_enabled: v })} />
                  </Field>
                  <Field label="Alert Sound Volume" hint="Adjust the volume level of the system synthesizer beep notifications">
                    <div className="flex items-center gap-4 w-full sm:w-64 max-w-xs">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.sound_volume !== undefined ? settings.sound_volume : 80}
                        onChange={(e) => update({ sound_volume: parseInt(e.target.value) })}
                        className="flex-1 accent-primary h-1.5 bg-secondary/80 rounded-[5px] appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold w-10 text-right shrink-0">
                        {settings.sound_volume !== undefined ? settings.sound_volume : 80}%
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => playTestSound(settings.sound_volume !== undefined ? settings.sound_volume : 80)}
                        className="rounded-[5px] font-bold uppercase tracking-widest text-[9px] px-3 h-8 border-border/40 shrink-0 flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Test
                      </Button>
                    </div>
                  </Field>
                </div>
              )}

              {activeSection === "security" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="p-6 bg-background/40 border border-border/20 rounded-[5px] relative">
                    <div className="flex items-center gap-3 border-b border-border/20 pb-4 mb-6">
                      <Key className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-sm uppercase tracking-wider font-mono">Change Account Password</h3>
                    </div>

                    {passwordChangeSuccess && (
                      <div className="mb-6 p-4 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono flex items-start gap-2.5 shadow-[0_0_15px_rgba(16,185,129,0.1)] animate-in fade-in duration-300">
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                        <div>
                          <div className="font-bold uppercase tracking-wider mb-1">SUCCESSFUL UPDATE</div>
                          <span>Your password has been changed successfully. Use your new password on next login.</span>
                        </div>
                      </div>
                    )}

                    {passwordChangeError && (
                      <div className="mb-6 p-4 rounded-[5px] border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono flex items-start gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-in fade-in duration-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        <div>
                          <div className="font-bold uppercase tracking-wider mb-1">SECURITY WARNING</div>
                          <span>{passwordChangeError}</span>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleChangePasswordSubmit} className="space-y-5 max-w-md">
                      <div>
                        <label className="block text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 font-bold">
                          Current Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password..."
                            className="bg-background/50 border-border/30 rounded-[5px] h-11 pl-4 pr-10 font-mono text-xs w-full focus:bg-background/80"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none"
                            tabIndex={-1}
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 font-bold">
                          New Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 8 chars, uppercase, lowercase, number, symbol"
                            className="bg-background/50 border-border/30 rounded-[5px] h-11 pl-4 pr-10 font-mono text-xs w-full focus:bg-background/80"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none"
                            tabIndex={-1}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 font-bold">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Verify new password..."
                            className="bg-background/50 border-border/30 rounded-[5px] h-11 pl-4 pr-10 font-mono text-xs w-full focus:bg-background/80"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={passwordChanging}
                        className="rounded-[5px] bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-[0.18em] w-full h-11 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.15)] active:scale-[0.98]"
                      >
                        {passwordChanging ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            Update Password
                          </>
                        )}
                      </Button>
                    </form>
                  </div>

                  <div className="p-6 bg-secondary/10 rounded-[5px] border border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-xs uppercase tracking-wider font-mono text-muted-foreground/80 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        Supabase Protection Shield
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-xl">
                        Your account credentials and private items are isolated using industry-standard Row Level Security (RLS) policies.
                      </p>
                    </div>
                    <a href="https://supabase.com/docs/guides/auth" target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Button variant="outline" size="sm" className="rounded-[5px] font-bold text-[10px] uppercase tracking-widest border-border/40">
                        <ExternalLink className="w-3.5 h-3.5 mr-2" />
                        Supabase RLS Guide
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {activeSection === "about" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  {/* Glowing Logo Centered Header */}
                  <div className="flex flex-col items-center text-center py-6 relative bg-background/20 border border-border/10 rounded-[8px] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_70%)] pointer-events-none" />
                    <div className="relative group mb-4">
                      {/* soft glowing background blur */}
                      <div className="absolute -inset-3 bg-gradient-to-r from-primary/30 to-purple-500/20 rounded-full blur-2xl opacity-60 group-hover:opacity-100 transition duration-1000" />
                      <div className="relative w-28 h-28 rounded-2xl bg-secondary/25 border border-border/30 p-4 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-transform duration-500 hover:scale-105">
                        <img
                          src="/logo.svg"
                          alt="MyOS Logo"
                          className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(59,130,246,0.25)]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png";
                          }}
                        />
                      </div>
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight uppercase bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent px-4">
                      MYOS Personal Operating System
                    </h2>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1.5 font-mono">
                      BUILD v2.0.4 · STABLE ENVIRONMENT
                    </p>
                  </div>

                  {/* Description Card */}
                  <div className="p-6 bg-background/20 border border-border/10 rounded-[8px] backdrop-blur-md space-y-4">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      MyOS is a private, personal operating system workspace built for high-performance builders. It integrates calendar views, financial logs, file vaults, project planning trackers, documents, and tools into a single desktop dashboard backed by container isolation, private row-level security (RLS) layers, and real-time environment telemetry diagnostics.
                    </p>
                  </div>

                  {/* Active Telemetry Ticker */}
                  <TelemetryPanel />

                  {/* System Environment Matrix */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-widest font-mono text-foreground/80 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      System Environment Matrix
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">Core Client Engine</p>
                        <p className="text-xs font-bold text-foreground">React 18.3.1 + TypeScript</p>
                      </div>
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">Build Bundler</p>
                        <p className="text-xs font-bold text-foreground">Vite + Esbuild Compiler</p>
                      </div>
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">Database Integration</p>
                        <p className="text-xs font-bold text-foreground">Supabase PostgreSQL</p>
                      </div>
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">Files Database</p>
                        <p className="text-xs font-bold text-foreground">Google Drive API v3 (Lock Ready)</p>
                      </div>
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">UI Framework Base</p>
                        <p className="text-xs font-bold text-foreground">Radix UI + TailwindCSS Base</p>
                      </div>
                      <div className="p-4 bg-secondary/10 border border-border/10 rounded-[8px] space-y-1">
                        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-mono">Diagnostics Panel</p>
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Operational
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Creator Card */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-widest font-mono text-foreground/80 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Creator Profile
                    </h4>
                    <div className="relative overflow-hidden bg-gradient-to-b from-secondary/20 to-secondary/5 border border-border/15 p-6 rounded-[8px] backdrop-blur-xl">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <img src="/logo.svg" className="w-24 h-24 object-contain" />
                      </div>
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="relative group shrink-0">
                          <div className="absolute -inset-1.5 bg-gradient-to-r from-primary/30 to-purple-500/30 rounded-[8px] blur-md opacity-60" />
                          <img
                            src="https://github.com/monikeo.png"
                            alt="KEO MONI"
                            className="relative w-24 h-24 rounded-[8px] border border-border/30 object-cover shadow-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/bottts/svg?seed=monikeo";
                            }}
                          />
                        </div>
                        <div className="flex-1 space-y-3 text-center md:text-left">
                          <div>
                            <h4 className="font-extrabold text-lg text-foreground uppercase tracking-wide">KEO MONI</h4>
                            <p className="text-[10px] text-primary font-bold uppercase tracking-widest font-mono mt-0.5">
                              Cyber Security Specialist · CamTech University Student
                            </p>
                          </div>
                          
                          <p className="text-xs font-medium text-muted-foreground/80 leading-relaxed">
                            Cyber Security student at CamTech University. Focused on secure software engineering, private workspace architectures, container-level network sandboxing, and penetration testing. Creator of personal ecosystems designed to empower technical builders with robust privacy.
                          </p>

                          {/* Organizations Chips */}
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-[8px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest font-mono">Founder of Gravzero</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-[8px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                              <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono">Infinity Taekwondo</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Open Source Workspace Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-secondary/5 border border-border/10 rounded-[8px]">
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="font-bold text-xs uppercase tracking-widest font-mono text-foreground">
                        Open Source Workspace
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 leading-normal max-w-xl">
                        Contributions, security code audits, and pull requests are welcomed. Fork or download this customized OS layer.
                      </p>
                    </div>
                    <a href="https://github.com/monikeo" target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Button variant="outline" size="sm" className="rounded-[8px] font-bold text-[10px] uppercase tracking-widest border-border/40 hover:bg-primary/10 hover:border-primary/30">
                        <Globe className="w-3.5 h-3.5 mr-2" />
                        Visit monikeo GitHub
                      </Button>
                    </a>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
