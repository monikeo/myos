import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  children: ReactNode;
  viewName: string;
  onNavigateHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[RouteErrorBoundary] Error captured in ${this.props.viewName}:`, error, errorInfo);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: {
            title: `Module Error: ${this.props.viewName.toUpperCase()}`,
            message: error.message || "An unexpected error occurred in this module.",
            category: "system",
            created_at: new Date().toISOString(),
          },
        })
      );
    }
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[460px] w-full flex items-center justify-center p-6 animate-in fade-in duration-300">
          <Card className="max-w-2xl w-full border border-destructive/40 bg-destructive/5 backdrop-blur-xl rounded-[8px] shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-destructive/20 bg-destructive/10 p-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-destructive/20 border border-destructive/30 flex items-center justify-center text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase tracking-widest text-destructive border-destructive/30 bg-destructive/10 px-2 py-0.5 rounded-[8px]">
                      FAULT DETECTED
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      // {this.props.viewName}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground mt-1">
                    Failed to render {this.props.viewName} module
                  </CardTitle>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A localized runtime error occurred within this view. The rest of your operating system remains fully functional. You can attempt to reinitialize this view or return to the main dashboard.
              </p>

              {this.state.error && (
                <div className="p-4 rounded-[8px] bg-background/80 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Diagnostic Message
                    </span>
                    <button
                      type="button"
                      onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                      className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      <Terminal className="w-3 h-3" />
                      {this.state.showDetails ? "Hide Stack" : "Show Technical Stack"}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-destructive break-words">
                    {this.state.error.message || "Unknown error"}
                  </p>

                  {this.state.showDetails && this.state.errorInfo?.componentStack && (
                    <pre className="mt-3 p-3 rounded-[8px] bg-secondary/50 border border-border/40 font-mono text-[10px] text-muted-foreground overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={this.handleReset}
                  className="rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold font-mono text-xs uppercase tracking-wider h-10 px-5 flex items-center gap-2 shadow-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Module
                </Button>

                {this.props.onNavigateHome && (
                  <Button
                    variant="outline"
                    onClick={this.props.onNavigateHome}
                    className="rounded-[8px] border-border/60 hover:bg-secondary/40 font-mono text-xs uppercase tracking-wider h-10 px-4 flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Return to Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
