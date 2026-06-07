import React, { useState } from 'react';
import { ElectiveGroup, Section, Subject, Teacher, GradeStructure } from '../../types';
import { Card, Button, Label, Badge } from '../UI';
import { Plus, Trash2, Star, Users, BookOpen, Layers } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ElectivesViewProps {
  electiveGroups: ElectiveGroup[];
  setElectiveGroups: React.Dispatch<React.SetStateAction<ElectiveGroup[]>>;
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  gradeStructures: GradeStructure[];
  searchQuery?: string;
}

export const ElectivesView: React.FC<ElectivesViewProps> = ({
  electiveGroups = [],
  setElectiveGroups,
  sections = [],
  subjects = [],
  teachers = [],
  gradeStructures = [],
  searchQuery = ''
}) => {
  const [newGroup, setNewGroup] = useState<Partial<ElectiveGroup>>({
    name: '',
    gradeId: gradeStructures[0]?.id || '',
    sectionIds: [],
    subjectTeacherPairs: [],
    periodsPerWeek: 1,
    maxPeriodsPerDay: 1
  });

  const filteredGroups = electiveGroups.filter(group => {
    const query = searchQuery.toLowerCase();
    const gradeName = gradeStructures.find(g => g.id === group.gradeId)?.name.toLowerCase() || '';
    const sectionNames = group.sectionIds.map(id => sections.find(s => s.id === id)?.name.toLowerCase() || '').join(' ');
    
    return (
      group.name.toLowerCase().includes(query) ||
      gradeName.includes(query) ||
      sectionNames.includes(query)
    );
  });

  const handleAddGroup = () => {
    if (newGroup.name && newGroup.gradeId && newGroup.subjectTeacherPairs && newGroup.subjectTeacherPairs.length > 1) {
      setElectiveGroups([
        ...electiveGroups,
        {
          id: Math.random().toString(36).substr(2, 9),
          name: newGroup.name,
          gradeId: newGroup.gradeId,
          sectionIds: newGroup.sectionIds || [],
          subjectTeacherPairs: newGroup.subjectTeacherPairs,
          periodsPerWeek: newGroup.periodsPerWeek || 1,
          maxPeriodsPerDay: newGroup.maxPeriodsPerDay || 1
        }
      ]);
      setNewGroup({
        name: '',
        gradeId: gradeStructures[0]?.id || '',
        sectionIds: [],
        subjectTeacherPairs: [],
        periodsPerWeek: 1,
        maxPeriodsPerDay: 1
      });
    }
  };

  const handleRemoveGroup = (id: string) => {
    setElectiveGroups(electiveGroups.filter(g => g.id !== id));
  };

  const updatePair = (subjectId: string, teacherId: string) => {
    const current = [...(newGroup.subjectTeacherPairs || [])];
    const existingIdx = current.findIndex(p => p.subjectId === subjectId);
    
    if (teacherId === '') {
      if (existingIdx >= 0) current.splice(existingIdx, 1);
    } else {
      if (existingIdx >= 0) {
        current[existingIdx] = { subjectId, teacherId };
      } else {
        current.push({ subjectId, teacherId });
      }
    }
    setNewGroup({ ...newGroup, subjectTeacherPairs: current });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between sticky top-20 bg-[#FDFDFD]/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md z-30 py-4 border-b border-zinc-100 dark:border-zinc-800 -mx-10 px-10">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">Elective Groups</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium italic">Manage subjects that happen simultaneously for an entire grade.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card title="Create Elective Group" icon={Plus}>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <input 
                  type="text"
                  placeholder="e.g., Grade 10 Electives"
                  className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 outline-none transition-all dark:text-white"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Target Grade</Label>
                <select 
                  className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 outline-none transition-all dark:text-white"
                  value={newGroup.gradeId}
                  onChange={(e) => setNewGroup({ ...newGroup, gradeId: e.target.value, sectionIds: [] })}
                >
                  {gradeStructures.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Target Sections (Optional - defaults to all in grade)</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                  {sections.filter(s => s.gradeId === newGroup.gradeId).map(section => (
                    <button
                      key={section.id}
                      onClick={() => {
                        const current = newGroup.sectionIds || [];
                        if (current.includes(section.id)) {
                          setNewGroup({ ...newGroup, sectionIds: current.filter(id => id !== section.id) });
                        } else {
                          setNewGroup({ ...newGroup, sectionIds: [...current, section.id] });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                        newGroup.sectionIds?.includes(section.id)
                          ? "bg-gold-500 border-gold-600 text-white shadow-sm"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                      )}
                    >
                      {section.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Periods Per Week</Label>
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 outline-none transition-all dark:text-white"
                    value={newGroup.periodsPerWeek || ''}
                    onChange={(e) => setNewGroup({ ...newGroup, periodsPerWeek: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Per Day</Label>
                  <input 
                    type="number"
                    min="1"
                    max="5"
                    className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 outline-none transition-all dark:text-white"
                    value={newGroup.maxPeriodsPerDay || ''}
                    onChange={(e) => setNewGroup({ ...newGroup, maxPeriodsPerDay: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subjects & Teachers (Min 2)</Label>
                <div className="max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 space-y-3 custom-scrollbar">
                  {subjects.map(subject => {
                    const pair = newGroup.subjectTeacherPairs?.find(p => p.subjectId === subject.id);
                    return (
                      <div key={subject.id} className="space-y-1 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{subject.name}</span>
                          {pair && <Badge variant="success" className="text-[8px] px-1 py-0">Selected</Badge>}
                        </div>
                        <select 
                          className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold outline-none dark:text-white"
                          value={pair?.teacherId || ''}
                          onChange={(e) => updatePair(subject.id, e.target.value)}
                        >
                          <option value="">Not included</option>
                          {teachers.filter(t => t.specializations.includes(subject.id)).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleAddGroup}
                disabled={!newGroup.name || (newGroup.subjectTeacherPairs?.length || 0) < 2}
              >
                Create Elective Group
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {filteredGroups.length === 0 ? (
            <Card className="p-12 text-center">
              <Star size={48} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-4" />
              <p className="text-zinc-400 italic">No elective groups defined yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredGroups.map(group => (
                <Card key={group.id} className="p-6 royal-shadow relative group">
                  <button 
                    onClick={() => handleRemoveGroup(group.id)}
                    className="absolute top-4 right-4 p-2 text-zinc-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gold-500/10 rounded-xl flex items-center justify-center text-gold-500">
                      <Star size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">{group.name}</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {gradeStructures.find(g => g.id === group.gradeId)?.name} • {group.periodsPerWeek} P/W • Max {group.maxPeriodsPerDay} P/D
                      </p>
                      {(group.sectionIds?.length || 0) > 0 && (
                        <p className="text-[8px] font-bold text-gold-500 uppercase tracking-widest mt-1">
                          Sections: {group.sectionIds.map(id => sections.find(s => s.id === id)?.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Included Subjects</p>
                    <div className="flex flex-wrap gap-2">
                      {group.subjectTeacherPairs.map(pair => {
                        const sub = subjects.find(s => s.id === pair.subjectId);
                        const tea = teachers.find(t => t.id === pair.teacherId);
                        return (
                          <div key={pair.subjectId} className="flex flex-col p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 min-w-[120px]">
                            <span className="text-[10px] font-black uppercase text-zinc-900 dark:text-zinc-100">{sub?.name}</span>
                            <span className="text-[8px] font-bold text-zinc-400 truncate">{tea?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
