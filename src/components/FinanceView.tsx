import { useState, useEffect, useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, Clock, Search, Filter, Plus, PieChart as PieChartIcon, Calendar, Trash2, AlertTriangle, Save, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FinancialTransaction, Workspace, Project } from "@/src/types";
import { getItems, createItem, deleteItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export function FinanceView() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"All" | "income" | "expense">("All");
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string>("All");

  // Add transaction form fields
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"income" | "expense">("expense");
  const [newCategory, setNewCategory] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newWorkspaceId, setNewWorkspaceId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);

  // Deletion modal state
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txData, wsData, projData] = await Promise.all([
        getItems<FinancialTransaction>("transaction"),
        getItems<Workspace>("workspace"),
        getItems<Project>("project")
      ]);
      setTransactions(txData);
      setWorkspaces(wsData);
      setProjects(projData);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "All" || t.transaction_type === filterType;
      
      const matchesWorkspace = 
        filterWorkspaceId === "All" ||
        (filterWorkspaceId === "General" && !t.workspace_id) ||
        t.workspace_id === filterWorkspaceId;

      return matchesSearch && matchesType && matchesWorkspace;
    });
  }, [transactions, searchQuery, filterType, filterWorkspaceId]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.transaction_type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const dynamicChartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        dateStr: d.toISOString().split("T")[0],
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        income: 0,
        expense: 0
      };
    });

    filteredTransactions.forEach(t => {
      const tDate = t.date || (t as any).transaction_date || t.created_at?.split("T")[0];
      if (!tDate) return;
      const match = last7Days.find(day => day.dateStr === tDate);
      if (match) {
        if (t.transaction_type === "income") match.income += t.amount;
        else match.expense += t.amount;
      }
    });

    return last7Days;
  }, [filteredTransactions]);

  const handleCreateTransaction = async () => {
    if (!newDesc.trim() || !newAmount) return;
    
    const amountVal = parseFloat(newAmount);
    const newTx: FinancialTransaction = {
      id: crypto.randomUUID(),
      type: "transaction",
      description: newDesc,
      amount: amountVal,
      transaction_type: newTxType,
      category: newCategory || "General",
      date: newDate || new Date().toISOString().split("T")[0],
      workspace_id: newWorkspaceId || undefined,
      project_id: newProjectId || undefined
    };

    try {
      await createItem(newTx);
      
      // Dispatch normal notification
      window.dispatchEvent(
        new CustomEvent("myos:notification", {
          detail: {
            title: newTxType === "income" ? "Income Logged" : "Expense Logged",
            message: newTxType === "income"
              ? `Logged income of $${amountVal.toLocaleString()} for "${newDesc}".`
              : `Logged expense of $${amountVal.toLocaleString()} for "${newDesc}".`,
            category: "finance",
            link_to: "finance"
          }
        })
      );

      // Proactively trigger warnings
      if (newTxType === "expense") {
        if (newProjectId) {
          const activeProj = projects.find(p => p.id === newProjectId);
          if (activeProj && activeProj.budget) {
            const limit = activeProj.budget;
            const spent = transactions
              .filter(t => t.project_id === newProjectId && t.transaction_type === 'expense')
              .reduce((sum, tx) => sum + tx.amount, 0) + amountVal;

            if (spent >= limit) {
              window.dispatchEvent(
                new CustomEvent("myos:notification", {
                  detail: {
                    title: "CRITICAL: Project Budget Exceeded",
                    message: `Project "${activeProj.name}" has exceeded its budget of $${limit.toLocaleString()}! Current spent is $${spent.toLocaleString()}.`,
                    category: "finance",
                    link_to: "finance"
                  }
                })
              );
            } else if (spent >= limit * 0.75) {
              window.dispatchEvent(
                new CustomEvent("myos:notification", {
                  detail: {
                    title: "Warning: Low Project Budget",
                    message: `Project "${activeProj.name}" has consumed over 75% of its budget. Current spent is $${spent.toLocaleString()} / $${limit.toLocaleString()}.`,
                    category: "finance",
                    link_to: "finance"
                  }
                })
              );
            }
          }
        }

        if (amountVal >= 1000) {
          window.dispatchEvent(
            new CustomEvent("myos:notification", {
              detail: {
                title: "High Expense Warning",
                message: `High value transaction detected: $${amountVal.toLocaleString()} was logged for "${newDesc}".`,
                category: "finance",
                link_to: "finance"
              }
            })
          );
        }
      }

      setNewDesc("");
      setNewAmount("");
      setNewCategory("");
      setNewDate("");
      setNewWorkspaceId("");
      setNewProjectId("");
      setShowDeployForm(false);
      loadData();
    } catch (err) {
      console.error("Failed to create transaction:", err);
    }
  };

  const handleConfirmDeleteTx = async () => {
    if (!txToDelete) return;
    const txObj = transactions.find(t => t.id === txToDelete);
    try {
      await deleteItem(txToDelete);
      if (txObj) {
        window.dispatchEvent(
          new CustomEvent("myos:notification", {
            detail: {
              title: "Transaction Removed",
              message: `Transaction for "${txObj.description}" of $${txObj.amount.toLocaleString()} has been deleted.`,
              category: "finance",
              link_to: "finance"
            }
          })
        );
      }
      setTxToDelete(null);
      loadData();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8">
        <div className="space-y-3">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Finance</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Track your income, expenses, and net balance.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowDeployForm(!showDeployForm)}
            className="rounded-[5px] shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-[10px] px-6 h-11"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Workspace Node Filter Bar */}
      <div className="space-y-2 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60 font-mono">Filter Ledger by Workspace Node</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterWorkspaceId === "All" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterWorkspaceId("All")}
            className="rounded-[5px] text-[8px] uppercase tracking-widest font-bold h-8 px-4"
          >
            All Ledgers
          </Button>
          <Button
            variant={filterWorkspaceId === "General" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterWorkspaceId("General")}
            className="rounded-[5px] text-[8px] uppercase tracking-widest font-bold h-8 px-4"
          >
            General Transactions
          </Button>
          {workspaces.map(ws => (
            <Button
              key={ws.id}
              variant={filterWorkspaceId === ws.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterWorkspaceId(ws.id)}
              style={{
                borderColor: filterWorkspaceId === ws.id ? ws.color : undefined,
                color: filterWorkspaceId === ws.id ? "#ffffff" : ws.color,
                backgroundColor: filterWorkspaceId === ws.id ? ws.color : undefined
              }}
              className="rounded-[5px] text-[8px] uppercase tracking-widest font-bold h-8 px-4 transition-all duration-300"
            >
              {ws.name}
            </Button>
          ))}
        </div>
      </div>
      {/* Transaction Deployment Form */}
      {showDeployForm && (
        <div className="border border-primary/20 bg-primary/5 rounded-[5px] p-6 space-y-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold uppercase tracking-widest text-xs text-primary">Deploy Financial Node</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px]" onClick={() => setShowDeployForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Description (e.g. Supabase Server Premium)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs"
            />
            <Input
              type="number"
              placeholder="Amount ($)"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs"
            />
            <select
              value={newTxType}
              onChange={(e) => setNewTxType(e.target.value as "income" | "expense")}
              className="h-11 px-3 rounded-[5px] bg-background/50 border border-border/30 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="expense">Expense (Outflow)</option>
              <option value="income">Income (Inflow)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Category (e.g. Hosting, Food, Marketing)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs"
            />
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="bg-background/50 border-border/30 rounded-[5px] h-11 text-xs text-muted-foreground"
            />
            <select
              value={newWorkspaceId}
              onChange={(e) => setNewWorkspaceId(e.target.value)}
              className="h-11 px-3 rounded-[5px] bg-background/50 border border-border/30 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">General Transaction (No Workspace)</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.company || "Personal"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              className="h-11 px-3 rounded-[5px] bg-background/50 border border-border/30 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">No Linked Project</option>
              {projects
                .filter(p => !newWorkspaceId || p.workspace_id === newWorkspaceId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border/10">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeployForm(false);
                setNewDesc("");
                setNewAmount("");
                setNewCategory("");
                setNewDate("");
                setNewWorkspaceId("");
                setNewProjectId("");
              }}
              className="rounded-[5px] border-border/50 px-6 h-11 font-bold uppercase tracking-widest text-[9px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTransaction}
              disabled={!newDesc.trim() || !newAmount}
              className="rounded-[5px] bg-primary px-6 h-11 font-bold uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Transaction
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="bg-primary text-white border-none shadow-2xl overflow-hidden relative group rounded-[5px] p-2">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-[5px]-full -translate-y-32 translate-x-32 blur-[80px] group-hover:scale-125 transition-transform duration-1000" />
          <CardContent className="p-4 sm:p-8 relative z-10">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-white/10 rounded-[5px]">
                 <Wallet className="w-5 h-5 text-white" />
               </div>
               <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em] font-mono">Net Balance</p>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold mb-8 font-mono tracking-tighter tabular-nums truncate">${(totals.income - totals.expense).toLocaleString()}</h2>
            <div className="flex items-center gap-6">
              <Badge className="bg-white/10 text-emerald-300 font-bold text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-[5px] border border-white/5">
                <TrendingUp className="w-3.5 h-3.5 mr-2" />
                +12.4% PROJ
              </Badge>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] font-mono">CYCLE: CURRENT</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border/50 bg-secondary/10 backdrop-blur-xl hover:border-primary/50 transition-all duration-700 rounded-[5px] group">
          <CardContent className="p-4 sm:p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 rounded-[5px] bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-700">
                <TrendingUp className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mb-1.5 font-mono">Income</p>
                <h3 className="text-3xl font-bold font-mono tabular-nums group-hover:text-emerald-500 transition-colors">${totals.income.toLocaleString()}</h3>
              </div>
            </div>
            <div className="w-full bg-background/50 border border-border/10 h-3 rounded-[5px]-full overflow-hidden shadow-inner p-0.5">
              <div className="bg-emerald-500 h-full rounded-[5px]-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: '80%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-secondary/10 backdrop-blur-xl hover:border-red-500/50 transition-all duration-700 rounded-[5px] group">
          <CardContent className="p-4 sm:p-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 rounded-[5px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-700">
                <TrendingDown className="w-8 h-8" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mb-1.5 font-mono">Expenses</p>
                <h3 className="text-3xl font-bold font-mono tabular-nums group-hover:text-red-500 transition-colors">${totals.expense.toLocaleString()}</h3>
              </div>
            </div>
            <div className="w-full bg-background/50 border border-border/10 h-3 rounded-[5px]-full overflow-hidden shadow-inner p-0.5">
              <div className="bg-red-500 h-full rounded-[5px]-full shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-1000" style={{ width: '45%' }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <Card className="lg:col-span-2 border border-border/50 glass-panel overflow-hidden shadow-2xl rounded-[5px]">
          <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-border/50 bg-background/40 p-4 sm:p-10 gap-4">
            <div className="flex items-center gap-4">
               <PieChartIcon className="w-6 h-6 text-primary" />
               <CardTitle className="text-[10px] font-bold uppercase tracking-[0.4em] font-mono text-muted-foreground">Income & Expenses Chart</CardTitle>
            </div>
             <div className="flex bg-background/50 border border-border/20 rounded-[5px] p-1 shadow-inner w-full sm:w-auto">
                <Button variant="ghost" size="sm" className="rounded-[5px] px-6 bg-primary text-white font-bold text-[10px] uppercase tracking-widest flex-1 sm:flex-initial">WKLY</Button>
                <Button variant="ghost" size="sm" className="rounded-[5px] px-6 text-muted-foreground font-bold text-[10px] uppercase tracking-widest hover:text-foreground transition-colors flex-1 sm:flex-initial">MTLY</Button>
             </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-10 h-[300px] sm:h-[450px]" style={{ minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={dynamicChartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888888', fontSize: 10, fontWeight: 700}} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888888', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(23,23,23,0.9)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={4} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border/50 glass-panel overflow-hidden flex flex-col shadow-2xl rounded-[5px]">
          <CardHeader className="border-b border-border/50 bg-background/40 p-8 space-y-4">
            <CardTitle className="text-[10px] font-bold flex items-center gap-4 uppercase tracking-[0.4em] font-mono text-muted-foreground">
               <Clock className="w-6 h-6 text-primary" />
               Recent Transactions
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" />
                <Input 
                  placeholder="Search transactions..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-background/50 border-border/50 text-xs rounded-[5px] placeholder:uppercase placeholder:tracking-widest placeholder:text-[9px]"
                />
              </div>
              <div className="flex gap-1 p-1 bg-background/50 border border-border/50 rounded-[5px] shrink-0">
                {(["All", "income", "expense"] as const).map(type => (
                  <Button
                    key={type}
                    variant={filterType === type ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "rounded-[5px] text-[9px] uppercase tracking-widest font-bold h-7 px-3",
                      filterType === type ? "bg-background text-primary shadow-sm" : "text-muted-foreground opacity-70 hover:opacity-100"
                    )}
                  >
                    {type === "income" ? "IN" : type === "expense" ? "OUT" : "ALL"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-border/10">
              {filteredTransactions.length === 0 ? (
                <div className="p-20 text-center text-muted-foreground/20">
                  <TrendingDown className="w-20 h-20 mx-auto mb-6 opacity-5" />
                  <p className="text-[10px] font-bold uppercase tracking-widest font-mono">No transactions found</p>
                </div>
              ) : (
                filteredTransactions.slice(0, 50).map(t => {
                  const parentWorkspace = workspaces.find(w => w.id === t.workspace_id);
                  return (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-all group cursor-pointer border-l-4 border-transparent hover:border-primary">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className={cn(
                          "w-10 h-10 rounded-[5px] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500",
                          t.transaction_type === 'income' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                        )}>
                          {t.transaction_type === 'income' ? <Plus className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold group-hover:text-primary transition-colors truncate text-sm">{t.description}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[7.5px] font-bold uppercase tracking-[0.2em] opacity-40 border-border/50 font-mono px-1.5 py-0">{t.category}</Badge>
                            {parentWorkspace && (
                              <Badge 
                                style={{ borderColor: parentWorkspace.color, color: parentWorkspace.color }}
                                variant="outline" 
                                className="text-[7.5px] font-bold uppercase tracking-[0.2em] font-mono px-1.5 py-0 bg-background/40"
                              >
                                {parentWorkspace.name}
                              </Badge>
                            )}
                            {t.project_id && (
                              <Badge 
                                variant="outline" 
                                className="text-[7.5px] font-bold uppercase tracking-[0.2em] font-mono px-1.5 py-0 bg-background/40 border-primary/30 text-primary"
                              >
                                {projects.find(p => p.id === t.project_id)?.name || "Project"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all hover:bg-red-500/10 rounded-[5px] shrink-0"
                          onClick={(e) => { e.stopPropagation(); setTxToDelete(t.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <p className={cn(
                          "font-mono font-bold text-sm tracking-tighter tabular-nums shrink-0",
                          t.transaction_type === 'income' ? "text-emerald-500" : "text-foreground"
                        )}>
                          {t.transaction_type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
          <CardFooter className="p-6 border-t border-border/10 bg-background/20 mt-auto">
            <Button variant="ghost" className="w-full h-12 rounded-[5px] text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-secondary hover:text-primary transition-all shadow-inner">Generate Report</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Sleek Crimson Custom Warning Delete Modal */}
      {txToDelete && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-secondary/20 border border-red-500/40 max-w-md w-full p-8 shadow-2xl backdrop-blur-2xl rounded-[5px] relative space-y-6">
            <div className="flex items-center gap-4 text-red-500 mb-2">
              <div className="w-12 h-12 rounded-[5px] bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold uppercase tracking-widest text-sm text-foreground">Purge Transaction Node</h3>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest font-mono">DANGER ZONE</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              Are you sure you want to permanently delete this transaction? This action is irreversible and will immediately recalculate your cashflow.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/10">
              <Button
                variant="outline"
                className="rounded-[5px] border-border/50 px-6 h-10 font-bold uppercase tracking-widest text-[9px]"
                onClick={() => setTxToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-[5px] bg-red-500 hover:bg-red-600 px-6 h-10 font-bold uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                onClick={handleConfirmDeleteTx}
              >
                Confirm Purge
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
