import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export function KanbanViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-[8px]" />
          <Skeleton className="h-8 w-64 rounded-[8px]" />
          <Skeleton className="h-4 w-80 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-[8px]" />
          <Skeleton className="h-10 w-36 rounded-[8px]" />
        </div>
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[8px] bg-secondary/20 border border-border/50">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <Skeleton className="h-10 w-full rounded-[8px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-[8px]" />
          <Skeleton className="h-9 w-24 rounded-[8px]" />
          <Skeleton className="h-9 w-28 rounded-[8px]" />
        </div>
      </div>

      {/* Kanban Columns Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {["Backlog", "In Progress", "In Review", "Done"].map((col, idx) => (
          <div key={idx} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[8px] bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-4 w-20 rounded-[8px]" />
              </div>
              <Skeleton className="h-5 w-6 rounded-[8px]" />
            </div>

            <div className="space-y-3">
              {[1, 2, 3].map((cardIdx) => (
                <Card key={cardIdx} className="border border-border/50 rounded-[8px] shadow-sm glass-panel overflow-hidden">
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16 rounded-[8px]" />
                      <Skeleton className="h-4 w-12 rounded-[8px]" />
                    </div>
                    <Skeleton className="h-5 w-3/4 rounded-[8px]" />
                    <Skeleton className="h-3.5 w-full rounded-[8px]" />
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center justify-between pt-3 border-t border-border/20">
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-3 w-16 rounded-[8px]" />
                      </div>
                      <Skeleton className="h-4 w-14 rounded-[8px]" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-[8px]" />
          <Skeleton className="h-8 w-56 rounded-[8px]" />
          <Skeleton className="h-4 w-72 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-[8px]" />
          <Skeleton className="h-10 w-40 rounded-[8px]" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24 rounded-[8px]" />
              <Skeleton className="w-10 h-10 rounded-[8px]" />
            </div>
            <Skeleton className="h-8 w-16 rounded-[8px] mb-2" />
            <Skeleton className="h-3 w-36 rounded-[8px]" />
          </Card>
        ))}
      </div>

      {/* Projects Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-[8px]" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-32 rounded-[8px]" />
                  <Skeleton className="h-3 w-20 rounded-[8px]" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-[8px]" />
            </div>

            <Skeleton className="h-12 w-full rounded-[8px]" />

            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16 rounded-[8px]" />
                <Skeleton className="h-3 w-10 rounded-[8px]" />
              </div>
              <Skeleton className="h-2 w-full rounded-[8px]" />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((a) => (
                  <Skeleton key={a} className="w-7 h-7 rounded-full border-2 border-background" />
                ))}
              </div>
              <Skeleton className="h-4 w-20 rounded-[8px]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FinanceViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-[8px]" />
          <Skeleton className="h-8 w-60 rounded-[8px]" />
          <Skeleton className="h-4 w-80 rounded-[8px]" />
        </div>
        <Skeleton className="h-10 w-44 rounded-[8px]" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24 rounded-[8px]" />
              <Skeleton className="w-10 h-10 rounded-[8px]" />
            </div>
            <Skeleton className="h-8 w-28 rounded-[8px] mb-2" />
            <Skeleton className="h-3 w-32 rounded-[8px]" />
          </Card>
        ))}
      </div>

      {/* Chart + Summary Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/50 rounded-[8px] glass-panel p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-5 w-40 rounded-[8px]" />
            <Skeleton className="h-8 w-28 rounded-[8px]" />
          </div>
          <Skeleton className="h-72 w-full rounded-[8px]" />
        </Card>
        <Card className="border border-border/50 rounded-[8px] glass-panel p-6">
          <Skeleton className="h-5 w-36 rounded-[8px] mb-6" />
          <Skeleton className="h-56 w-56 rounded-full mx-auto mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-3.5 w-24 rounded-[8px]" />
                <Skeleton className="h-3.5 w-16 rounded-[8px]" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ledger Table Skeleton */}
      <Card className="border border-border/50 rounded-[8px] glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-5 w-44 rounded-[8px]" />
          <Skeleton className="h-9 w-64 rounded-[8px]" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-[8px] bg-secondary/20 border border-border/30">
              <div className="flex items-center gap-4">
                <Skeleton className="w-9 h-9 rounded-[8px]" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48 rounded-[8px]" />
                  <Skeleton className="h-3 w-28 rounded-[8px]" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Skeleton className="h-4 w-20 rounded-[8px]" />
                <Skeleton className="h-6 w-24 rounded-[8px]" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function CalendarViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-[8px]" />
          <Skeleton className="h-8 w-52 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-[8px]" />
          <Skeleton className="h-10 w-36 rounded-[8px]" />
        </div>
      </div>

      {/* Month Navigation & Controls */}
      <div className="flex items-center justify-between p-4 rounded-[8px] bg-secondary/20 border border-border/50">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-[8px]" />
          <Skeleton className="h-6 w-36 rounded-[8px]" />
          <Skeleton className="h-9 w-9 rounded-[8px]" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-[8px]" />
          <Skeleton className="h-9 w-20 rounded-[8px]" />
        </div>
      </div>

      {/* Calendar Matrix Skeleton */}
      <div className="border border-border/50 rounded-[8px] glass-panel overflow-hidden">
        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b border-border/40 bg-secondary/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <div key={i} className="p-3 text-center border-r border-border/20 last:border-none">
              <Skeleton className="h-4 w-10 mx-auto rounded-[8px]" />
            </div>
          ))}
        </div>

        {/* 5 Weeks of Cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[110px] p-2 border-r border-b border-border/20 last:border-r-0 space-y-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-5 rounded-[8px]" />
              </div>
              {i % 3 === 0 && <Skeleton className="h-5 w-full rounded-[8px]" />}
              {i % 5 === 0 && <Skeleton className="h-5 w-3/4 rounded-[8px]" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotesViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-[8px]" />
          <Skeleton className="h-8 w-48 rounded-[8px]" />
          <Skeleton className="h-4 w-72 rounded-[8px]" />
        </div>
        <Skeleton className="h-10 w-36 rounded-[8px]" />
      </div>

      {/* Search & Tags */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-[8px] bg-secondary/20 border border-border/50">
        <Skeleton className="h-10 max-w-sm w-full rounded-[8px]" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-[8px]" />
          <Skeleton className="h-8 w-16 rounded-[8px]" />
          <Skeleton className="h-8 w-20 rounded-[8px]" />
        </div>
      </div>

      {/* Dual Pane or Masonry Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-4">
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-3/4 rounded-[8px]" />
              <Skeleton className="w-5 h-5 rounded-[8px]" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full rounded-[8px]" />
              <Skeleton className="h-3.5 w-5/6 rounded-[8px]" />
              <Skeleton className="h-3.5 w-4/6 rounded-[8px]" />
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <Skeleton className="h-3 w-20 rounded-[8px]" />
              <Skeleton className="h-4 w-12 rounded-[8px]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function WorkspacesViewSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded-[8px]" />
          <Skeleton className="h-8 w-60 rounded-[8px]" />
          <Skeleton className="h-4 w-80 rounded-[8px]" />
        </div>
        <Skeleton className="h-10 w-44 rounded-[8px]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-[8px]" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-36 rounded-[8px]" />
                <Skeleton className="h-3 w-24 rounded-[8px]" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-[8px]" />
            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <Skeleton className="h-4 w-24 rounded-[8px]" />
              <Skeleton className="h-4 w-16 rounded-[8px]" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function FileVaultSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-[8px]" />
          <Skeleton className="h-8 w-52 rounded-[8px]" />
          <Skeleton className="h-4 w-72 rounded-[8px]" />
        </div>
        <Skeleton className="h-10 w-40 rounded-[8px]" />
      </div>

      {/* Storage Meter Skeleton */}
      <Card className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32 rounded-[8px]" />
          <Skeleton className="h-4 w-24 rounded-[8px]" />
        </div>
        <Skeleton className="h-3 w-full rounded-[8px]" />
      </Card>

      {/* Files Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-4 space-y-3 text-center">
            <Skeleton className="w-16 h-16 mx-auto rounded-[8px]" />
            <Skeleton className="h-4 w-3/4 mx-auto rounded-[8px]" />
            <Skeleton className="h-3 w-1/2 mx-auto rounded-[8px]" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-border/50 pb-6 space-y-2">
        <Skeleton className="h-4 w-32 rounded-[8px]" />
        <Skeleton className="h-8 w-60 rounded-[8px]" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-border/30 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-[8px]" />
        ))}
      </div>

      {/* Form Card Skeleton */}
      <Card className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-[8px]" />
            <Skeleton className="h-3.5 w-56 rounded-[8px]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-[8px]" />
              <Skeleton className="h-10 w-full rounded-[8px]" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DashboardViewSkeleton() {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Welcome Banner Skeleton */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-10">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32 rounded-[8px]" />
          <Skeleton className="h-10 w-80 rounded-[8px]" />
          <Skeleton className="h-4 w-96 rounded-[8px]" />
        </div>
        <Skeleton className="h-28 w-72 rounded-[8px]" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/50 rounded-[8px] glass-panel p-8">
            <div className="flex items-start justify-between mb-8">
              <Skeleton className="w-16 h-16 rounded-[8px]" />
              <Skeleton className="h-5 w-16 rounded-[8px]" />
            </div>
            <Skeleton className="h-3.5 w-24 rounded-[8px] mb-2" />
            <Skeleton className="h-10 w-28 rounded-[8px]" />
          </Card>
        ))}
      </div>

      {/* Grid: Task Feed & Workspace Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-border/50 rounded-[8px] glass-panel p-6 space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-border/20">
            <Skeleton className="h-5 w-44 rounded-[8px]" />
            <Skeleton className="h-5 w-20 rounded-[8px]" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-[8px] bg-secondary/10">
              <Skeleton className="w-8 h-8 rounded-[8px]" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-48 rounded-[8px]" />
                <Skeleton className="h-3 w-28 rounded-[8px]" />
              </div>
              <Skeleton className="h-5 w-16 rounded-[8px]" />
            </div>
          ))}
        </Card>

        <Card className="border border-border/50 rounded-[8px] glass-panel p-6 space-y-4">
          <Skeleton className="h-5 w-36 rounded-[8px] pb-4 border-b border-border/20" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[8px] bg-secondary/10">
              <Skeleton className="w-8 h-8 rounded-[8px]" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-28 rounded-[8px]" />
                <Skeleton className="h-3 w-16 rounded-[8px]" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/**
 * Unified ViewLoadingFallback dispatcher matching the active page
 */
export function ViewLoadingFallback({ view }: { view?: string }) {
  switch (view) {
    case "todo":
      return <KanbanViewSkeleton />;
    case "projects":
      return <ProjectsViewSkeleton />;
    case "finance":
      return <FinanceViewSkeleton />;
    case "calendar":
      return <CalendarViewSkeleton />;
    case "notes":
      return <NotesViewSkeleton />;
    case "workspaces":
      return <WorkspacesViewSkeleton />;
    case "docs":
      return <FileVaultSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "dashboard":
      return <DashboardViewSkeleton />;
    default:
      return <KanbanViewSkeleton />;
  }
}
