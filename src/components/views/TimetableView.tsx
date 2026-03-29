import React, { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Filter, 
  Coffee, 
  GripVertical, 
  LayoutGrid,
  User,
  ShieldAlert,
  Crown,
  Download,
  X,
  RefreshCcw,
  Zap,
  Star,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  DragEndEvent, 
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { 
  Subject, 
  Teacher, 
  Section, 
  TimetableEntry, 
  GradeStructure, 
  Day, 
  SyncConstraint,
  SimultaneousConstraint,
  ElectiveGroup,
  ValidationResult
} from '../../types';
import { DAYS, validateTimetable } from '../../utils/scheduler';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Button, Card, Badge, Label } from '../UI';

import { toast } from 'sonner';

interface TimetableViewProps {
  entries: TimetableEntry[];
  setEntries: (entries: TimetableEntry[]) => void;
  subjects: Subject[];
  teachers: Teacher[];
  sections: Section[];
  gradeStructures: GradeStructure[] | Record<string, GradeStructure>;
  validationResults: Record<string, ValidationResult>;
  onAutoGenerate: () => void;
  onAutoGenerateForSection: (sectionId: string, keepExisting?: boolean) => void;
  syncConstraints: SyncConstraint[];
  simultaneousConstraints: SimultaneousConstraint[];
  electiveGroups: ElectiveGroup[];
  isDarkMode: boolean;
  searchQuery?: string;
}

interface DraggableSubjectProps {
  subject: Subject;
  teacher: Teacher;
  id: string;
  counts?: { sectionName: string, count: number, total: number }[];
}

