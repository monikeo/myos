import React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ThemeToggleProps {
  currentTheme: "light" | "dark" | "system";
  isDarkMode: boolean;
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  collapsed?: boolean;
}

export function ThemeToggle({
  currentTheme,
  isDarkMode,
  onThemeChange,
  collapsed = false,
}: ThemeToggleProps) {
  const options: Array<{ id: "light" | "dark" | "system"; label: string; icon: typeof Sun }> = [
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "Auto", icon: Laptop },
    { id: "dark", label: "Dark", icon: Moon },
  ];

  const cycleTheme = () => {
    if (currentTheme === "dark") onThemeChange("light");
    else if (currentTheme === "light") onThemeChange("system");
    else onThemeChange("dark");
  };

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={cycleTheme}
            className="w-9 h-9 rounded-[8px] border border-border/30 bg-secondary/40 hover:bg-secondary/70 flex items-center justify-center text-foreground transition-all duration-200 active:scale-95 shadow-sm"
            aria-label="Toggle theme mode"
          >
            {currentTheme === "system" ? (
              <Laptop className="w-4 h-4 text-primary transition-transform duration-300" />
            ) : isDarkMode ? (
              <Moon className="w-4 h-4 text-blue-400 transition-transform duration-300" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-mono text-[9px] uppercase tracking-wider rounded-[8px]">
          Theme: {currentTheme.toUpperCase()}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="w-full p-1 bg-secondary/40 rounded-[8px] border border-border/30 flex items-center gap-1 shadow-inner relative select-none">
      {options.map((opt) => {
        const isActive = currentTheme === opt.id;
        const Icon = opt.icon;

        return (
          <button
            key={opt.id}
            onClick={() => onThemeChange(opt.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-[8px] text-[8.5px] font-bold uppercase tracking-wider font-mono transition-all duration-200 cursor-pointer relative z-10",
              isActive
                ? "bg-background text-primary shadow-sm border border-border/40 font-extrabold"
                : "text-muted-foreground/80 hover:text-foreground hover:bg-background/30"
            )}
          >
            <Icon
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isActive && "scale-110",
                opt.id === "light" && "text-amber-500",
                opt.id === "dark" && "text-blue-400",
                opt.id === "system" && "text-emerald-500"
              )}
            />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
