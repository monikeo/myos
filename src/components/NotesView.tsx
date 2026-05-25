import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { Plus, Search, Pin, Tag, Trash2, Edit3, FileText, MoreVertical, Calendar, AlertTriangle, ChevronDown, ChevronLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Note } from "@/src/types";
import { getItems, createItem, updateItem, deleteItem } from "@/lib/api";
import { cn } from "@/lib/utils";

// Configure DOMPurify to mitigate reverse tabnabbing (target hijacking) on all anchor links
if (typeof window !== "undefined") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

function formatDateTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
}

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"All" | "Pinned">("All");
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [sizeOpen, setSizeOpen] = useState(false);

  const applyFontSize = (size: string) => {
    document.execCommand("fontSize", false, size);
  };

  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
    }
  }, [selectedNote?.id]);

  useEffect(() => {
    if (isEditing && editorRef.current && selectedNote) {
      editorRef.current.innerHTML = selectedNote.content;
    }
  }, [isEditing, selectedNote?.id]);

  const insertChecklist = () => {
    document.execCommand("insertHTML", false, `<input type="checkbox" class="w-4 h-4 rounded-[5px] bg-background border border-border/50 text-primary focus:ring-0 focus:ring-offset-0 shrink-0 mr-2 align-middle" />&nbsp;`);
  };

  const insertDate = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const selectedText = selection.toString().trim();
    if (!selectedText) return; // Do not insert current date if nothing is selected
    
    let date = new Date(selectedText);
    if (isNaN(date.getTime())) {
      const parsed = Date.parse(selectedText);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      } else {
        return; // Not a parseable date, ignore
      }
    }
    const dateStr = date.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    document.execCommand("insertHTML", false, `<span>${dateStr}</span>`);
  };

  const insertDateTime = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const selectedText = selection.toString().trim();
    if (!selectedText) return; // Do not insert current date-time if nothing is selected
    
    let date = new Date(selectedText);
    if (isNaN(date.getTime())) {
      const parsed = Date.parse(selectedText);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      } else {
        return; // Not a parseable date, ignore
      }
    }
    const dateTimeStr = date.toLocaleString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    document.execCommand("insertHTML", false, `<span>${dateTimeStr}</span>`);
  };

  const formatCurrency = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const selectedText = selection.toString().trim();
    const num = parseFloat(selectedText.replace(/[^0-9.-]/g, ""));
    if (!num || isNaN(num)) {
      document.execCommand("insertHTML", false, `<span>$</span>`);
    } else {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
      document.execCommand("insertHTML", false, `<span>${formatted}</span>`);
    }
  };

  useEffect(() => {
    loadNotes();
    const handleDataChanged = () => {
      loadNotes();
    };
    window.addEventListener("myos:data-changed", handleDataChanged);
    return () => window.removeEventListener("myos:data-changed", handleDataChanged);
  }, []);

  const loadNotes = async () => {
    try {
      const data = await getItems<Note>("note");
      setNotes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      type: "note",
      title: "New Note",
      content: "Start writing...",
      pinned: false,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await createItem(newNote);
    loadNotes();
    setSelectedNote(newNote);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!selectedNote) return;
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : selectedNote.content;
    const updatedNote = {
      ...selectedNote,
      title: editTitle,
      content: currentHtml,
      updated_at: new Date().toISOString()
    };
    await updateItem(updatedNote.id, updatedNote);
    setIsEditing(false);
    setSelectedNote(updatedNote);
    loadNotes();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    await deleteItem(noteToDelete);
    if (selectedNote?.id === noteToDelete) setSelectedNote(null);
    setNoteToDelete(null);
    loadNotes();
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                          n.content.toLowerCase().includes(search.toLowerCase());
    const matchesPinned = filterType === "All" || (filterType === "Pinned" && n.pinned);
    return matchesSearch && matchesPinned;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 h-auto md:h-[calc(100vh-14rem)] animate-in fade-in duration-700 slide-in-from-bottom-4">
      <div className={cn("md:col-span-1 flex flex-col gap-6", selectedNote && "hidden md:flex")}>
        <div className="flex flex-col gap-3 border-b border-border/50 pb-6">
          <Badge variant="outline" className="text-primary font-mono bg-primary/5 border-primary/20 tracking-widest px-3 py-1 uppercase text-[9px] font-bold">Notes</Badge>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
            <Button onClick={handleCreate} size="icon" className="rounded-[5px] bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:scale-105 transition-transform h-10 w-10">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-muted-foreground/80 font-medium text-base max-w-2xl leading-relaxed">Write down your thoughts, ideas, and general information</p>
        </div>
        <div className="relative group flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search notes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-secondary/30 border-border/20 rounded-[5px] h-12 focus:bg-background transition-all duration-500" 
            />
          </div>
          <Button 
            variant={filterType === "Pinned" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setFilterType(filterType === "Pinned" ? "All" : "Pinned")}
            className="h-12 w-12 rounded-[5px] bg-secondary/30 border border-border/20 hover:bg-secondary/50"
          >
            <Pin className={cn("w-4 h-4", filterType === "Pinned" ? "text-primary" : "text-muted-foreground")} />
          </Button>
        </div>
        <ScrollArea className="h-[320px] md:h-auto md:flex-1 border border-border/50 rounded-[5px] glass-panel shadow-2xl overflow-hidden">
          <div className="p-3 space-y-2">
            {filteredNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                className={cn(
                  "p-5 rounded-[5px] cursor-pointer transition-all flex items-start gap-4 group relative overflow-hidden border border-transparent",
                  selectedNote?.id === note.id 
                    ? "bg-primary text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)] border-primary/20" 
                    : "hover:bg-secondary/40 hover:border-border/30 text-muted-foreground hover:text-white"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-[5px] flex items-center justify-center shrink-0 shadow-inner",
                  selectedNote?.id === note.id ? "bg-white/10" : "bg-background border border-border/50"
                )}>
                  <FileText className={cn("w-5 h-5", selectedNote?.id === note.id ? "text-white" : "text-muted-foreground/60")} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className={cn("font-bold text-sm truncate uppercase tracking-tight", selectedNote?.id === note.id ? "text-white" : "text-foreground")}>{note.title}</h3>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={cn("text-[10px] truncate font-mono uppercase tracking-widest flex-1", selectedNote?.id === note.id ? "text-white/70" : "text-muted-foreground/50")}>
                      {stripHtml(note.content).substring(0, 30) || "Empty note"}
                    </p>
                    <span className={cn("text-[8px] font-mono shrink-0 uppercase tracking-wider", selectedNote?.id === note.id ? "text-white/50" : "text-muted-foreground/40")}>
                      {note.updated_at ? new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ""}
                    </span>
                  </div>
                </div>
                {note.pinned && <Pin className={cn("w-3 h-3 shrink-0", selectedNote?.id === note.id ? "text-white" : "text-primary")} />}
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className={cn(
                     "h-8 w-8 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity rounded-[5px]",
                     selectedNote?.id === note.id ? "hover:bg-white/10 text-white" : "hover:bg-red-500/10 text-red-500"
                   )}
                   onClick={(e) => handleDelete(note.id, e)}
                 >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className={cn("md:col-span-2 min-h-[500px] md:min-h-0 border border-border/50 rounded-[5px] glass-panel shadow-2xl overflow-hidden flex flex-col relative group/view", !selectedNote && "hidden md:flex")}>
        <div className="absolute top-0 right-0 p-8 pointer-events-none">
           <div className="w-64 h-64 bg-primary/5 rounded-[5px]-full blur-[100px] group-hover/view:bg-primary/10 transition-all duration-1000" />
        </div>
        {selectedNote ? (
          <>
            <div className="p-4 sm:p-10 border-b border-border/20 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-10">
              <div className="flex items-center gap-3 flex-1 min-w-0 relative z-10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden shrink-0 h-10 w-10 border border-border/20 rounded-[5px] bg-background/50 hover:bg-secondary" 
                  onClick={() => { setSelectedNote(null); setIsEditing(false); }}
                >
                  <ChevronLeft className="w-5 h-5 text-primary" />
                </Button>
                <div className="space-y-1.5 flex-1 min-w-0">
                  {isEditing ? (
                    <Input 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)}
                      className="text-xl sm:text-4xl font-extrabold tracking-tighter border-none px-0 h-auto focus-visible:ring-0 bg-transparent py-0"
                    />
                  ) : (
                    <h2 className="text-xl sm:text-4xl font-extrabold tracking-tighter uppercase truncate">{selectedNote.title}</h2>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 font-mono">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      UPDATED: {selectedNote.updated_at ? formatDateTime(selectedNote.updated_at) : formatDateTime(new Date().toISOString())}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <span>{selectedNote.tags?.join(", ") || "UNTAGGED"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 sm:gap-4 shrink-0 relative z-10">
                {isEditing ? (
                  <Button onClick={handleUpdate} className="bg-primary shadow-[0_0_20px_rgba(59,130,246,0.3)] rounded-[5px] font-bold uppercase tracking-widest text-[9px] sm:text-[10px] px-4 sm:px-8 h-10 sm:h-12 flex-1 sm:flex-initial">Save Note</Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] sm:text-[10px] px-4 sm:px-8 h-10 sm:h-12 flex-1 sm:flex-initial">
                    <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-primary" />
                    Edit Note
                  </Button>
                )}
                <div className="h-8 sm:h-10 w-[1px] bg-border/20 mx-1 sm:mx-2" />
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-[5px] bg-background/50 border border-border/50 hover:bg-secondary transition-all shrink-0">
                   <Pin className={cn("w-4 sm:w-5 sm:h-5", selectedNote.pinned ? "text-primary fill-primary" : "text-muted-foreground/60")} />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 sm:p-12 overflow-y-auto relative z-10 flex flex-col">
              {isEditing ? (
                <div className="flex flex-col h-full gap-4">
                  {/* curating high-tech floating tools bar */}
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-secondary/30 border border-border/20 rounded-[5px] overflow-x-auto shrink-0 select-none">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-[5px] font-extrabold text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("bold")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Bold (Ctrl+B)"
                    >
                      B
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-[5px] italic text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("italic")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Italic (Ctrl+I)"
                    >
                      I
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-[5px] underline text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("underline")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Underline (Ctrl+U)"
                    >
                      U
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-[5px] line-through text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("strikeThrough")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Strikethrough"
                    >
                      S
                    </Button>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    {/* Custom Premium Font Size Dropdown */}
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 rounded-[5px] font-bold text-[9px] uppercase tracking-widest hover:bg-primary/20 flex items-center gap-1"
                        onClick={() => setSizeOpen(!sizeOpen)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        Size <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      {sizeOpen && (
                        <div 
                          className="absolute left-0 top-full mt-1 bg-background border border-border shadow-2xl p-1 min-w-[100px] flex flex-col gap-1 z-50 rounded-[5px] bg-secondary/80 backdrop-blur-md"
                          onMouseLeave={() => setSizeOpen(false)}
                        >
                          {[
                            { label: "Small", value: "2" },
                            { label: "Normal", value: "3" },
                            { label: "Large", value: "5" },
                            { label: "X-Large", value: "7" }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                applyFontSize(opt.value);
                                setSizeOpen(false);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              className="text-left w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-colors"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] font-mono text-[9px] font-bold hover:bg-primary/20"
                      onClick={() => document.execCommand("formatBlock", false, "H1")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Heading 1"
                    >
                      H1
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] font-mono text-[9px] font-bold hover:bg-primary/20"
                      onClick={() => document.execCommand("formatBlock", false, "H2")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Heading 2"
                    >
                      H2
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] font-mono text-[9px] font-bold hover:bg-primary/20"
                      onClick={() => document.execCommand("formatBlock", false, "P")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Paragraph"
                    >
                      Paragraph
                    </Button>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 rounded-[5px] text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("insertUnorderedList")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Bullet List"
                    >
                      • Bullet List
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 rounded-[5px] text-xs hover:bg-primary/20"
                      onClick={() => document.execCommand("insertOrderedList")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Numbered List"
                    >
                      1. Numbered List
                    </Button>

                    {/* Checklist Tool */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 rounded-[5px] text-xs hover:bg-primary/20"
                      onClick={insertChecklist}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Checklist"
                    >
                      [✓] Checklist
                    </Button>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    {/* Insert Date / Date-Time */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] text-[9px] font-bold font-mono hover:bg-primary/20"
                      onClick={insertDate}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Insert Date"
                    >
                      Date
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] text-[9px] font-bold font-mono hover:bg-primary/20"
                      onClick={insertDateTime}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Insert Date & Time"
                    >
                      Date-Time
                    </Button>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    {/* Format Currency */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 rounded-[5px] font-bold text-xs hover:bg-primary/20"
                      onClick={formatCurrency}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Format selection as Currency ($)"
                    >
                      $ USD
                    </Button>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                     {/* Glowing Core Matrix Color Selectors */}
                     <div className="flex items-center gap-1.5 px-2">
                       {[
                         "default",
                         "#ef4444",
                         "#3b82f6",
                         "#10b981",
                         "#f59e0b",
                         "#a855f7"
                       ].map((color) => {
                         const isDefault = color === "default";
                         const displayColor = isDefault 
                           ? (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? "#ffffff" : "#09090b")
                           : color;
                         return (
                           <button
                             key={color}
                             type="button"
                             onClick={() => {
                               const actualColor = isDefault
                                 ? (document.documentElement.classList.contains('dark') ? "#ffffff" : "#09090b")
                                 : color;
                               document.execCommand("foreColor", false, actualColor);
                             }}
                             onMouseDown={(e) => e.preventDefault()}
                             style={{ backgroundColor: displayColor }}
                             className={cn(
                               "w-3.5 h-3.5 rounded-[5px]-full border hover:scale-125 transition-transform border-border/50",
                               isDefault && "border-foreground/30"
                             )}
                             title={isDefault ? "Default Text Color" : `Color ${color}`}
                           />
                         );
                       })}
                     </div>

                    <div className="w-[1px] h-4 bg-border/20 mx-1 shrink-0" />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 rounded-[5px] text-[9px] uppercase font-bold text-muted-foreground/60 hover:text-foreground"
                      onClick={() => document.execCommand("removeFormat")}
                      onMouseDown={(e) => e.preventDefault()}
                      title="Clear Formatting"
                    >
                      Clear
                    </Button>
                  </div>

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault();
                        if (e.shiftKey) {
                          document.execCommand("outdent");
                        } else {
                          document.execCommand("indent");
                        }
                      } else if (e.key === "Enter") {
                        const selection = window.getSelection();
                        if (selection && selection.anchorNode) {
                          let container = selection.anchorNode as Node;
                          while (container && container !== editorRef.current && !["P", "DIV", "LI"].includes((container as HTMLElement).tagName || "")) {
                            container = container.parentNode!;
                          }
                          
                          if (container && container instanceof HTMLElement) {
                            const hasCheckbox = container.querySelector('input[type="checkbox"]');
                            if (hasCheckbox) {
                              const text = container.textContent || "";
                              if (text.trim() === "") {
                                e.preventDefault();
                                container.innerHTML = "<br>";
                              } else {
                                e.preventDefault();
                                const newBlock = document.createElement(container.tagName);
                                newBlock.className = container.className;
                                newBlock.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded-[5px] bg-background border border-border/50 text-primary focus:ring-0 focus:ring-offset-0 shrink-0 mr-2 align-middle" />&nbsp;`;
                                container.parentNode?.insertBefore(newBlock, container.nextSibling);
                                
                                const range = document.createRange();
                                range.setStartAfter(newBlock.lastChild!);
                                range.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(range);
                              }
                            }
                          }
                        }
                      }
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
                        const cb = target as HTMLInputElement;
                        if (cb.checked) {
                          cb.setAttribute('checked', 'true');
                        } else {
                          cb.removeAttribute('checked');
                        }
                      }
                    }}
                    className="w-full flex-1 min-h-[450px] p-6 outline-none bg-background/20 border border-border/20 rounded-[5px] font-sans text-base leading-relaxed text-foreground overflow-y-auto prose dark:prose-invert max-w-none focus:border-primary/40 transition-colors"
                  />
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none prose-lg opacity-90 leading-loose">
                  {selectedNote.content.includes("</") || 
                   selectedNote.content.includes("<p>") || 
                   selectedNote.content.includes("<b>") || 
                   selectedNote.content.includes("<ul>") || 
                   selectedNote.content.includes("<i>") ? (
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedNote.content) }} />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedNote.content}
                    </ReactMarkdown>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-20 text-center relative z-10">
            <div className="w-24 h-24 rounded-[5px] bg-secondary/30 flex items-center justify-center mb-8 border border-border/10 shadow-2xl">
              <FileText className="w-12 h-12 text-primary opacity-20" />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-widest mb-3">No Note Selected</h3>
            <p className="max-w-sm text-muted-foreground/60 font-medium leading-relaxed">Select a note from the sidebar or create a new note to start writing.</p>
          </div>
        )}
      </div>

      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-background border border-red-500/30 p-8 rounded-[5px] max-w-sm w-full space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[5px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/5 text-[8px] font-mono tracking-widest px-2 py-0.5 rounded-[5px] font-bold uppercase mb-1">Warning</Badge>
                <h3 className="text-lg font-bold uppercase tracking-tight text-foreground">Confirm Deletion</h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this note? This action cannot be undone and will purge all document contents.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setNoteToDelete(null)}
                className="rounded-[5px] border-border/50 bg-background/50 hover:bg-secondary font-bold uppercase tracking-widest text-[9px] px-5 h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDelete}
                className="rounded-[5px] bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest text-[9px] px-6 h-10 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                Purge Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