const DraggableSubject: React.FC<DraggableSubjectProps> = ({ subject, teacher, id, counts }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: { subject, teacher }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex flex-col p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all",
        "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md",
        isDragging && "opacity-50 scale-95 z-50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 truncate">
            {subject.name}
          </span>
        </div>
        {counts && counts.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {counts.map((c, i) => (
              <div key={i} className="flex flex-col items-end gap-0.5">
                <Badge 
                  variant={c.count >= c.total ? "success" : (c.count === 0 ? "outline" : "default")}
                  className={cn(
                    "text-[8px] px-1.5 py-0 h-4 min-w-[35px] justify-center font-black",
                    c.count > c.total && "bg-rose-500 text-white border-none animate-pulse"
                  )}
                  title={`${c.sectionName}: ${c.count}/${c.total} assigned`}
                >
                  {c.count}/{c.total}
                </Badge>
                {counts.length === 1 && (
                  <span className="text-[7px] font-bold text-zinc-400 uppercase tracking-tighter">
                    {c.count >= c.total ? "Complete" : `${c.total - c.count} Left`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-tight truncate">
        <User size={12} className="text-zinc-300" />
        {teacher.name}
      </div>
    </div>
  );
};

// --- Draggable Elective Component ---
interface DraggableElectiveProps {
  group: ElectiveGroup;
  id: string;
  counts?: { sectionName: string, count: number, total: number }[];
}

const DraggableElective: React.FC<DraggableElectiveProps> = ({ group, id, counts }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: { group, type: 'elective' }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex flex-col p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all",
        "bg-gold-50 dark:bg-gold-900/10 border-gold-200 dark:border-gold-800/50 shadow-sm hover:shadow-md",
        isDragging && "opacity-50 scale-95 z-50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Star size={14} className="text-gold-500 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100 truncate">
            {group.name}
          </span>
        </div>
        {counts && counts.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {counts.map((c, i) => (
              <Badge 
                key={i} 
                variant={c.count >= c.total ? "success" : "default"}
                className="text-[8px] px-1 py-0 h-4 min-w-[30px] justify-center bg-gold-200/50 text-gold-700 border-gold-300"
                title={c.sectionName}
              >
                {c.count}/{c.total}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-tight truncate italic">
        Elective Group
      </div>
    </div>
  );
};

// --- Draggable Entry Component (for grid) ---
interface DraggableEntryProps {
  entry: TimetableEntry;
  subject?: Subject;
  teacher?: Teacher;
  validation?: ValidationResult;
  onDelete: () => void;
  electiveGroups: ElectiveGroup[];
}

const DraggableEntry: React.FC<DraggableEntryProps> = ({ 
  entry, 
  subject, 
  teacher, 
  validation, 
  onDelete,
  electiveGroups
}) => {
  const isElective = !!entry.electiveGroupId;
  const electiveGroup = isElective ? electiveGroups.find(eg => eg.id === entry.electiveGroupId) : null;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { entry, subject, teacher, type: 'grid-entry' }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-2 h-full flex flex-col justify-between transition-all relative z-10 group",
        !validation?.isValid && "bg-rose-50/50 dark:bg-rose-900/20 hover:bg-rose-100/50 dark:hover:bg-rose-900/40",
        isDragging && "opacity-0",
        isElective && "bg-gold-50/30 dark:bg-gold-900/10"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div 
            {...listeners} 
            {...attributes}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors print:hidden grip-handle"
          >
            <GripVertical size={10} className="text-zinc-400" />
          </div>
          <div className="w-1.5 h-1.5 rounded-full shrink-0 print:hidden" style={{ backgroundColor: isElective ? '#EAB308' : subject?.color }} />
          <span className="subject-name text-[10px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {isElective ? (electiveGroup?.name || 'Elective') : subject?.name}
          </span>
        </div>
        <div className="entry-controls flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-zinc-300 hover:text-rose-500 transition-all"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>
      
      <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-400 font-medium print:text-zinc-900 print:text-[10px] print:font-bold">
        <User size={10} className="shrink-0 print:hidden" />
        <span className="teacher-name print:before:content-['('] print:after:content-[')'] print:whitespace-normal print:break-words">
          {isElective ? 'Multiple' : teacher?.name}
        </span>
      </div>
    </div>
  );
};

// --- Droppable Cell Component ---
interface DroppableCellProps {
  day: Day;
  periodIndex: number;
  sectionId: string;
  children: React.ReactNode;
  isOver?: boolean;
  isDragging?: boolean;
  validation?: ValidationResult;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ day, periodIndex, sectionId, children, isOver, isDragging, validation }) => {
  const { setNodeRef } = useDroppable({
    id: `cell-${sectionId}-${day}-${periodIndex}`,
    data: { day, periodIndex, sectionId }
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "h-full w-full transition-all relative min-h-[80px] group flex flex-col",
        isDragging && "bg-zinc-50/50 dark:bg-zinc-900/20",
        isOver && "bg-gold-100/30 dark:bg-gold-900/20 border-2 border-solid border-gold-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]"
      )}
    >
      {children}

      {/* Tooltip for violations moved to cell hover */}
      {validation?.errors && validation.errors.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-zinc-900/95 dark:bg-zinc-950/95 text-white text-[11px] rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-500 z-[100] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-gold-500/40 backdrop-blur-xl translate-y-4 group-hover:translate-y-0 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-rose-500 animate-pulse" />
              <p className="font-black uppercase tracking-[0.2em] text-gold-400">Conflict Detected</p>
            </div>
            <Badge variant="error" className="bg-rose-50/10 text-rose-400 border-rose-500/30 text-[8px] px-1.5 py-0">
              {validation.errors.length}
            </Badge>
          </div>
          <ul className="space-y-2.5">
            {validation.errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2.5 text-zinc-200 leading-relaxed group/item">
                <div className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                <span className="flex-1">{err}</span>
              </li>
            ))}
          </ul>
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-zinc-900/95 dark:border-t-zinc-950/95" />
        </div>
      )}
    </div>
  );
};

export const TimetableView: React.FC<TimetableViewProps> = ({
  entries = [],
  setEntries,
  subjects = [],
  teachers = [],
  sections = [],
  gradeStructures = [],
  validationResults = {},
  onAutoGenerate,
  onAutoGenerateForSection,
  syncConstraints = [],
  simultaneousConstraints = [],
  electiveGroups = [],
  isDarkMode,
  searchQuery = ''
}) => {
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(sections && sections.length > 0 ? [sections[0].id] : []);
  const selectedSection = useMemo(() => {
    return sections?.find(s => s.id === selectedSectionIds[0]);
  }, [sections, selectedSectionIds]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [overData, setOverData] = useState<{day: Day, periodIndex: number, sectionId: string} | null>(null);
  const [viewMode, setViewMode] = useState<'section' | 'teacher'>('section');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [currentIssueIndex, setCurrentIssueIndex] = useState(-1);

  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState(false);

  const renderTimetableCard = (sectionId: string, isComparison: boolean = false) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return null;
    const structure = Array.isArray(gradeStructures) 
      ? gradeStructures.find(g => g.id === section.gradeId) 
      : gradeStructures[section.gradeId];
    if (!structure) return null;

    return (
      <motion.div 
        key={sectionId}
        layout
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden print:border-none print:shadow-none flex flex-col",
          isComparison ? "max-h-[60vh] shadow-2xl" : "max-h-[70vh]"
        )}
      >
        <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">{section.name}</h2>
            <Badge variant="default" className="text-[8px]">{structure.name}</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onAutoGenerateForSection(sectionId, true)}
              className="h-7 px-2 text-[8px] font-black uppercase tracking-widest text-emerald-600 border-emerald-100 hover:bg-emerald-50 dark:border-emerald-900/30 dark:hover:bg-emerald-900/20"
            >
              <Plus size={10} className="mr-1" /> Fill Gaps
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (window.confirm(`Clear all entries for ${section.name}?`)) {
                  setEntries(entries.filter(e => e.sectionId !== sectionId));
                  toast.success(`Cleared ${section.name}`);
                }
              }}
              className="h-7 w-7 p-0 text-rose-500 border-rose-100 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/20"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
        <div className="overflow-auto custom-scrollbar flex-1">
          <table className="w-full border-collapse table-fixed min-w-[600px]">
            <thead className="sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="w-16 p-2 border-b border-zinc-100 dark:border-zinc-800"></th>
                {structure.slots.map((slot, sIdx) => (
                  <th 
                    key={slot.id} 
                    className={cn(
                      "p-2 border-b border-zinc-100 dark:border-zinc-800 text-center",
                      slot.type === 'break' && "w-12"
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        {slot.label}
                      </span>
                      <span className="text-[7px] font-medium text-zinc-400 uppercase tracking-tighter">
                        {slot.startTime}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day}>
                  <td className="p-2 border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-800/10 sticky left-0 z-10 bg-white dark:bg-zinc-900">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
                      {day.substring(0, 3)}
                    </span>
                  </td>
                  {structure.slots.map((slot, sIdx) => {
                    const pIdx = structure.slots.filter((s, i) => s.type === 'period' && i < sIdx).length;
                    
                    if (slot.type === 'break') {
                      return (
                        <td key={slot.id} className="bg-zinc-50/30 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800 text-center p-2">
                          <div className="flex flex-col items-center justify-center h-full gap-1">
                            <Coffee size={14} className="text-zinc-300" />
                            <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-400">{slot.label}</span>
                          </div>
                        </td>
                      );
                    }

                    const slotEntries = entries.filter(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx);
                    const isOver = overData?.day === day && overData?.periodIndex === pIdx && overData?.sectionId === sectionId;
                    const validation = slotEntries.length > 0 ? validationResults[slotEntries[0].id] : undefined;
                    const currentPreviewValidation = isOver && previewValidation ? previewValidation.results[previewValidation.targetEntryId] : undefined;

                    const groupedEntries: { type: 'single' | 'elective', id: string, entry?: TimetableEntry, entries?: TimetableEntry[] }[] = [];
                    const processedElectiveIds = new Set<string>();
                    
                    slotEntries.forEach(entry => {
                      if (entry.electiveGroupId) {
                        if (!processedElectiveIds.has(entry.electiveGroupId)) {
                          const egEntries = slotEntries.filter(e => e.electiveGroupId === entry.electiveGroupId);
                          groupedEntries.push({ type: 'elective', id: entry.electiveGroupId, entries: egEntries });
                          processedElectiveIds.add(entry.electiveGroupId);
                        }
                      } else {
                        groupedEntries.push({ type: 'single', id: entry.id, entry });
                      }
                    });

                    return (
                      <td 
                        key={slot.id} 
                        id={`cell-${sectionId}-${day}-${pIdx}`}
                        className="p-0 border-r border-b border-zinc-100 dark:border-zinc-800 last:border-r-0 relative group min-w-[150px] transition-all duration-500"
                      >
                        <DroppableCell 
                          day={day} 
                          periodIndex={pIdx} 
                          sectionId={sectionId}
                          isDragging={!!activeId}
                          isOver={isOver}
                          validation={currentPreviewValidation || validation}
                        >
                          {groupedEntries.length > 0 ? (
                            <div className="flex flex-col h-full divide-y divide-zinc-100 dark:divide-zinc-800">
                              {groupedEntries.map(group => {
                                if (group.type === 'elective' && group.entries) {
                                  const firstEntry = group.entries[0];
                                  return (
                                    <div key={group.id} className="flex-1 min-h-0">
                                      <DraggableEntry 
                                        entry={firstEntry}
                                        subject={undefined}
                                        teacher={undefined}
                                        validation={validationResults[firstEntry.id]}
                                        onDelete={() => setEntries(entries.filter(e => e.electiveGroupId !== group.id || e.day !== day || e.periodIndex !== pIdx))}
                                        electiveGroups={electiveGroups}
                                      />
                                    </div>
                                  );
                                }
                                if (group.type === 'single' && group.entry) {
                                  const entry = group.entry;
                                  const subject = subjects.find(s => s.id === entry.subjectId);
                                  const teacher = teachers.find(t => t.id === entry.teacherId);
                                  return (
                                    <div key={entry.id} className="flex-1 min-h-0">
                                      <DraggableEntry 
                                        entry={entry}
                                        subject={subject}
                                        teacher={teacher}
                                        validation={validationResults[entry.id]}
                                        onDelete={() => setEntries(entries.filter(e => e.id !== entry.id))}
                                        electiveGroups={electiveGroups}
                                      />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          ) : (
                            <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity min-h-[80px]">
                              <Plus size={14} className="text-zinc-200 dark:text-zinc-700" />
                            </div>
                          )}
                        </DroppableCell>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  const handleSectionArchitect = async (keepExisting: boolean = false) => {
    if (selectedSectionIds.length === 0) return;
    setIsArchitecting(true);
    const toastId = toast.loading(keepExisting ? "Filling gaps..." : "Architecting timetables...");
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 800));
    try {
      selectedSectionIds.forEach(id => onAutoGenerateForSection(id, keepExisting));
      toast.success(keepExisting ? "Gaps filled successfully!" : "Timetables generated!", { id: toastId });
    } catch (error) {
      console.error("Architect failed:", error);
      toast.error("Architecting failed. Please check constraints.", { id: toastId });
    } finally {
      setIsArchitecting(false);
    }
  };

  const handleResolveConflicts = async () => {
    if (selectedSectionIds.length === 0) return;
    setIsArchitecting(true);
    const toastId = toast.loading("Resolving teacher conflicts...");
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Simple conflict resolution: find double-booked teachers and try to move one entry to an empty slot
      let currentEntries = [...entries];
      let resolvedCount = 0;

      // Group entries by teacher, day, and period
      const teacherSlots: { [key: string]: TimetableEntry[] } = {};
      currentEntries.forEach(entry => {
        const key = `${entry.teacherId}-${entry.day}-${entry.periodIndex}`;
        if (!teacherSlots[key]) teacherSlots[key] = [];
        teacherSlots[key].push(entry);
      });

      // Find conflicts
      const conflicts = Object.values(teacherSlots).filter(list => list.length > 1);

      if (conflicts.length === 0) {
        toast.success("No teacher conflicts found!", { id: toastId });
        return;
      }

      conflicts.forEach(conflictList => {
        // Keep the first one, try to move the others
        for (let i = 1; i < conflictList.length; i++) {
          const entryToMove = conflictList[i];
          const section = sections.find(s => s.id === entryToMove.sectionId);
          if (!section) continue;
          const structure = Array.isArray(gradeStructures) 
            ? gradeStructures.find(g => g.id === section.gradeId) 
            : gradeStructures[section.gradeId];
          if (!structure) continue;

          // Find an empty slot for this section
          let moved = false;
          for (const day of DAYS) {
            for (let pIdx = 0; pIdx < structure.slots.filter(s => s.type === 'period').length; pIdx++) {
              const isSlotEmpty = !currentEntries.some(e => e.sectionId === entryToMove.sectionId && e.day === day && e.periodIndex === pIdx);
              const isTeacherFree = !currentEntries.some(e => e.teacherId === entryToMove.teacherId && e.day === day && e.periodIndex === pIdx);
              
              if (isSlotEmpty && isTeacherFree) {
                // Move entry
                const entryIdx = currentEntries.findIndex(e => e.id === entryToMove.id);
                if (entryIdx >= 0) {
                  currentEntries[entryIdx] = { ...currentEntries[entryIdx], day, periodIndex: pIdx };
                  moved = true;
                  resolvedCount++;
                  break;
                }
              }
            }
            if (moved) break;
          }
        }
      });

      setEntries(currentEntries);
      toast.success(`Resolved ${resolvedCount} teacher conflicts!`, { id: toastId });
    } catch (error) {
      console.error("Resolution failed:", error);
      toast.error("Failed to resolve conflicts.", { id: toastId });
    } finally {
      setIsArchitecting(false);
    }
  };

  const issues = useMemo(() => {
    const allIssues: { sectionId: string; day: Day; periodIndex: number; sectionName: string }[] = [];
    if (!sections || !gradeStructures) return allIssues;
    
    sections.forEach(section => {
      const structure = Array.isArray(gradeStructures) 
        ? gradeStructures.find(g => g.id === section.gradeId)
        : gradeStructures[section.gradeId];
      if (!structure || !structure.slots) return;
      
      const periodSlots = structure.slots.filter(s => s.type === 'period');
      DAYS.forEach(day => {
        periodSlots.forEach((_, pIdx) => {
          const slotEntries = entries.filter(e => e.sectionId === section.id && e.day === day && e.periodIndex === pIdx);
          if (slotEntries.length === 0) {
            allIssues.push({ sectionId: section.id, day, periodIndex: pIdx, sectionName: section.name });
          }
        });
      });
    });
    return allIssues;
  }, [sections, entries, gradeStructures]);

  const navigateToIssue = (index: number) => {
    if (index < 0 || index >= issues.length) return;
    const issue = issues[index];
    setCurrentIssueIndex(index);
    if (!selectedSectionIds.includes(issue.sectionId)) {
      setSelectedSectionIds(prev => [...prev, issue.sectionId]);
    }
    setViewMode('section');
    
    // Scroll to the cell after a short delay to allow UI to update
    setTimeout(() => {
      const cellId = `cell-${issue.sectionId}-${issue.day}-${issue.periodIndex}`;
      const element = document.getElementById(cellId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-rose-500', 'ring-offset-2', 'z-50');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-rose-500', 'ring-offset-2', 'z-50');
        }, 3000);
      }
    }, 200);
  };

  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      const query = searchQuery.toLowerCase();
      const gradeName = Array.isArray(gradeStructures) 
        ? gradeStructures.find(g => g.id === s.gradeId)?.name.toLowerCase() || ''
        : (gradeStructures as any)[s.gradeId]?.name.toLowerCase() || '';
      return s.name.toLowerCase().includes(query) || gradeName.includes(query);
    });
  }, [sections, searchQuery, gradeStructures]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [teachers, searchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      setOverData(over.data.current as any);
    } else {
      setOverData(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveId(null);
    setActiveData(null);
    setOverData(null);

    if (over) {
      const { day, periodIndex, sectionId } = over.data.current as { day: Day; periodIndex: number; sectionId: string };
      const activeData = active.data.current;

      if (activeData?.type === 'grid-entry') {
        const draggedEntry = activeData.entry as TimetableEntry;
        
        // Don't do anything if dropped on the same slot
        if (draggedEntry.day === day && draggedEntry.periodIndex === periodIndex && draggedEntry.sectionId === sectionId) return;

        // If it's an elective, move all entries in the group
        if (draggedEntry.electiveGroupId) {
          const electiveId = draggedEntry.electiveGroupId;
          const oldDay = draggedEntry.day;
          const oldPeriodIndex = draggedEntry.periodIndex;

          // Check if target cell has an entry
          const existingAtTarget = entries.find(e => 
            e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex
          );

          if (existingAtTarget) {
            // Swap logic for elective
            const updatedEntries = entries.map(e => {
              // If it's part of the dragged elective group at the old position
              if (e.electiveGroupId === electiveId && e.day === oldDay && e.periodIndex === oldPeriodIndex) {
                return { ...e, day, periodIndex }; // Keep original sectionId
              }
              // If it's the entry at the target position (could be another elective or single)
              if (e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex) {
                // If the target is ALSO an elective, we handle it below
                if (e.electiveGroupId) return e; 
                return { ...e, day: oldDay, periodIndex: oldPeriodIndex, sectionId: draggedEntry.sectionId };
              }
              return e;
            });

            // If the target was an elective, we need to move ALL its entries back
            if (existingAtTarget.electiveGroupId) {
              const targetEgId = existingAtTarget.electiveGroupId;
              const finalEntries = updatedEntries.map(e => {
                if (e.electiveGroupId === targetEgId && e.day === day && e.periodIndex === periodIndex) {
                  return { ...e, day: oldDay, periodIndex: oldPeriodIndex }; // Keep original sectionId
                }
                return e;
              });
              setEntries(finalEntries);
            } else {
              setEntries(updatedEntries);
            }
          } else {
            // Simple move for elective
            const updatedEntries = entries.map(e => {
              if (e.electiveGroupId === electiveId && e.day === oldDay && e.periodIndex === oldPeriodIndex) {
                return { ...e, day, periodIndex }; // Keep original sectionId
              }
              return e;
            });
            setEntries(updatedEntries);
          }
          return;
        }

        // Check if target cell has an entry
        const existingAtTarget = entries.find(e => 
          e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex
        );

        if (existingAtTarget) {
          // Swap
          const updatedEntries = entries.map(e => {
            if (e.id === draggedEntry.id) {
              return { ...e, day, periodIndex, sectionId };
            }
            if (e.id === existingAtTarget.id) {
              return { ...e, day: draggedEntry.day, periodIndex: draggedEntry.periodIndex, sectionId: draggedEntry.sectionId };
            }
            return e;
          });
          setEntries(updatedEntries);
        } else {
          // Move
          const updatedEntries = entries.map(e => 
            e.id === draggedEntry.id ? { ...e, day, periodIndex, sectionId } : e
          );
          setEntries(updatedEntries);
        }
      } else if (activeData?.subject && activeData?.teacher) {
        // From palette
        const { subject, teacher } = activeData as { subject: Subject; teacher: Teacher };

        // Check if this subject is already in this slot for this section
        const isDuplicate = entries.some(e => 
          e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex && e.subjectId === subject.id
        );
        if (isDuplicate) return;

        const newEntry: TimetableEntry = {
          id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          sectionId: sectionId,
          day,
          periodIndex,
          subjectId: subject.id,
          teacherId: teacher.id
        };

        setEntries([...entries, newEntry]);
      } else if (activeData?.type === 'elective' && activeData?.group) {
        // From palette (Elective)
        const group = activeData.group as ElectiveGroup;
        
        // Remove any existing entry for this slot
        const filteredEntries = entries.filter(e => 
          !(e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex)
        );

        // For electives, we need to create entries for ALL sections in the grade
        const gradeSections = sections.filter(s => s.gradeId === group.gradeId);
        const newElectiveEntries: TimetableEntry[] = gradeSections.map(sec => {
          const pair = group.subjectTeacherPairs[0]; 
          return {
            id: `elective-${Date.now()}-${sec.id}-${Math.random().toString(36).substr(2, 5)}`,
            sectionId: sec.id,
            day,
            periodIndex,
            subjectId: pair.subjectId,
            teacherId: pair.teacherId,
            electiveGroupId: group.id
          };
        });

        // Remove existing entries for all sections in this slot
        const finalFiltered = entries.filter(e => 
          !(gradeSections.some(gs => gs.id === e.sectionId) && e.day === day && e.periodIndex === periodIndex)
        );

        setEntries([...finalFiltered, ...newElectiveEntries]);
      }
    }
  };

  // Real-time validation for drag preview
  const previewValidation = useMemo(() => {
    if (!activeId || !overData) return null;
    
    const { day, periodIndex, sectionId } = overData;
    const activeEntry = activeData?.entry as TimetableEntry | undefined;
    
    let previewEntries: TimetableEntry[] = [];
    let targetEntryId = '';

    if (activeData?.type === 'grid-entry' && activeEntry) {
      targetEntryId = activeEntry.id;
      previewEntries = entries.map(e => e.id === activeEntry.id ? { ...e, day, periodIndex, sectionId } : e);
    } else if (activeData?.subject && activeData?.teacher) {
      targetEntryId = 'preview-entry';
      const newEntry: TimetableEntry = {
        id: targetEntryId,
        sectionId: sectionId,
        day,
        periodIndex,
        subjectId: activeData.subject.id,
        teacherId: activeData.teacher.id
      };
      const filtered = entries.filter(e => !(e.sectionId === sectionId && e.day === day && e.periodIndex === periodIndex));
      previewEntries = [...filtered, newEntry];
    } else {
      return null;
    }

    const results = validateTimetable(previewEntries, subjects, teachers, sections, syncConstraints, gradeStructures, simultaneousConstraints, electiveGroups);
    return { results, targetEntryId };
  }, [activeId, overData, activeData, entries, subjects, teachers, sections, syncConstraints, gradeStructures, simultaneousConstraints, electiveGroups]);

  const checkValidityForSlot = (day: Day, periodIndex: number, subject: Subject, teacher: Teacher, ignoreEntryId?: string, sectionId?: string) => {
    const targetSectionId = sectionId || selectedSection?.id;
    if (!targetSectionId) return false;

    const targetSection = sections.find(s => s.id === targetSectionId);
    if (!targetSection) return false;

    const targetStructure = Array.isArray(gradeStructures) 
      ? gradeStructures.find(g => g.id === targetSection.gradeId) 
      : gradeStructures[targetSection.gradeId];
    if (!targetStructure) return false;

    const targetPeriods = targetStructure.slots.filter(s => s.type === 'period');
    const currentSlot = targetPeriods[periodIndex];
    if (!currentSlot) return false;

    // 1. Teacher Overlap
    const teacherHasConflict = entries.some(e => {
      if (e.id === ignoreEntryId) return false;
      if (e.teacherId !== teacher.id || e.day !== day) return false;

      // Check if this overlap is actually a synchronized or simultaneous period
      const isSynchronized = syncConstraints.some(sync => 
        sync.day === day && 
        sync.periodIndex === periodIndex &&
        sync.sectionIds.includes(targetSectionId) &&
        sync.sectionIds.includes(e.sectionId)
      );
      if (isSynchronized) return false;

      const isSimultaneous = simultaneousConstraints.some(sim => {
        if (sim.isAlways) {
          return sim.sectionSubjectPairs.some(p => p.sectionId === targetSectionId) &&
                 sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId);
        }
        return sim.day === day && 
               sim.periodIndex === periodIndex &&
               sim.sectionSubjectPairs.some(p => p.sectionId === targetSectionId) &&
               sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId);
      });
      if (isSimultaneous) return false;

      const isElective = electiveGroups.some(eg => {
        return e.electiveGroupId === eg.id && entries.some(ce => ce.day === day && ce.periodIndex === periodIndex && ce.sectionId === targetSectionId && ce.electiveGroupId === eg.id);
      });
      if (isElective) return false;
      
      const otherSection = sections.find(s => s.id === e.sectionId);
      if (!otherSection) return false;
      
      const otherStructure = Array.isArray(gradeStructures) ? gradeStructures.find(g => g.id === otherSection.gradeId) : gradeStructures[otherSection.gradeId];
      if (!otherStructure) return false;
      const otherPeriods = otherStructure.slots.filter(s => s.type === 'period');
      const otherSlot = otherPeriods[e.periodIndex];
      
      if (!otherSlot) return false;

      return (
        currentSlot.startTime < otherSlot.endTime &&
        currentSlot.endTime > otherSlot.startTime
      );
    });

    if (teacherHasConflict) return false;

    // 2. Daily Limit
    const dailyCount = entries.filter(e => 
      e.id !== ignoreEntryId &&
      e.sectionId === targetSectionId && 
      e.day === day && 
      e.subjectId === subject.id
    ).length;
    if (dailyCount >= subject.maxPeriodsPerDay) return false;

    // 3. Weekly Limit
    const weeklyCount = entries.filter(e => 
      e.id !== ignoreEntryId &&
      e.sectionId === targetSectionId && 
      e.subjectId === subject.id
    ).length;
    if (weeklyCount >= subject.maxPeriodsPerWeek) return false;

    return true;
  };

  const exportToPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Store original scroll position
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const container = document.getElementById('timetable-container');
      if (!container) {
        alert('Timetable container not found.');
        return;
      }

      container.classList.add('exporting-pdf');
      
      // Wait for styles to settle and images to load
      await new Promise(resolve => setTimeout(resolve, 800));

      if (viewMode === 'teacher') {
        const teacherCards = container.querySelectorAll('.teacher-card');
        if (teacherCards.length === 0) {
          alert('No teacher timetables found.');
          container.classList.remove('exporting-pdf');
          return;
        }

        for (let i = 0; i < teacherCards.length; i++) {
          const card = teacherCards[i] as HTMLElement;
          const canvas = await html2canvas(card, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1400,
            onclone: (clonedDoc) => {
              // Replace oklch colors with standard ones in the cloned document
              const styleTags = clonedDoc.getElementsByTagName('style');
              for (let j = 0; j < styleTags.length; j++) {
                const tag = styleTags[j];
                if (tag.innerHTML.includes('oklch')) {
                  // Simple regex replacement for common oklch patterns to standard hex/rgb
                  // This is a safety measure in case some oklch colors still exist
                  tag.innerHTML = tag.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
                }
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const pdfImgWidth = pdfWidth - 20;
          const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
          
          if (i > 0) pdf.addPage();
          
          // Center vertically if it fits
          const yPos = pdfImgHeight < pdfHeight ? (pdfHeight - pdfImgHeight) / 2 : 10;
          pdf.addImage(imgData, 'PNG', 10, yPos, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
        }
      } else {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1400,
          ignoreElements: (el) => el.classList.contains('print:hidden') || el.classList.contains('no-print'),
          onclone: (clonedDoc) => {
            // Replace oklch colors with standard ones in the cloned document
            const styleTags = clonedDoc.getElementsByTagName('style');
            for (let j = 0; j < styleTags.length; j++) {
              const tag = styleTags[j];
              if (tag.innerHTML.includes('oklch')) {
                // Simple regex replacement for common oklch patterns to standard hex/rgb
                // This is a safety measure in case some oklch colors still exist
                tag.innerHTML = tag.innerHTML.replace(/oklch\([^)]+\)/g, '#000000');
              }
            }
          }
        });

        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfImgWidth = pdfWidth - 20;
        const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

        const yPos = pdfImgHeight < pdfHeight ? (pdfHeight - pdfImgHeight) / 2 : 10;
        pdf.addImage(imgData, 'PNG', 10, yPos, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
      }

      pdf.save(`rao_jr_ai_timetable_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      document.getElementById('timetable-container')?.classList.remove('exporting-pdf');
      setIsExporting(false);
      window.scrollTo(scrollX, scrollY);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in print:p-0">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm sticky top-24 z-30 print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('section')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                viewMode === 'section' ? "bg-white dark:bg-zinc-700 text-gold-600 dark:text-gold-400 shadow-sm" : "text-zinc-500"
              )}
            >
              <LayoutGrid size={14} /> Section View
            </button>
            <button 
              onClick={() => setViewMode('teacher')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                viewMode === 'teacher' ? "bg-white dark:bg-zinc-700 text-gold-600 dark:text-gold-400 shadow-sm" : "text-zinc-500"
              )}
            >
              <User size={14} /> Teacher View
            </button>
          </div>

          {viewMode === 'section' && (
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Label>Select Sections (Max 4)</Label>
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-tighter",
                  selectedSectionIds.length >= 4 ? "text-rose-500" : "text-zinc-400"
                )}>
                  {selectedSectionIds.length}/4 Selected
                </span>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setIsSectionDropdownOpen(!isSectionDropdownOpen)}
                  className="flex items-center justify-between w-full md:w-64 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:border-gold-500 transition-all shadow-sm"
                >
                  <span className="truncate">
                    {selectedSectionIds.length === 0 
                      ? 'Select Sections...' 
                      : sections.filter(s => selectedSectionIds.includes(s.id)).map(s => s.name).join(', ')
                    }
                  </span>
                  <ChevronDown size={14} className={cn("transition-transform", isSectionDropdownOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isSectionDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 backdrop-blur-sm bg-black/20" 
                        onClick={() => setIsSectionDropdownOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-full md:w-80 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden ring-1 ring-black/5"
                      >
                        <div className="p-2 border-b border-zinc-50 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
                          <button
                            onClick={() => {
                              if (selectedSectionIds.length === sections.length) {
                                setSelectedSectionIds([sections[0]?.id || '']);
                              } else {
                                setSelectedSectionIds(sections.slice(0, 4).map(s => s.id));
                              }
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-gold-600 dark:text-gold-400 hover:text-gold-700"
                          >
                            {selectedSectionIds.length === Math.min(sections.length, 4) ? 'Deselect All' : 'Select Top 4'}
                          </button>
                          <button 
                            onClick={() => setIsSectionDropdownOpen(false)}
                            className="p-1 text-zinc-400 hover:text-zinc-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
                          {filteredSections.map(s => {
                            const isSelected = selectedSectionIds.includes(s.id);
                            const isDisabled = !isSelected && selectedSectionIds.length >= 4;
                            return (
                              <button
                                key={s.id}
                                disabled={isDisabled}
                                onClick={() => {
                                  setSelectedSectionIds(prev => 
                                    prev.includes(s.id) 
                                      ? (prev.length > 1 ? prev.filter(id => id !== s.id) : prev)
                                      : [...prev, s.id]
                                  );
                                }}
                                className={cn(
                                  "flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-bold transition-all mb-1",
                                  isSelected 
                                    ? "bg-gold-500 text-white" 
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                  isDisabled && "opacity-30 cursor-not-allowed"
                                )}
                              >
                                <span>{s.name}</span>
                                {isSelected && <CheckSquare size={12} />}
                              </button>
                            );
                          })}
                          {filteredSections.length === 0 && (
                            <p className="text-[10px] text-zinc-400 italic text-center py-4">No matching sections found.</p>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Issue Navigator */}
          {issues.length > 0 && (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
              <div className="flex items-center gap-1.5 mr-2">
                <AlertCircle size={14} className="text-rose-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                  {issues.length} Blank Slots
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => navigateToIssue(currentIssueIndex <= 0 ? issues.length - 1 : currentIssueIndex - 1)}
                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-md transition-colors text-rose-600 dark:text-rose-400"
                  title="Previous Issue"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-bold text-rose-400 w-8 text-center">
                  {currentIssueIndex + 1}/{issues.length}
                </span>
                <button 
                  onClick={() => navigateToIssue(currentIssueIndex >= issues.length - 1 ? 0 : currentIssueIndex + 1)}
                  className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-md transition-colors text-rose-600 dark:text-rose-400"
                  title="Next Issue"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {viewMode === 'teacher' && (
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-zinc-400" />
              <select 
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-gold-500 transition-all min-w-[200px] text-zinc-900 dark:text-white"
              >
                <option value="all">All Faculty</option>
                {filteredTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'section' && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSectionArchitect(false)}
                disabled={isArchitecting}
                className="text-gold-600 border-gold-200 hover:bg-gold-50 dark:border-gold-900/30 dark:hover:bg-gold-900/20 shadow-sm min-w-[120px]"
              >
                {isArchitecting ? (
                  <RefreshCw size={14} className="mr-2 animate-spin" />
                ) : (
                  <Zap size={14} className="mr-2" />
                )}
                Architect
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleSectionArchitect(true)}
                disabled={isArchitecting}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-900/20 shadow-sm min-w-[120px]"
              >
                {isArchitecting ? (
                  <RefreshCw size={14} className="mr-2 animate-spin" />
                ) : (
                  <Plus size={14} className="mr-2" />
                )}
                Fill Gaps
              </Button>
            </div>
          )}
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onAutoGenerate}
            className="bg-gold-500 hover:bg-gold-600 text-white royal-shadow"
          >
            <RefreshCw size={14} className="mr-2" /> Global Architect
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToPDF}
            disabled={isExporting}
            className="text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800 shadow-sm"
          >
            {isExporting ? (
              <RefreshCw size={14} className="mr-2 animate-spin" />
            ) : (
              <Download size={14} className="mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <div id="timetable-container" className="relative bg-white dark:bg-zinc-900 transition-colors">
        <div className="print-header hidden print:block">
          <div className="border-b-2 border-zinc-900 pb-2 mb-4">
            <h1 className="text-xl font-bold text-zinc-900 uppercase">
              {viewMode === 'section' ? `Section: ${selectedSection?.name}` : (teacherFilter === 'all' ? 'Faculty Timetables' : `Faculty: ${teachers.find(t => t.id === teacherFilter)?.name}`)}
            </h1>
          </div>
        </div>

        <DndContext 
          sensors={sensors} 
          onDragStart={handleDragStart} 
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          {/* Main Timetable Grid */}
          <div className="md:col-span-3 space-y-8">
            {viewMode === 'section' ? (
              <>
                {/* Normal View (Inline) */}
                <div className={cn(
                  "grid gap-6 transition-all duration-500",
                  selectedSectionIds.length > 1 ? "opacity-20 blur-sm pointer-events-none scale-95" : "opacity-100 blur-0"
                )}>
                  {selectedSectionIds.length === 1 && renderTimetableCard(selectedSectionIds[0])}
                </div>

                {/* Pop-up Comparison View (Overlay) */}
                <AnimatePresence>
                  {selectedSectionIds.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-zinc-900/60 backdrop-blur-xl"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        className="relative w-full max-w-[95vw] max-h-[90vh] bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden border border-zinc-100 dark:border-zinc-800 flex flex-col"
                      >
                        {/* Header with Close Button */}
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50 shrink-0">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gold-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-gold-500/30">
                              <LayoutGrid size={24} />
                            </div>
                            <div>
                              <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-widest">Comparison Architect</h2>
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="text-[10px] bg-gold-100 text-gold-700 border-gold-200">{selectedSectionIds.length} Sections</Badge>
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Side-by-Side View</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => handleSectionArchitect(true)}
                              className="hidden md:flex items-center gap-2 h-10 px-4 text-xs font-black uppercase tracking-widest text-emerald-600 border-emerald-100 hover:bg-emerald-50 rounded-xl"
                            >
                              <Plus size={16} /> Fill Gaps
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={handleResolveConflicts}
                              className="hidden md:flex items-center gap-2 h-10 px-4 text-xs font-black uppercase tracking-widest text-amber-600 border-amber-100 hover:bg-amber-50 rounded-xl"
                            >
                              <LayoutGrid size={16} /> Resolve Conflicts
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                if (window.confirm("Clear all selected timetables?")) {
                                  setEntries(entries.filter(e => !selectedSectionIds.includes(e.sectionId)));
                                  toast.success("Cleared all selected sections");
                                }
                              }}
                              className="hidden md:flex items-center gap-2 h-10 px-4 text-xs font-black uppercase tracking-widest text-rose-600 border-rose-100 hover:bg-rose-50 rounded-xl"
                            >
                              <Trash2 size={16} /> Clear All
                            </Button>
                            <button 
                              onClick={() => setSelectedSectionIds([selectedSectionIds[0]])}
                              className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-rose-500 transition-all hover:scale-110 active:scale-95 shadow-sm"
                            >
                              <X size={24} />
                            </button>
                          </div>
                        </div>

                        {/* Comparison Grid */}
                        <div className="p-6 overflow-auto custom-scrollbar flex-1 bg-zinc-50/30 dark:bg-zinc-900/30">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full">
                            {selectedSectionIds.map(sectionId => renderTimetableCard(sectionId, true))}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              /* Teacher View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teachers
                  .filter(t => teacherFilter === 'all' || t.id === teacherFilter)
                  .map(teacher => {
                    const teacherEntries = entries.filter(e => e.teacherId === teacher.id);
                  const hasConflict = teacherEntries.some(e => !validationResults[e.id]?.isValid);
                  
                  // Find all unique grade structures used by this teacher to determine time slots
                  const relevantGradeIds = Array.from(new Set(
                    sections.filter(s => teacherEntries.some(e => e.sectionId === s.id)).map(s => s.gradeId)
                  ));
                  
                  // For simplicity in teacher grid, we use the first grade structure found or a default
                  const teacherGradeId = relevantGradeIds[0] || (Array.isArray(gradeStructures) ? gradeStructures[0]?.id : Object.keys(gradeStructures)[0]);
                  const teacherStructure = Array.isArray(gradeStructures) 
                    ? gradeStructures.find(g => g.id === teacherGradeId) 
                    : gradeStructures[teacherGradeId as string || ''];
                  const teacherPeriods = teacherStructure?.slots.filter(s => s.type === 'period') || [];

                  return (
                    <Card 
                      key={teacher.id} 
                      id={`teacher-card-${teacher.id}`}
                      className={cn(
                        "p-6 royal-shadow border-zinc-100 dark:border-zinc-800 teacher-card overflow-hidden",
                        hasConflict && "ring-1 ring-rose-500/30"
                      )}
                    >
                      <div className="hidden print:block print-header mb-6 border-b-2 border-zinc-200 pb-4">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{teacher.name}</h2>
                        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">Faculty Schedule</p>
                      </div>
                      <div className="flex items-center justify-between mb-6 print:hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gold-500/10 dark:bg-gold-500/20 rounded-2xl flex items-center justify-center text-gold-500 border border-gold-500/20">
                            <User size={24} />
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{teacher.name}</h3>
                            <p className="faculty-label text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Faculty Member</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 print-hidden-element">
                          <Badge variant={hasConflict ? "error" : "success"} className={cn(hasConflict && "animate-pulse")}>
                            {hasConflict ? <ShieldAlert size={10} className="mr-1" /> : <CheckCircle2 size={10} className="mr-1" />}
                            {hasConflict ? "Conflicts Detected" : "Schedule Valid"}
                          </Badge>
                        </div>
                      </div>

                      {/* Teacher Grid View */}
                      <div className="overflow-x-auto custom-scrollbar -mx-6 px-6">
                        <table className="w-full border-collapse min-w-[600px]">
                          <thead>
                            <tr>
                              <th className="w-24 p-2 border-b-2 border-gold-500/20"></th>
                              {teacherPeriods.map(slot => (
                                <th 
                                  key={slot.id} 
                                  className="p-2 border-b-2 border-gold-500/20 text-[10px] font-black uppercase tracking-widest text-zinc-400"
                                >
                                  <div className="flex flex-col items-center">
                                    <span>{slot.label}</span>
                                    <span className="text-[8px] font-medium lowercase tracking-tighter">{slot.startTime}</span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {DAYS.map(day => (
                              <tr 
                                key={day} 
                                className="group"
                              >
                                <td className="p-2 border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{day}</span>
                                </td>
                                {teacherPeriods.map((slot, pIdx) => {
                                  const entry = teacherEntries.find(e => e.day === day && e.periodIndex === pIdx);
                                  
                                  // Check if teacher is busy in an elective group
                                  const electiveGroup = electiveGroups.find(eg => 
                                    eg.subjectTeacherPairs.some(p => p.teacherId === teacher.id) &&
                                    entries.some(e => e.electiveGroupId === eg.id && e.day === day && e.periodIndex === pIdx)
                                  );

                                  const sub = subjects.find(s => s.id === entry?.subjectId);
                                  const sec = sections.find(s => s.id === entry?.sectionId);
                                  const validation = entry ? validationResults[entry.id] : null;

                                  return (
                                    <td 
                                      key={slot.id} 
                                      className={cn(
                                        "p-1 border border-zinc-100 dark:border-zinc-800 h-20 transition-all min-w-[120px]",
                                        (entry || electiveGroup) ? "bg-white dark:bg-zinc-800" : "bg-zinc-50/20 dark:bg-zinc-900/10"
                                      )}
                                    >
                                      {entry ? (
                                        <div className={cn(
                                          "h-full p-2 rounded-xl border flex flex-col justify-center relative group/cell",
                                          validation?.isValid ? "border-zinc-100 dark:border-zinc-700 shadow-sm" : "bg-rose-50/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
                                        )}>
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <LayoutGrid size={10} className="text-gold-500 shrink-0 print:hidden" />
                                            <span className="section-name text-[10px] font-black text-zinc-900 dark:text-zinc-100 uppercase print:whitespace-normal print:break-words">
                                              {sec?.name}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0 print:hidden" style={{ backgroundColor: sub?.color }} />
                                            <span className="subject-name text-[9px] font-bold text-zinc-400 uppercase print:text-zinc-900 print:whitespace-normal print:break-words">
                                              {sub?.name}
                                            </span>
                                          </div>
                                          
                                          {!validation?.isValid && (
                                            <>
                                              <div className="absolute inset-0 bg-rose-500/10 opacity-0 group-hover/cell:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                <ShieldAlert size={12} className="text-rose-500" />
                                              </div>
                                              {/* Tooltip for teacher view */}
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-zinc-900 dark:bg-zinc-950 text-white text-[9px] rounded-xl opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-all duration-300 z-50 shadow-2xl border border-gold-500/30 backdrop-blur-md translate-y-2 group-hover/cell:translate-y-0">
                                                <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/10">
                                                  <ShieldAlert size={10} className="text-rose-500" />
                                                  <p className="font-black uppercase tracking-widest text-gold-500">Violations</p>
                                                </div>
                                                <ul className="space-y-1.5">
                                                  {validation?.errors.map((err, i) => (
                                                    <li key={i} className="flex items-start gap-1.5 text-zinc-300">
                                                      <div className="w-1 h-1 rounded-full bg-rose-500 mt-1 shrink-0" />
                                                      {err}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      ) : electiveGroup ? (
                                        <div className="h-full p-2 rounded-xl border border-gold-200 dark:border-gold-800/50 bg-gold-50/30 dark:bg-gold-900/10 flex flex-col justify-center">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <Star size={10} className="text-gold-500 shrink-0" />
                                            <span className="text-[10px] font-black text-gold-600 dark:text-gold-400 uppercase truncate">
                                              {electiveGroup.name}
                                            </span>
                                          </div>
                                          <span className="text-[8px] font-bold text-zinc-400 uppercase">Occupied (Elective)</span>
                                        </div>
                                      ) : (
                                        <div className="h-full w-full flex items-center justify-center opacity-10 print:hidden">
                                          <div className="w-1 h-1 rounded-full bg-zinc-300" />
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Stats */}
                      <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-xl font-black text-zinc-900 dark:text-white">{teacherEntries.length}</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Total Periods</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-black text-zinc-900 dark:text-white">
                            {Array.from(new Set(teacherEntries.map(e => e.sectionId))).length}
                          </p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Classes</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-black text-rose-500">
                            {teacherEntries.filter(e => !validationResults[e.id]?.isValid).length}
                          </p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Conflicts</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar: Subject Palette */}
          <div className="space-y-6 sticky top-24 print:hidden">
            <Card className="p-6 royal-shadow border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gold-50 dark:bg-gold-900/20 rounded-lg flex items-center justify-center text-gold-500">
                    <Crown size={16} />
                  </div>
                  <h3 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">Subject Palette</h3>
                </div>
                
                {/* Color Legend */}
                <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-gold-500" />
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Elective</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-400" />
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Subject</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                {/* Elective Groups Palette */}
                {electiveGroups.filter(eg => selectedSectionIds.some(id => sections.find(s => s.id === id)?.gradeId === eg.gradeId)).map(eg => {
                  const counts = selectedSectionIds.map(sectionId => {
                    const section = sections.find(s => s.id === sectionId);
                    if (!section || section.gradeId !== eg.gradeId) return null;
                    const count = entries.filter(e => e.sectionId === sectionId && e.electiveGroupId === eg.id).length;
                    // For electives, required periods might be defined in the group or subject
                    // Let's assume the first subject in the group defines the required periods
                    const firstPair = eg.subjectTeacherPairs[0];
                    const subject = subjects.find(s => s.id === firstPair.subjectId);
                    return {
                      sectionName: section.name,
                      count,
                      total: subject?.maxPeriodsPerWeek || 0
                    };
                  }).filter(Boolean) as { sectionName: string, count: number, total: number }[];

                  return (
                    <div key={eg.id} className="space-y-2">
                      <DraggableElective 
                        group={eg} 
                        id={`palette-elective-${eg.id}`} 
                        counts={counts}
                      />
                    </div>
                  );
                })}

                {/* Combined Assignments for all selected sections */}
                {Array.from(new Set(selectedSectionIds.flatMap(id => sections.find(s => s.id === id)?.assignments.map(a => a.subjectId) || []))).map(subjectId => {
                  const subject = subjects.find(s => s.id === subjectId);
                  if (!subject) return null;
                  
                  const counts = selectedSectionIds.map(sectionId => {
                    const section = sections.find(s => s.id === sectionId);
                    if (!section) return null;
                    const assignment = section.assignments.find(a => a.subjectId === subjectId);
                    if (!assignment) return null;
                    const count = entries.filter(e => e.sectionId === sectionId && e.subjectId === subjectId && !e.electiveGroupId).length;
                    return {
                      sectionName: section.name,
                      count,
                      total: subject.maxPeriodsPerWeek
                    };
                  }).filter(Boolean) as { sectionName: string, count: number, total: number }[];

                  // Find first teacher for this subject in selected sections
                  const assignment = selectedSectionIds.flatMap(id => sections.find(s => s.id === id)?.assignments || []).find(a => a.subjectId === subjectId);
                  const teacher = teachers.find(t => t.id === assignment?.teacherId);
                  if (!teacher) return null;

                  return (
                    <div key={subjectId} className="space-y-2">
                      <DraggableSubject 
                        subject={subject} 
                        teacher={teacher} 
                        id={`palette-${subject.id}`} 
                        counts={counts}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Legend / Stats */}
            <Card className="p-6 bg-zinc-900 dark:bg-gold-950 text-white royal-shadow border-none overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-300 mb-4">Architecture Stats</h3>
                <div className="grid grid-cols-1 gap-4">
                {selectedSectionIds.map(sectionId => {
                  const section = sections.find(s => s.id === sectionId);
                  if (!section) return null;
                  const assignedCount = entries.filter(e => e.sectionId === sectionId).length;
                  return (
                    <div key={sectionId}>
                      <p className="text-2xl font-black text-white">{assignedCount}</p>
                      <p className="text-[9px] font-bold text-gold-300/60 uppercase tracking-wider">{section.name} Periods</p>
                    </div>
                  );
                })}
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 text-white">
                <Crown size={120} />
              </div>
            </Card>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeId && activeData && (
            <div className={cn(
              "flex flex-col p-3 rounded-xl border-2 shadow-2xl scale-105 rotate-2 backdrop-blur-md transition-all",
              "bg-white/90 dark:bg-zinc-900/90 border-gold-500/50",
              previewValidation?.results[previewValidation.targetEntryId]?.isValid === false && "border-rose-500/50 bg-rose-50/90 dark:bg-rose-900/90",
              activeData.type === 'grid-entry' ? "w-48" : "w-56"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeData.subject?.color }} />
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                  {activeData.subject?.name}
                </span>
                {previewValidation?.results[previewValidation.targetEntryId]?.isValid === false && (
                  <Badge variant="error" className="ml-auto text-[8px] px-1 py-0">Conflict</Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                <User size={12} />
                {activeData.teacher?.name}
              </div>
              
              {overData && (
                <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Target</span>
                  <span className="text-[9px] font-black text-gold-600 dark:text-gold-400">
                    {overData.day} • Period {overData.periodIndex + 1}
                  </span>
                </div>
              )}

              {previewValidation?.results[previewValidation.targetEntryId]?.errors.map((err: string, i: number) => (
                <div key={i} className="mt-2 flex items-start gap-1.5 text-[9px] text-rose-600 dark:text-rose-400 leading-tight">
                  <AlertCircle size={10} className="shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>

    <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden, nav, aside, header, .sticky, .fixed, .no-print, button, .xl\\:col-span-4, .rounded-full, .w-1\\.5 {
            display: none !important;
          }
          #timetable-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 15pt !important;
            border-bottom: 2pt solid black !important;
            padding-bottom: 5pt !important;
            text-align: center !important;
          }
          .print-header h1 {
            font-size: 18pt !important;
            font-weight: bold !important;
            color: black !important;
            margin: 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            border: 2pt solid black !important;
            margin-bottom: 10pt !important;
          }
          th, td {
            border: 1pt solid black !important;
            padding: 8pt !important;
            text-align: center !important;
            vertical-align: middle !important;
            font-size: 10pt !important;
            word-wrap: break-word !important;
            overflow: visible !important;
            min-height: 40pt !important;
          }
          th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
            font-size: 10pt !important;
          }
          .teacher-name, .subject-name, .section-name {
            display: block !important;
            font-weight: bold !important;
            line-height: 1.3 !important;
          }
          .divide-y > * + * {
            border-top: 1pt solid black !important;
          }
          .teacher-name {
            font-size: 9pt !important;
            font-weight: normal !important;
            margin-top: 4pt !important;
            color: #333 !important;
          }
          .subject-name {
            font-size: 11pt !important;
          }
          .truncate {
            overflow: visible !important;
            white-space: normal !important;
            text-overflow: clip !important;
          }
          .slot-label {
            font-size: 10pt !important;
            font-weight: bold !important;
            color: black !important;
          }
          .slot-time {
            font-size: 8pt !important;
            color: #666 !important;
            display: block !important;
          }
          .teacher-card .print-header h2 {
            font-size: 16pt !important;
            font-weight: bold !important;
            margin: 0 !important;
            color: black !important;
          }
          .teacher-card {
            page-break-after: always !important;
            margin-bottom: 20pt !important;
            padding: 15pt !important;
            border: 1pt solid black !important;
          }
        }

        /* Export specific styles - Strictly Minimal Black & White */
        .exporting-pdf {
          width: 1400px !important;
          background: #ffffff !important;
          color: #000000 !important;
          padding: 40px !important;
          font-family: 'Inter', sans-serif !important;
        }
        .exporting-pdf * {
          color: #000000 !important;
          background-color: transparent !important;
          box-shadow: none !important;
          text-shadow: none !important;
          fill: #000000 !important;
          stroke: #000000 !important;
          outline: none !important;
          ring: none !important;
          --tw-ring-width: 0 !important;
          --tw-ring-offset-width: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .exporting-pdf .print-header {
          display: block !important;
          margin-bottom: 30px !important;
          border-bottom: 2px solid black !important;
          padding-bottom: 15px !important;
          text-align: center !important;
        }
        .exporting-pdf .print-header h1, .exporting-pdf .print-header h2 {
          font-size: 28pt !important;
          font-weight: 900 !important;
          margin: 0 !important;
          padding: 0 !important;
          text-transform: uppercase !important;
          font-family: 'Inter', sans-serif !important;
          letter-spacing: -0.02em !important;
          color: #000000 !important;
        }
        .exporting-pdf .no-print, 
        .exporting-pdf .print-hidden-element,
        .exporting-pdf .entry-controls,
        .exporting-pdf .violation-error,
        .exporting-pdf .tooltip,
        .exporting-pdf .badge,
        .exporting-pdf .print\\:hidden,
        .exporting-pdf .xl\\:col-span-4,
        .exporting-pdf .sticky,
        .exporting-pdf .faculty-label,
        .exporting-pdf .w-12,
        .exporting-pdf .w-1\\.5,
        .exporting-pdf .rounded-full,
        .exporting-pdf .opacity-10,
        .exporting-pdf .cursor-grab,
        .exporting-pdf .cursor-grabbing,
        .exporting-pdf .shrink-0.print\\:hidden,
        .exporting-pdf .grip-handle,
        .exporting-pdf svg.lucide-grip-vertical,
        .exporting-pdf svg.lucide-user,
        .exporting-pdf svg.lucide-trash2,
        .exporting-pdf svg.lucide-shield-alert,
        .exporting-pdf svg.lucide-check-circle2,
        .exporting-pdf .animate-pulse {
          display: none !important;
        }
        .exporting-pdf .grid {
          display: block !important;
        }
        .exporting-pdf .md\\:col-span-3 {
          width: 100% !important;
        }
        .exporting-pdf table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000000 !important;
          table-layout: fixed !important;
          margin-top: 20px !important;
          background-color: #ffffff !important;
        }
        .exporting-pdf th, .exporting-pdf td {
          border: 1px solid #000000 !important;
          padding: 12px 8px !important;
          text-align: center !important;
          font-size: 11pt !important;
          vertical-align: middle !important;
          background-color: #ffffff !important;
          min-width: 120px !important;
          height: auto !important;
          overflow: visible !important;
        }
        .exporting-pdf th {
          background-color: #f2f2f2 !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          font-size: 11pt !important;
          letter-spacing: 0.05em !important;
        }
        .exporting-pdf .subject-name,
        .exporting-pdf .teacher-name,
        .exporting-pdf .section-name {
          white-space: normal !important;
          word-wrap: break-word !important;
          overflow: visible !important;
          text-overflow: clip !important;
          display: block !important;
          line-height: 1.3 !important;
          font-size: 11pt !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #000000 !important;
        }
        .exporting-pdf .subject-name {
          font-weight: 900 !important;
          margin-bottom: 3px !important;
        }
        .exporting-pdf .teacher-name {
          font-weight: 600 !important;
          font-size: 10pt !important;
          color: #333333 !important;
        }
        .exporting-pdf .teacher-name::before { content: "("; }
        .exporting-pdf .teacher-name::after { content: ")"; }
        
        .exporting-pdf .divide-y > * + * {
          border-top: 1px solid #000000 !important;
        }
        .exporting-pdf .slot-label {
          font-size: 11pt !important;
          font-weight: 900 !important;
          display: block !important;
          margin-bottom: 2px !important;
          color: #000000 !important;
        }
        .exporting-pdf .slot-time {
          font-size: 9pt !important;
          color: #444444 !important;
          display: block !important;
          font-weight: 600 !important;
        }
        .exporting-pdf .bg-gold-500 {
          background: #e5e5e5 !important;
        }
        .exporting-pdf .rounded-xl, .exporting-pdf .rounded-2xl, .exporting-pdf .rounded-3xl {
          border-radius: 0 !important;
        }
        .exporting-pdf .border {
          border: 1px solid #000000 !important;
        }
        .exporting-pdf .teacher-card {
          border: none !important;
          padding: 0 !important;
          margin-bottom: 60px !important;
          background: white !important;
          width: 100% !important;
          page-break-after: always !important;
        }
        .exporting-pdf .mt-6.pt-6 {
          display: none !important;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};
