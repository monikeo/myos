import { useState, useEffect, useRef } from "react";
import { 
  Bell, 
  X, 
  Check, 
  Trash2, 
  Shield, 
  DollarSign, 
  CheckSquare, 
  FolderOpen, 
  Briefcase, 
  Info,
  Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MyOSNotification } from "@/src/types";

interface NotificationCenterProps {
  notifications: MyOSNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  navigateToPage: (page: any) => void;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDelete,
  navigateToPage
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "security":
        return <Shield className="w-4 h-4 text-rose-500 animate-pulse" />;
      case "finance":
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case "task":
        return <CheckSquare className="w-4 h-4 text-blue-500" />;
      case "file":
        return <FolderOpen className="w-4 h-4 text-amber-500" />;
      case "workspace":
        return <Briefcase className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const handleNotificationClick = (n: MyOSNotification) => {
    if (!n.read) {
      onMarkAsRead(n.id);
    }
    if (n.link_to) {
      navigateToPage(n.link_to);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "rounded-[5px] relative hover:bg-secondary group h-10 w-10 shrink-0 border border-transparent transition-all",
          isOpen && "bg-secondary border-border/50"
        )}
      >
        <Bell className={cn(
          "w-5 h-5 text-muted-foreground/70 group-hover:text-primary transition-colors",
          unreadCount > 0 && "animate-[bell-swing_1.5s_ease-in-out_infinite]"
        )} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-primary text-[9px] font-bold text-white px-1 flex items-center justify-center rounded-[5px] shadow-[0_0_10px_rgba(59,130,246,0.5)] font-mono animate-pulse">
            {unreadCount}
          </span>
        )}
      </Button>

      {/* Glassmorphic Dropdown Panel */}
      {isOpen && (
        <div className={cn(
          "absolute right-0 mt-3 w-80 sm:w-96 bg-secondary/95 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-[5px] z-50 overflow-hidden",
          "animate-in fade-in slide-in-from-top-3 duration-250 ease-out"
        )}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/30 bg-background/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-[0.25em] font-mono text-muted-foreground/80">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[9px] font-bold tracking-widest uppercase bg-primary/10 text-primary border border-primary/20 rounded-[5px] px-2 py-0.5">
                  {unreadCount} NEW
                </Badge>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={onMarkAllAsRead}
                  className="h-7 px-2.5 text-[8px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 hover:bg-transparent font-mono rounded-[5px]"
                >
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClearAll}
                  className="h-7 px-2.5 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-rose-500 hover:bg-transparent font-mono rounded-[5px]"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="px-5 py-2.5 border-b border-border/10 bg-background/25 flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "text-[9px] font-bold uppercase tracking-widest px-3 py-1 font-mono transition-all border border-transparent rounded-[5px]",
                filter === "all" 
                  ? "bg-secondary text-primary border-border/30" 
                  : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "text-[9px] font-bold uppercase tracking-widest px-3 py-1 font-mono transition-all border border-transparent rounded-[5px]",
                filter === "unread" 
                  ? "bg-secondary text-primary border-border/30" 
                  : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              Unread
            </button>
          </div>

          {/* Notifications Queue */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/10 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground/30">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-10" />
                <p className="text-[10px] font-bold uppercase tracking-widest font-mono">
                  {filter === "unread" ? "No unread alerts" : "Notification Queue Empty"}
                </p>
                <p className="text-[8px] text-muted-foreground/60 mt-1 uppercase tracking-wider font-mono">
                  System state stable.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-4 p-4 hover:bg-secondary/40 transition-all duration-300 relative group/notif",
                    !n.read && "bg-primary/[0.02]"
                  )}
                >
                  {/* Category Icon indicator */}
                  <div className="w-8 h-8 rounded-[5px] border border-border/30 bg-background flex items-center justify-center shrink-0 self-start shadow-inner">
                    {getCategoryIcon(n.category)}
                  </div>

                  {/* Body Content */}
                  <div 
                    onClick={() => handleNotificationClick(n)}
                    className="flex-1 min-w-0 cursor-pointer space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "font-bold text-xs truncate group-hover/notif:text-primary transition-all",
                        !n.read ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <Circle className="w-1.5 h-1.5 fill-primary text-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium">
                      {n.message}
                    </p>
                    {n.created_at && (
                      <p className="text-[8px] text-muted-foreground/45 font-mono uppercase font-bold tracking-wider">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col items-center justify-between shrink-0 md:opacity-0 md:group-hover/notif:opacity-100 opacity-100 transition-opacity gap-2">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onMarkAsRead(n.id)}
                        className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-background border border-transparent hover:border-border/30 rounded-[5px] shrink-0"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(n.id)}
                      className="h-6 w-6 text-rose-500 hover:text-rose-400 hover:bg-background border border-transparent hover:border-border/30 rounded-[5px] shrink-0"
                      title="Delete notification"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
