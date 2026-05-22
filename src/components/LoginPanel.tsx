import React, { useState } from "react";
import { login, register } from "@/lib/api";
import { Shield, Key, User as UserIcon, Lock, Sparkles, Terminal, Eye, EyeOff } from "lucide-react";

interface LoginPanelProps {
  onAuthSuccess: (user: any) => void;
}

export function LoginPanel({ onAuthSuccess }: LoginPanelProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleTitle, setRoleTitle] = useState("Member");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<{ field: string; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (
    fieldName: string,
    value: string,
    setter: (val: string) => void
  ) => {
    // Strict real-time check for high-risk injection patterns
    const unsafePattern = /[<>\'";]|--|\/\*/;
    if (unsafePattern.test(value)) {
      let details = "We found unsafe characters.";
      if (/[<>]/.test(value)) details = "HTML markup tags are not allowed.";
      else if (/['"`]/.test(value)) details = "SQL quote characters are not allowed.";
      else if (/;/.test(value)) details = "Terminators like ';' are not allowed.";
      else if (/--|\/\*/.test(value)) details = "Comment codes like '--' or '/*' are not allowed.";

      setSecurityAlert({
        field: fieldName,
        message: `Blocked unsafe text in ${fieldName}. ${details} Removed to keep your account safe.`
      });

      // Auto-clear alert after 5 seconds
      setTimeout(() => {
        setSecurityAlert(prev => prev?.field === fieldName ? null : prev);
      }, 5000);

      // Strip unsafe characters to sanitize
      const sanitized = value.replace(/[<>\'";]|--|\/\*/g, "");
      setter(sanitized);
      return;
    }

    setSecurityAlert(null);
    setter(value);
  };

  const validateStrictInput = (): string | null => {
    // 1. Double password check
    if (isRegistering && password !== confirmPassword) {
      return "Passwords are not the same.";
    }

    // 2. Anti-injection patterns (SQL injection, XSS / HTML tags)
    const unsafePattern = /[<>\'";]|--|\/\*|\*\/|xp_/;
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR|AND)\b/i;

    const fieldsToCheck = [
      { name: "Username", val: username },
      { name: "Your Name", val: displayName },
      { name: "Email Address", val: email }
    ];

    for (const field of fieldsToCheck) {
      if (!isRegistering && field.name !== "Username") continue;
      
      const val = field.val.trim();
      if (unsafePattern.test(val)) {
        return `Please do not use characters like <, >, ;, ', ", or -- in your ${field.name}.`;
      }
      if (sqlKeywords.test(val)) {
        return `Please do not use database commands in your ${field.name}.`;
      }
    }

    // 3. Username pattern check
    if (isRegistering) {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(username.trim())) {
        return "Your username must be between 3 and 20 letters or numbers.";
      }

      // 4. Password complexity check
      if (password.length < 8) {
        return "Your password must be at least 8 characters long.";
      }
      const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/])[A-Za-z\d@$!%*?&#_\-+=~^()\[\]{}|\\:,.?/]{8,}$/;
      if (!complexityRegex.test(password)) {
        return "Password must include an uppercase letter, a lowercase letter, a number, and a symbol like @, $, !, #, %, *, ?, or &.";
      }

      // 5. Email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return "Please enter a valid email address.";
      }

      // 6. Age verification
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        return "Please enter a valid date of birth.";
      }
      const today = new Date();
      if (dobDate > today) {
        return "Date of birth cannot be in the future.";
      }
      const minAgeDate = new Date();
      minAgeDate.setFullYear(today.getFullYear() - 13);
      if (dobDate > minAgeDate) {
        return "You must be at least 13 years old to sign up.";
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || (isRegistering && (!displayName || !email || !dob || !confirmPassword))) {
      setError("Please fill in all the blanks.");
      return;
    }

    const validationError = validateStrictInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        const user = await register(username, password, displayName, roleTitle, undefined, email, dob);
        onAuthSuccess(user);
      } else {
        const user = await login(username, password);
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background cyber-grid">
      {/* Dynamic Cyber Glow Overlays matching Corporate Design */}
      <div className="absolute top-1/4 left-1/4 h-[30rem] w-[30rem] rounded-[5px]-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[30rem] w-[30rem] rounded-[5px]-full bg-primary/5 blur-[150px] pointer-events-none" />

      {/* Main Premium Glassmorphic sharp panel */}
      <div className="relative w-full max-w-[95vw] sm:max-w-[460px] p-8 rounded-[5px] border border-border/60 glass-panel shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-all duration-300">
        
        {/* Neon laser accent line */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(34,197,94,0.4)]" />

        {/* Corporate Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-[5px] border border-primary/20 bg-primary/5 text-primary shadow-[0_0_20px_rgba(34,197,94,0.08)]">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-widest text-foreground font-sans uppercase">
            MyOS Login & Register
          </h1>
          <p className="text-[9px] font-mono text-muted-foreground mt-2.5 uppercase tracking-[0.25em] flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-[5px] bg-primary animate-pulse" />
            Secure Login System
          </p>
        </div>

        {/* Security Alert Segment */}
        {securityAlert && (
          <div className="mb-6 p-4 rounded-[5px] border border-red-500/50 bg-red-950/20 text-red-400 text-xs font-mono flex items-start gap-2.5 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse">
            <Shield className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <div className="font-bold tracking-wider text-red-500 uppercase mb-1">
                ⚠️ BLOCKED UNSAFE INPUT
              </div>
              <span>{securityAlert.message}</span>
            </div>
          </div>
        )}

        {/* Alert Segment */}
        {error && !securityAlert && (
          <div className="mb-6 p-4 rounded-[5px] border border-destructive/30 bg-destructive/5 text-destructive text-xs font-mono flex items-start gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.03)]">
            <Terminal className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Access Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
              <UserIcon className="h-3.5 w-3.5 text-primary/70" /> {isRegistering ? "Username" : "Username or Email"}
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={username}
              onChange={(e) => handleInputChange("Username", e.target.value, setUsername)}
              placeholder={isRegistering ? "Enter your username..." : "Enter username or email address..."}
              className={`w-full h-11 px-4 rounded-[5px] bg-background/40 border text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:ring-1 focus:bg-background/70 transition-all ${
                securityAlert?.field === "Username"
                  ? "border-red-500 ring-1 ring-red-500 bg-red-950/10"
                  : "border-border/50 focus:border-primary/60 focus:ring-primary/50"
              }`}
            />
          </div>

          <div>
            <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
              <Lock className="h-3.5 w-3.5 text-primary/70" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-4 pr-10 rounded-[5px] bg-background/40 border text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:ring-1 focus:bg-background/70 transition-all border-border/50 focus:border-primary/60 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isRegistering && (
            <>
              <div>
                <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
                  <Lock className="h-3.5 w-3.5 text-primary/70" /> Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-4 pr-10 rounded-[5px] bg-background/40 border text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:ring-1 focus:bg-background/70 transition-all border-border/50 focus:border-primary/60 focus:ring-primary/50"
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

              <div>
                <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-primary/70" /> Your Name
                </label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={displayName}
                  onChange={(e) => handleInputChange("Your Name", e.target.value, setDisplayName)}
                  placeholder="Enter your name..."
                  className={`w-full h-11 px-4 rounded-[5px] bg-background/40 border text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:ring-1 focus:bg-background/70 transition-all ${
                    securityAlert?.field === "Your Name"
                      ? "border-red-500 ring-1 ring-red-500 bg-red-950/10"
                      : "border-border/50 focus:border-primary/60 focus:ring-primary/50"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
                  <span className="text-primary font-bold">@</span> Email Address
                </label>
                <input
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => handleInputChange("Email Address", e.target.value, setEmail)}
                  placeholder="e.g. user@myos.local"
                  className={`w-full h-11 px-4 rounded-[5px] bg-background/40 border text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:ring-1 focus:bg-background/70 transition-all ${
                    securityAlert?.field === "Email Address"
                      ? "border-red-500 ring-1 ring-red-500 bg-red-950/10"
                      : "border-border/50 focus:border-primary/60 focus:ring-primary/50"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5 font-semibold">
                  <span className="text-primary font-bold">📅</span> Date of Birth
                </label>
                <input
                  type="date"
                  required
                  disabled={loading}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full h-11 px-4 rounded-[5px] bg-background/40 border border-border/50 text-foreground placeholder:text-muted-foreground/30 font-mono text-xs focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/50 focus:bg-background/70 transition-all"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-[5px] bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs font-bold uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.15)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-[5px]-full animate-spin" />
            ) : (
              <>
                <Key className="h-3.5 w-3.5" />
                {isRegistering ? "Create Account" : "Login"}
              </>
            )}
          </button>
        </form>

        {/* Toggle link */}
        <div className="mt-6 text-center">
          <button
            disabled={loading}
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-[9px] font-mono text-muted-foreground/80 hover:text-primary transition-colors uppercase tracking-[0.15em]"
          >
            {isRegistering ? "Already have an account? Login here" : "New here? Register a new account"}
          </button>
        </div>

      </div>
    </div>
  );
}
