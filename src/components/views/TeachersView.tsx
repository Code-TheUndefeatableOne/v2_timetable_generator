import React, { useState } from 'react';
import { Plus, Trash2, Users, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';
import { Teacher, Subject, GradeStructure, Day } from '../../types';
import { Card, Input, Label, Button } from '../UI';
import { DAYS } from '../../utils/scheduler';
import { Calendar, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TeachersViewProps {
  teachers: Teacher[];
  setTeachers: (teachers: Teacher[]) => void;
  subjects: Subject[];
  gradeStructures: GradeStructure[];
  searchQuery?: string;
}

export const TeachersView: React.FC<TeachersViewProps> = ({ 
  teachers = [], 
  setTeachers, 
  subjects = [], 
  gradeStructures = [],
  searchQuery = ''
}) => {
  const [expandedTeachers, setExpandedTeachers] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedTeachers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addTeacher = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setTeachers([...teachers, { id, name: 'New Faculty Member', specializations: [] }]);
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.specializations.some(specId => 
      subjects.find(s => s.id === specId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    setTeachers(teachers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const removeTeacher = (id: string) => {
    setTeachers(teachers.filter(t => t.id !== id));
  };

  const toggleSpecialization = (teacherId: string, subjectId: string) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const specs = teacher.specializations.includes(subjectId)
      ? teacher.specializations.filter(id => id !== subjectId)
      : [...teacher.specializations, subjectId];
    
    updateTeacher(teacherId, { specializations: specs });
  };

  const toggleAvailability = (teacherId: string, day: Day, periodIndex: number) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const currentSlots = teacher.unavailableSlots || [];
    const isUnavailable = currentSlots.some(s => s.day === day && s.periodIndex === periodIndex);

    const newSlots = isUnavailable
      ? currentSlots.filter(s => !(s.day === day && s.periodIndex === periodIndex))
      : [...currentSlots, { day, periodIndex }];
    
    updateTeacher(teacherId, { unavailableSlots: newSlots });
  };

  // Find the maximum number of periods across all grade structures
  const maxPeriods = Math.max(0, ...gradeStructures.map(g => g.slots.filter(s => s.type === 'period').length));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between sticky top-20 bg-[#FDFDFD]/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md z-30 py-4 border-b border-zinc-100 dark:border-zinc-800 -mx-10 px-10">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">Faculty</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium italic">Manage your teaching staff and their areas of expertise.</p>
        </div>
        <Button onClick={addTeacher} className="royal-shadow">
          <Plus size={18} /> Add Faculty Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => {
          const isExpanded = expandedTeachers[teacher.id];
          return (
            <Card key={teacher.id} title={teacher.name} icon={Users}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {!isExpanded ? (
                      <div className="py-2">
                        <p className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{teacher.name}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Faculty Member</p>
                      </div>
                    ) : (
                      <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                        <Label>Full Name</Label>
                        <Input 
                          value={teacher.name} 
                          onChange={(e) => updateTeacher(teacher.id, { name: e.target.value })}
                          placeholder="e.g. Dr. Elizabeth Smith"
                        />
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleExpand(teacher.id)}
                    className="ml-2 mt-2"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="ml-1 text-[10px] font-black uppercase tracking-widest">
                      {isExpanded ? 'Hide Constraints' : 'Show Constraints'}
                    </span>
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <GraduationCap size={14} className="text-zinc-400" />
                        <Label>Specializations</Label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subjects.length === 0 && (
                          <p className="text-[10px] text-zinc-400 italic">No subjects defined yet.</p>
                        )}
                        {subjects.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => toggleSpecialization(teacher.id, sub.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                              teacher.specializations.includes(sub.id) 
                                ? "bg-gold-500 text-white border-gold-500 royal-shadow" 
                                : "bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-gold-500 dark:hover:border-gold-500 hover:text-gold-500"
                            )}
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={14} className="text-zinc-400" />
                        <Label>Availability (Click to mark unavailable)</Label>
                      </div>
                      <div className="overflow-x-auto pb-2">
                        <div className="min-w-[300px]">
                          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `60px repeat(${maxPeriods}, 1fr)` }}>
                            <div className="h-6" />
                            {Array.from({ length: maxPeriods }).map((_, pIdx) => (
                              <div key={pIdx} className="text-[8px] font-black uppercase text-zinc-400 text-center">
                                P{pIdx + 1}
                              </div>
                            ))}
                          </div>
                          {DAYS.map(day => (
                            <div key={day} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `60px repeat(${maxPeriods}, 1fr)` }}>
                              <div className="flex items-center justify-start px-2">
                                <span className="text-[8px] font-black uppercase text-zinc-400">{day.substr(0, 3)}</span>
                              </div>
                              {Array.from({ length: maxPeriods }).map((_, pIdx) => {
                                const isUnavailable = teacher.unavailableSlots?.some(s => s.day === day && s.periodIndex === pIdx);
                                return (
                                  <button
                                    key={pIdx}
                                    onClick={() => toggleAvailability(teacher.id, day, pIdx)}
                                    className={cn(
                                      "h-6 rounded-md transition-all border",
                                      isUnavailable
                                        ? "bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                                        : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50 hover:border-gold-500"
                                    )}
                                    title={`${day}, Period ${pIdx + 1}: ${isUnavailable ? 'Unavailable' : 'Available'}`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <Button 
                    variant="danger" 
                    size="sm" 
                    className="w-full"
                    onClick={() => removeTeacher(teacher.id)}
                  >
                    <Trash2 size={14} /> Remove Faculty
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
