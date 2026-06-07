import { Day, Subject, Teacher, Section, TimetableEntry, SyncConstraint, SimultaneousConstraint, ValidationResult, GradeStructure, ElectiveGroup } from '../types';

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function validateTimetable(
  entries: TimetableEntry[] = [],
  subjects: Subject[] = [],
  teachers: Teacher[] = [],
  sections: Section[] = [],
  syncConstraints: SyncConstraint[] = [],
  gradeStructures: GradeStructure[] = [],
  simultaneousConstraints: SimultaneousConstraint[] = [],
  electiveGroups: ElectiveGroup[] = []
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  // Helper to convert time string to minutes from midnight
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Initialize results for each entry
  entries.forEach(entry => {
    results[entry.id] = { isValid: true, errors: [], warnings: [] };
  });

  // 1. Teacher Overlap Check (Time-based)
  const teacherTimeSlots: Record<string, { day: Day, start: number, end: number, entryId: string }[]> = {};
  
  entries.forEach(entry => {
    const section = sections.find(s => s.id === entry.sectionId);
    const structure = gradeStructures.find(g => g.id === section?.gradeId);
    if (!structure) return;

    const periodSlots = structure.slots.filter(s => s.type === 'period');
    const slot = periodSlots[entry.periodIndex];
    if (!slot) return;

    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);

    if (!teacherTimeSlots[entry.teacherId]) teacherTimeSlots[entry.teacherId] = [];
    
    // Check for overlap with existing slots for this teacher on the same day
    teacherTimeSlots[entry.teacherId].forEach(existing => {
      if (existing.day === entry.day) {
        // Overlap condition: (start1 < end2) && (start2 < end1)
        if (start < existing.end && existing.start < end) {
          // Check if this overlap is actually a synchronized or simultaneous period
          const isSynchronized = syncConstraints.some(sync => 
            sync.day === entry.day && 
            sync.periodIndex === entry.periodIndex &&
            sync.sectionIds.includes(entry.sectionId) &&
            sync.sectionIds.includes(entries.find(e => e.id === existing.entryId)?.sectionId || '') &&
            sync.subjectId === entry.subjectId &&
            sync.subjectId === (entries.find(e => e.id === existing.entryId)?.subjectId || '')
          );

          const isSimultaneous = simultaneousConstraints.some(sim => {
            const existingEntry = entries.find(e => e.id === existing.entryId);
            if (!existingEntry) return false;

            if (sim.isAlways) {
              return sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === entry.subjectId) &&
                     sim.sectionSubjectPairs.some(p => p.sectionId === existingEntry.sectionId && p.subjectId === existingEntry.subjectId);
            }
            return sim.day === entry.day && 
                   sim.periodIndex === entry.periodIndex &&
                   sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === entry.subjectId) &&
                   sim.sectionSubjectPairs.some(p => p.sectionId === existingEntry.sectionId && p.subjectId === existingEntry.subjectId);
          });

          const isElective = electiveGroups.some(eg => {
            const entry1IsElective = entry.electiveGroupId === eg.id;
            const entry2IsElective = entries.find(e => e.id === existing.entryId)?.electiveGroupId === eg.id;
            return entry1IsElective && entry2IsElective;
          });

          if (!isSynchronized && !isSimultaneous && !isElective) {
            results[entry.id].isValid = false;
            results[entry.id].errors.push(`Teacher overlap: ${teachers.find(t => t.id === entry.teacherId)?.name} is already teaching ${subjects.find(s => s.id === (entries.find(e => e.id === existing.entryId)?.subjectId || ''))?.name} in ${sections.find(s => s.id === (entries.find(e => e.id === existing.entryId)?.sectionId || ''))?.name} at this time.`);
            results[existing.entryId].isValid = false;
            results[existing.entryId].errors.push(`Teacher overlap: Conflict with ${subjects.find(s => s.id === entry.subjectId)?.name} in ${sections.find(s => s.id === entry.sectionId)?.name}.`);
          }
        }
      }
    });

    teacherTimeSlots[entry.teacherId].push({ day: entry.day, start, end, entryId: entry.id });
  });

  // 1.5 Section Overlap Check
  const sectionSlots: Record<string, { day: Day, periodIndex: number, entryId: string }[]> = {};
  entries.forEach(entry => {
    if (!sectionSlots[entry.sectionId]) sectionSlots[entry.sectionId] = [];
    
    sectionSlots[entry.sectionId].forEach(existing => {
      if (existing.day === entry.day && existing.periodIndex === entry.periodIndex) {
        // Check if this is a valid split class (simultaneous constraint for the SAME section)
        const isSimultaneousSplit = simultaneousConstraints.some(sim => {
          const existingEntry = entries.find(e => e.id === existing.entryId);
          if (!existingEntry) return false;
          
          if (sim.isAlways) {
            return sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === entry.subjectId) &&
                   sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === existingEntry.subjectId);
          }
          return sim.day === entry.day && 
                 sim.periodIndex === entry.periodIndex &&
                 sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === entry.subjectId) &&
                 sim.sectionSubjectPairs.some(p => p.sectionId === entry.sectionId && p.subjectId === existingEntry.subjectId);
        });

        const isElectiveSplit = electiveGroups.some(eg => {
          const existingEntry = entries.find(e => e.id === existing.entryId);
          return entry.electiveGroupId === eg.id && existingEntry?.electiveGroupId === eg.id;
        });

        if (!isSimultaneousSplit && !isElectiveSplit) {
          results[entry.id].isValid = false;
          results[entry.id].errors.push(`Section overlap: Multiple subjects scheduled for this section at the same time.`);
          results[existing.entryId].isValid = false;
          results[existing.entryId].errors.push(`Section overlap: Multiple subjects scheduled for this section at the same time.`);
        }
      }
    });
    sectionSlots[entry.sectionId].push({ day: entry.day, periodIndex: entry.periodIndex, entryId: entry.id });
  });

  // 2. Subject Constraints (Max per day/week, Back-to-back)
  sections.forEach(section => {
    const sectionEntries = entries.filter(e => e.sectionId === section.id);
    
    subjects.forEach(subject => {
      const subjectEntries = sectionEntries.filter(e => e.subjectId === subject.id);
      
      // Weekly limit
      if (subjectEntries.length > subject.maxPeriodsPerWeek) {
        subjectEntries.forEach(e => {
          results[e.id].isValid = false;
          results[e.id].errors.push(`Weekly limit exceeded for ${subject.name} (${subjectEntries.length}/${subject.maxPeriodsPerWeek})`);
        });
      }

      // Daily limit & Back-to-back
      DAYS.forEach(day => {
        const dayEntries = subjectEntries.filter(e => e.day === day).sort((a, b) => a.periodIndex - b.periodIndex);
        
        if (dayEntries.length > subject.maxPeriodsPerDay) {
          dayEntries.forEach(e => {
            results[e.id].isValid = false;
            results[e.id].errors.push(`Daily limit exceeded for ${subject.name} (${dayEntries.length}/${subject.maxPeriodsPerDay})`);
          });
        }

        if (!subject.allowBackToBack && dayEntries.length > 1) {
          for (let i = 0; i < dayEntries.length - 1; i++) {
            if (dayEntries[i + 1].periodIndex === dayEntries[i].periodIndex + 1) {
              results[dayEntries[i].id].isValid = false;
              results[dayEntries[i].id].errors.push(`Back-to-back periods not allowed for ${subject.name}`);
              results[dayEntries[i+1].id].isValid = false;
              results[dayEntries[i+1].id].errors.push(`Back-to-back periods not allowed for ${subject.name}`);
            }
          }
        }
      });
    });
  });

  // 3. Synchronized Periods
  syncConstraints.forEach(sync => {
    const relevantEntries = entries.filter(e => 
      sync.sectionIds.includes(e.sectionId) && 
      e.day === sync.day && 
      e.periodIndex === sync.periodIndex
    );

    relevantEntries.forEach(e => {
      if (e.subjectId !== sync.subjectId) {
        results[e.id].isValid = false;
        results[e.id].errors.push(`Synchronization violation: Should be ${subjects.find(s => s.id === sync.subjectId)?.name}`);
      }
    });
  });

  // 4. Simultaneous Periods
  simultaneousConstraints.forEach(sim => {
    if (sim.isAlways) {
      // Check every entry for subjects in this constraint
      sim.sectionSubjectPairs.forEach(pair => {
        const sectionEntries = entries.filter(e => e.sectionId === pair.sectionId && e.subjectId === pair.subjectId);
        sectionEntries.forEach(e => {
          sim.sectionSubjectPairs.forEach(otherPair => {
            if (otherPair.sectionId === pair.sectionId && otherPair.subjectId === pair.subjectId) return;
            const hasMatchingEntry = entries.some(oe => oe.sectionId === otherPair.sectionId && oe.day === e.day && oe.periodIndex === e.periodIndex && oe.subjectId === otherPair.subjectId);
            if (!hasMatchingEntry) {
              results[e.id].isValid = false;
              results[e.id].errors.push(`Always Simultaneous violation: ${sections.find(s => s.id === otherPair.sectionId)?.name} must have ${subjects.find(s => s.id === otherPair.subjectId)?.name} at this time.`);
            }
          });
        });
      });
    } else {
      const relevantEntries = entries.filter(e => 
        sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId) && 
        e.day === sim.day && 
        e.periodIndex === sim.periodIndex
      );

      relevantEntries.forEach(e => {
        const pair = sim.sectionSubjectPairs.find(p => p.sectionId === e.sectionId);
        if (pair && e.subjectId !== pair.subjectId) {
          results[e.id].isValid = false;
          results[e.id].errors.push(`Simultaneous violation: Should be ${subjects.find(s => s.id === pair.subjectId)?.name}`);
        }
      });
    }
  });

  // 4.5 Elective Groups
  electiveGroups.forEach(eg => {
    const egEntries = entries.filter(e => e.electiveGroupId === eg.id);
    const slots = Array.from(new Set(egEntries.map(e => `${e.day}-${e.periodIndex}`)));
    
    // Target sections for this elective group
    const targetSectionIds = (eg.sectionIds?.length || 0) > 0 
      ? eg.sectionIds 
      : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);

    if (targetSectionIds.length === 0) return;

    slots.forEach(slotKey => {
      const [day, pIdxStr] = slotKey.split('-');
      const pIdx = parseInt(pIdxStr);
      const slotEntries = egEntries.filter(e => e.day === day && e.periodIndex === pIdx);
      
      // All target sections should have an entry for this elective group at this time
      targetSectionIds.forEach(secId => {
        const hasEntry = slotEntries.some(e => e.sectionId === secId);
        if (!hasEntry) {
          // This is a violation - if one section has an elective, all target sections should
          slotEntries.forEach(e => {
            results[e.id].isValid = false;
            results[e.id].errors.push(`Elective Group violation: Section ${sections.find(s => s.id === secId)?.name} is missing this elective at ${day} Period ${pIdx + 1}`);
          });
        }
      });

      // Check if subjects/teachers match the group
      slotEntries.forEach(e => {
        const pair = eg.subjectTeacherPairs.find(p => p.subjectId === e.subjectId && p.teacherId === e.teacherId);
        if (!pair) {
          results[e.id].isValid = false;
          results[e.id].errors.push(`Elective Group violation: Subject/Teacher combination not in group ${eg.name}`);
        }
      });
    });

    if (slots.length > eg.periodsPerWeek) {
      egEntries.forEach(e => {
        results[e.id].isValid = false;
        results[e.id].errors.push(`Elective Group limit exceeded: ${eg.name} (${slots.length}/${eg.periodsPerWeek})`);
      });
    }

    // Daily limit for elective group
    DAYS.forEach(day => {
      const daySlots = slots.filter(s => s.startsWith(day));
      if (daySlots.length > eg.maxPeriodsPerDay) {
        egEntries.filter(e => e.day === day).forEach(e => {
          results[e.id].isValid = false;
          results[e.id].errors.push(`Elective Group daily limit exceeded: ${eg.name} (${daySlots.length}/${eg.maxPeriodsPerDay})`);
        });
      }
    });

    // Check if all teachers in the group are busy during this elective
    slots.forEach(slotKey => {
      const [day, pIdxStr] = slotKey.split('-');
      const pIdx = parseInt(pIdxStr);
      
      eg.subjectTeacherPairs.forEach(pair => {
        // Check if this teacher is teaching something else at this time
        const otherEntry = entries.find(e => 
          e.teacherId === pair.teacherId && 
          e.day === day && 
          e.periodIndex === pIdx && 
          e.electiveGroupId !== eg.id
        );
        if (otherEntry) {
          results[otherEntry.id].isValid = false;
          results[otherEntry.id].errors.push(`Teacher conflict: ${teachers.find(t => t.id === pair.teacherId)?.name} is busy with elective group ${eg.name}.`);
          
          // Also mark the elective entries as invalid
          egEntries.filter(e => e.day === day && e.periodIndex === pIdx).forEach(e => {
            results[e.id].isValid = false;
            results[e.id].errors.push(`Teacher conflict: ${teachers.find(t => t.id === pair.teacherId)?.name} is busy with another class.`);
          });
        }
      });
    });
  });

  // 5. Teacher Availability
  entries.forEach(entry => {
    const teacher = teachers.find(t => t.id === entry.teacherId);
    if (teacher?.unavailableSlots?.some(slot => slot.day === entry.day && slot.periodIndex === entry.periodIndex)) {
      results[entry.id].isValid = false;
      results[entry.id].errors.push(`Teacher availability: ${teacher.name} is not available at this time.`);
    }
  });

  return results;
}

// Robust global scheduler with conflict avoidance
export function autoGenerateTimetable(
  subjects: Subject[] = [],
  teachers: Teacher[] = [],
  sections: Section[] = [],
  gradeStructures: Record<string, GradeStructure> = {},
  syncConstraints: SyncConstraint[] = [],
  simultaneousConstraints: SimultaneousConstraint[] = [],
  electiveGroups: ElectiveGroup[] = [],
  existingEntries: TimetableEntry[] = [],
  targetSectionId?: string,
  keepExisting: boolean = false
): TimetableEntry[] {
  // If targetSectionId is provided, we keep entries for other sections
  const baseEntries: TimetableEntry[] = targetSectionId 
    ? (keepExisting 
        ? [...existingEntries] 
        : [...existingEntries.filter(e => e.sectionId !== targetSectionId)])
    : [];

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Helper to check if a teacher is busy at a specific time
  const isTeacherBusy = (teacherId: string, day: Day, periodIndex: number, sectionId: string, subjectId: string, currentEntries: TimetableEntry[]) => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher?.unavailableSlots?.some(slot => slot.day === day && slot.periodIndex === periodIndex)) {
      return true;
    }

    // Check if teacher is busy in an elective group
    const isBusyInElective = electiveGroups.some(eg => {
      const isTeacherInGroup = eg.subjectTeacherPairs.some(p => p.teacherId === teacherId);
      if (!isTeacherInGroup) return false;
      // Teacher is busy if ANY section in this elective group is currently scheduled for this group at this time
      return currentEntries.some(e => e.electiveGroupId === eg.id && e.day === day && e.periodIndex === periodIndex);
    });
    
    if (isBusyInElective) {
      // Exception: If the current request is for the SAME elective group, it's not "busy" (it's shared)
      const alreadyPlacedInSameGroup = currentEntries.some(e => 
        e.electiveGroupId && 
        e.day === day && 
        e.periodIndex === periodIndex &&
        // Must be the same group
        electiveGroups.some(eg => eg.id === e.electiveGroupId && eg.subjectTeacherPairs.some(p => p.teacherId === teacherId)) &&
        // And the current section must be part of this group
        electiveGroups.some(eg => eg.id === e.electiveGroupId && ((eg.sectionIds?.length || 0) === 0 || eg.sectionIds.includes(sectionId)))
      );
      if (alreadyPlacedInSameGroup) return false;
      return true;
    }

    const section = sections.find(s => s.id === sectionId);
    const structure = gradeStructures[section?.gradeId || ''];
    if (!structure) return false;
    const periodSlots = structure.slots.filter(s => s.type === 'period');
    const slot = periodSlots[periodIndex];
    if (!slot) return false;

    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);

    return currentEntries.some(e => {
      if (e.teacherId !== teacherId || e.day !== day) return false;
      
      // Check if this overlap is actually a synchronized or simultaneous period
      const isSynchronized = syncConstraints.some(sync => 
        sync.day === day && 
        sync.periodIndex === periodIndex &&
        sync.sectionIds.includes(sectionId) &&
        sync.sectionIds.includes(e.sectionId) &&
        sync.subjectId === e.subjectId
      );
      if (isSynchronized) return false;

      const isSimultaneous = simultaneousConstraints.some(sim => {
        if (sim.isAlways) {
          return sim.sectionSubjectPairs.some(p => p.sectionId === sectionId && p.subjectId === subjectId) &&
                 sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId && p.subjectId === e.subjectId);
        }
        return sim.day === day && 
               sim.periodIndex === periodIndex &&
               sim.sectionSubjectPairs.some(p => p.sectionId === sectionId && p.subjectId === subjectId) &&
               sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId && p.subjectId === e.subjectId);
      });
      if (isSimultaneous) return false;

      const otherSection = sections.find(s => s.id === e.sectionId);
      const otherStructure = gradeStructures[otherSection?.gradeId || ''];
      if (!otherStructure) return false;
      const otherPeriodSlots = otherStructure.slots.filter(s => s.type === 'period');
      const otherSlot = otherPeriodSlots[e.periodIndex];
      if (!otherSlot) return false;

      const oStart = timeToMinutes(otherSlot.startTime);
      const oEnd = timeToMinutes(otherSlot.endTime);

      return start < oEnd && oStart < end;
    });
  };

  const sectionsToProcess = targetSectionId 
    ? sections.filter(s => s.id === targetSectionId)
    : sections;

  // 1. Anchors (Sync and Slot-specific Simultaneous)
  const anchorEntries: TimetableEntry[] = [...baseEntries];
  
  // Sort sync constraints to place more complex ones first
  const sortedSync = [...syncConstraints].sort((a, b) => b.sectionIds.length - a.sectionIds.length);
  
  sortedSync.forEach(sync => {
    sync.sectionIds.forEach(sectionId => {
      if (!sectionsToProcess.some(s => s.id === sectionId)) return;
      const section = sections.find(s => s.id === sectionId);
      const assignment = section?.assignments.find(a => a.subjectId === sync.subjectId);
      if (!assignment) return;
      if (anchorEntries.some(e => e.sectionId === sectionId && e.day === sync.day && e.periodIndex === sync.periodIndex)) return;

      anchorEntries.push({
        id: `sync-${Math.random().toString(36).substr(2, 9)}`,
        sectionId, day: sync.day, periodIndex: sync.periodIndex, subjectId: sync.subjectId, teacherId: assignment.teacherId
      });
    });
  });

  // Sort simultaneous constraints
  const sortedSimFixed = simultaneousConstraints
    .filter(sim => !sim.isAlways)
    .sort((a, b) => (b.sectionSubjectPairs.length + (b.electiveGroupIds?.length || 0) * 5) - (a.sectionSubjectPairs.length + (a.electiveGroupIds?.length || 0) * 5));

  sortedSimFixed.forEach(sim => {
    sim.sectionSubjectPairs.forEach(pair => {
      if (!sectionsToProcess.some(s => s.id === pair.sectionId)) return;
      const section = sections.find(s => s.id === pair.sectionId);
      const assignment = section?.assignments.find(a => a.subjectId === pair.subjectId);
      if (!assignment) return;
      if (anchorEntries.some(e => e.sectionId === pair.sectionId && e.day === sim.day && e.periodIndex === sim.periodIndex)) return;

      anchorEntries.push({
        id: `sim-${Math.random().toString(36).substr(2, 9)}`,
        sectionId: pair.sectionId, day: sim.day!, periodIndex: sim.periodIndex!, subjectId: pair.subjectId, teacherId: assignment.teacherId
      });
    });
    sim.electiveGroupIds?.forEach(groupId => {
      const eg = electiveGroups.find(g => g.id === groupId);
      if (!eg) return;
      const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
      targetSectionIds.forEach(secId => {
        if (!sectionsToProcess.some(s => s.id === secId)) return;
        if (anchorEntries.some(e => e.sectionId === secId && e.day === sim.day && e.periodIndex === sim.periodIndex)) return;
        const pair = eg.subjectTeacherPairs[0];
        anchorEntries.push({
          id: `sim-eg-${Math.random().toString(36).substr(2, 9)}`,
          sectionId: secId, day: sim.day!, periodIndex: sim.periodIndex!, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
        });
      });
    });
  });

  // 2. Global Placement Strategy
  let bestGlobalEntries: TimetableEntry[] = [...anchorEntries];
  let minErrors = Infinity;

  const maxAttempts = targetSectionId ? 200 : 500; // Increased attempts for better integrity
  console.log(`Starting auto-generation: ${sectionsToProcess.length} sections, ${maxAttempts} attempts max.`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let currentEntries = [...anchorEntries];
    let unplacedRegularCount = 0;

    // --- A. Place "Always" Simultaneous Constraints (Highest Priority) ---
    const sortedSimAlways = simultaneousConstraints
      .filter(sim => sim.isAlways)
      .sort((a, b) => {
        const aComplexity = a.sectionSubjectPairs.length * 10 + (a.electiveGroupIds?.length || 0) * 50;
        const bComplexity = b.sectionSubjectPairs.length * 10 + (b.electiveGroupIds?.length || 0) * 50;
        return bComplexity - aComplexity;
      });

    sortedSimAlways.forEach(sim => {
      const firstPair = sim.sectionSubjectPairs[0];
      const sub = subjects.find(s => s.id === (firstPair?.subjectId || ''));
      const periodsNeeded = sub?.maxPeriodsPerWeek || 0;
      let placedCount = 0;

      const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
      
      // Pass 1: Spread across days (1 per day)
      for (const day of shuffledDays) {
        if (placedCount >= periodsNeeded) break;
        const section = sections.find(s => s.id === firstPair.sectionId);
        const structure = gradeStructures[section?.gradeId || ''];
        const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;
        
        // Find the best period for this day (one where most teachers are free)
        const periodScores = Array.from({length: periodCount}, (_, i) => i).map(pIdx => {
          let teacherConflictCount = 0;
          const isPossible = sim.sectionSubjectPairs.every(pair => {
            const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
            if (!assignment) return false;
            
            // Allow section overlap if it's a valid simultaneous split
            const isSectionFree = !currentEntries.some(e => {
              if (e.sectionId !== pair.sectionId || e.day !== day || e.periodIndex !== pIdx) return false;
              // If it's the same section, it's only "free" if the existing entry is part of this SAME sim constraint
              const isSameSim = sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId && p.subjectId === e.subjectId);
              return !isSameSim;
            });

            const isTeacherFree = !isTeacherBusy(assignment.teacherId, day, pIdx, pair.sectionId, pair.subjectId, currentEntries);
            if (!isTeacherFree) teacherConflictCount++;
            return isSectionFree && isTeacherFree;
          }) && (sim.electiveGroupIds || []).every(groupId => {
            const eg = electiveGroups.find(g => g.id === groupId);
            if (!eg) return true;
            const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
            const sectionsFree = targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx));
            const teachersFree = eg.subjectTeacherPairs.every(pair => targetSectionIds.every(secId => !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries)));
            return sectionsFree && teachersFree;
          });
          
          return { pIdx, isPossible, teacherConflictCount };
        }).filter(p => p.isPossible).sort((a, b) => a.teacherConflictCount - b.teacherConflictCount || Math.random() - 0.5);

        if (periodScores.length > 0) {
          const pIdx = periodScores[0].pIdx;
          sim.sectionSubjectPairs.forEach(pair => {
            const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
            if (assignment) {
              // Check if already placed
              const alreadyPlaced = currentEntries.some(e => e.sectionId === pair.sectionId && e.day === day && e.periodIndex === pIdx && e.subjectId === pair.subjectId);
              if (!alreadyPlaced) {
                currentEntries.push({
                  id: `sim-always-${Math.random().toString(36).substr(2, 9)}`,
                  sectionId: pair.sectionId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: assignment.teacherId
                });
              }
            }
          });
          sim.electiveGroupIds?.forEach(groupId => {
            const eg = electiveGroups.find(g => g.id === groupId);
            if (!eg) return;
            const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
            targetSectionIds.forEach(secId => {
              eg.subjectTeacherPairs.forEach(pair => {
                // Check if already placed
                const alreadyPlaced = currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx && e.subjectId === pair.subjectId);
                if (!alreadyPlaced) {
                  currentEntries.push({
                    id: `sim-always-eg-${Math.random().toString(36).substr(2, 9)}`,
                    sectionId: secId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
                  });
                }
              });
            });
          });
          placedCount++;
        }
      }

      // Pass 2: Fill remaining (up to maxPeriodsPerDay)
      if (placedCount < periodsNeeded) {
        for (const day of shuffledDays) {
          if (placedCount >= periodsNeeded) break;
          const section = sections.find(s => s.id === firstPair.sectionId);
          const structure = gradeStructures[section?.gradeId || ''];
          const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;

          const periodScores = Array.from({length: periodCount}, (_, i) => i).map(pIdx => {
            const dayUsage = currentEntries.filter(e => e.sectionId === firstPair.sectionId && e.subjectId === firstPair.subjectId && e.day === day).length;
            const isPossible = dayUsage < (sub?.maxPeriodsPerDay || 1) &&
              sim.sectionSubjectPairs.every(pair => {
                const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
                if (!assignment) return false;
                
                // Allow section overlap if it's a valid simultaneous split
                const isSectionFree = !currentEntries.some(e => {
                  if (e.sectionId !== pair.sectionId || e.day !== day || e.periodIndex !== pIdx) return false;
                  // If it's the same section, it's only "free" if the existing entry is part of this SAME sim constraint
                  const isSameSim = sim.sectionSubjectPairs.some(p => p.sectionId === e.sectionId && p.subjectId === e.subjectId);
                  return !isSameSim;
                });

                return isSectionFree && !isTeacherBusy(assignment.teacherId, day, pIdx, pair.sectionId, pair.subjectId, currentEntries);
              }) && (sim.electiveGroupIds || []).every(groupId => {
                const eg = electiveGroups.find(g => g.id === groupId);
                if (!eg) return true;
                const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
                return targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx)) &&
                       eg.subjectTeacherPairs.every(pair => targetSectionIds.every(secId => !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries)));
              });
            return { pIdx, isPossible };
          }).filter(p => p.isPossible).sort(() => Math.random() - 0.5);

          for (const p of periodScores) {
            if (placedCount >= periodsNeeded) break;
            const dayUsage = currentEntries.filter(e => e.sectionId === firstPair.sectionId && e.subjectId === firstPair.subjectId && e.day === day).length;
            if (dayUsage >= (sub?.maxPeriodsPerDay || 1)) break;

            sim.sectionSubjectPairs.forEach(pair => {
              const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
              if (assignment) {
                // Check if already placed
                const alreadyPlaced = currentEntries.some(e => e.sectionId === pair.sectionId && e.day === day && e.periodIndex === p.pIdx && e.subjectId === pair.subjectId);
                if (!alreadyPlaced) {
                  currentEntries.push({
                    id: `sim-always-${Math.random().toString(36).substr(2, 9)}`,
                    sectionId: pair.sectionId, day, periodIndex: p.pIdx, subjectId: pair.subjectId, teacherId: assignment.teacherId
                  });
                }
              }
            });
            sim.electiveGroupIds?.forEach(groupId => {
              const eg = electiveGroups.find(g => g.id === groupId);
              if (!eg) return;
              const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
              targetSectionIds.forEach(secId => {
                eg.subjectTeacherPairs.forEach(pair => {
                  // Check if already placed
                  const alreadyPlaced = currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === p.pIdx && e.subjectId === pair.subjectId);
                  if (!alreadyPlaced) {
                    currentEntries.push({
                      id: `sim-always-eg-${Math.random().toString(36).substr(2, 9)}`,
                      sectionId: secId, day, periodIndex: p.pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
                    });
                  }
                });
              });
            });
            placedCount++;
          }
        }
      }
      unplacedRegularCount += (periodsNeeded - placedCount);
    });

    // --- B. Place Elective Groups (High Priority) ---
    const sortedElectiveGroups = [...electiveGroups].sort((a, b) => {
      const targetSectionsA = (a.sectionIds?.length || 0) > 0 ? a.sectionIds!.length : sections.filter(s => s.gradeId === a.gradeId).length;
      const targetSectionsB = (b.sectionIds?.length || 0) > 0 ? b.sectionIds!.length : sections.filter(s => s.gradeId === b.gradeId).length;
      return (targetSectionsB * b.periodsPerWeek) - (targetSectionsA * a.periodsPerWeek);
    });

    sortedElectiveGroups.forEach(eg => {
      const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds! : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
      if (targetSectionIds.length === 0) return;
      
      let placedCount = currentEntries.filter(e => e.electiveGroupId === eg.id && targetSectionIds.includes(e.sectionId)).length / targetSectionIds.length;
      if (placedCount >= eg.periodsPerWeek) return;

      const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
      
      // Pass 1: Spread across days
      for (const day of shuffledDays) {
        if (placedCount >= eg.periodsPerWeek) break;
        const structure = gradeStructures[eg.gradeId];
        const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;
        
        // Find the best period for this day (one where most teachers are free)
        const periodScores = Array.from({length: periodCount}, (_, i) => i).map(pIdx => {
          let teacherConflictCount = 0;
          const isPossible = (currentEntries.filter(e => e.electiveGroupId === eg.id && e.day === day).length < 1) &&
                         targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx)) &&
                         eg.subjectTeacherPairs.every(pair => {
                           const teachersFree = targetSectionIds.every(secId => {
                             const isFree = !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries);
                             if (!isFree) teacherConflictCount++;
                             return isFree;
                           });
                           return teachersFree;
                         });
          return { pIdx, isPossible, teacherConflictCount };
        }).filter(p => p.isPossible).sort((a, b) => a.teacherConflictCount - b.teacherConflictCount || Math.random() - 0.5);

        if (periodScores.length > 0) {
          const pIdx = periodScores[0].pIdx;
          targetSectionIds.forEach(secId => {
            eg.subjectTeacherPairs.forEach(pair => {
              currentEntries.push({
                id: `gen-elective-${eg.id}-${secId}-${day}-${pIdx}-${pair.subjectId}`,
                sectionId: secId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
              });
            });
          });
          placedCount++;
        }
      }

      // Pass 2: Fill remaining
      if (placedCount < eg.periodsPerWeek) {
        for (const day of shuffledDays) {
          if (placedCount >= eg.periodsPerWeek) break;
          const structure = gradeStructures[eg.gradeId];
          const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;
          
          const periodScores = Array.from({length: periodCount}, (_, i) => i).map(pIdx => {
            let teacherConflictCount = 0;
            const dayUsage = currentEntries.filter(e => e.electiveGroupId === eg.id && e.day === day).length;
            const isPossible = (dayUsage < eg.maxPeriodsPerDay) &&
                           targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx)) &&
                           eg.subjectTeacherPairs.every(pair => {
                             const teachersFree = targetSectionIds.every(secId => {
                               const isFree = !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries);
                               if (!isFree) teacherConflictCount++;
                               return isFree;
                             });
                             return teachersFree;
                           });
            return { pIdx, isPossible, teacherConflictCount };
          }).filter(p => p.isPossible).sort((a, b) => a.teacherConflictCount - b.teacherConflictCount || Math.random() - 0.5);

          for (const p of periodScores) {
            if (placedCount >= eg.periodsPerWeek) break;
            const dayUsage = currentEntries.filter(e => e.electiveGroupId === eg.id && e.day === day).length;
            if (dayUsage >= eg.maxPeriodsPerDay) break;

            targetSectionIds.forEach(secId => {
              eg.subjectTeacherPairs.forEach(pair => {
                currentEntries.push({
                  id: `gen-elective-${eg.id}-${secId}-${day}-${p.pIdx}-${pair.subjectId}`,
                  sectionId: secId, day, periodIndex: p.pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
                });
              });
            });
            placedCount++;
          }
        }
      }
      unplacedRegularCount += (eg.periodsPerWeek - placedCount);
    });

    // --- C. Place Regular Subjects (Layered Strategy) ---
    const teacherTotalLoad: Record<string, number> = {};
    const teacherAvailability: Record<string, number> = {};
    
    teachers.forEach(t => {
      const unavailableCount = t.unavailableSlots?.length || 0;
      teacherAvailability[t.id] = 40 - unavailableCount; // Assuming 40 slots per week
    });

    sections.forEach(s => s.assignments.forEach(a => {
      const sub = subjects.find(sub => sub.id === a.subjectId);
      if (sub) {
        teacherTotalLoad[a.teacherId] = (teacherTotalLoad[a.teacherId] || 0) + sub.maxPeriodsPerWeek;
      }
    }));

    const assignmentsToPlace: { sectionId: string, subjectId: string, teacherId: string, sub: Subject, difficulty: number, layer: number }[] = [];
    sectionsToProcess.forEach(section => {
      section.assignments.forEach(a => {
        if (!section.subjectIds.includes(a.subjectId)) return;
        const sub = subjects.find(s => s.id === a.subjectId);
        if (!sub) return;
        
        const placedCount = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId).length;
        const remaining = sub.maxPeriodsPerWeek - placedCount;
        
        if (remaining > 0) {
          const isSync = syncConstraints.some(sync => sync.subjectId === a.subjectId);
          const isSim = simultaneousConstraints.some(sim => sim.sectionSubjectPairs.some(p => p.subjectId === a.subjectId));
          const isElective = electiveGroups.some(eg => eg.subjectTeacherPairs.some(p => p.subjectId === a.subjectId));
          
          // Granular difficulty scoring
          const density = sub.maxPeriodsPerWeek / sub.maxPeriodsPerDay;
          const teacherLoadFactor = teacherTotalLoad[a.teacherId] / (teacherAvailability[a.teacherId] || 1);
          const teacherScarcity = teacherTotalLoad[a.teacherId] > 30 ? 200 : 0; // Teachers with very high load
          
          const difficulty = (remaining * 30) + 
                            (density * 50) +
                            (teacherLoadFactor * 120) +
                            (teacherScarcity) +
                            (isSync ? 800 : 0) +
                            (isSim ? 700 : 0) +
                            (isElective ? 600 : 0);
          
          for (let i = 0; i < remaining; i++) {
            assignmentsToPlace.push({ ...a, sectionId: section.id, sub, difficulty, layer: i });
          }
        }
      });
    });

    // Sort by layer first, then difficulty
    const sortedAssignments = assignmentsToPlace.sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      const randomness = (attempt / maxAttempts) * 20;
      return (b.difficulty - a.difficulty) + (Math.random() - 0.5) * randomness;
    });

    sortedAssignments.forEach(item => {
      const { sectionId, subjectId, teacherId, sub } = item;
      const section = sections.find(s => s.id === sectionId);
      const structure = gradeStructures[section?.gradeId || ''];
      if (!structure) return;
      const periodSlots = structure.slots.filter(s => s.type === 'period');

      const dayUsage = currentEntries.filter(e => e.sectionId === sectionId && e.subjectId === subjectId).reduce((acc, e) => {
        acc[e.day] = (acc[e.day] || 0) + 1;
        return acc;
      }, {} as Record<Day, number>);

      let placed = false;
      const sortedDays = [...DAYS].sort((a, b) => {
        const usageA = dayUsage[a] || 0;
        const usageB = dayUsage[b] || 0;
        if (usageA !== usageB) return usageA - usageB;
        
        const sectionLoadA = currentEntries.filter(e => e.sectionId === sectionId && e.day === a).length;
        const sectionLoadB = currentEntries.filter(e => e.sectionId === sectionId && e.day === b).length;
        if (sectionLoadA !== sectionLoadB) return sectionLoadA - sectionLoadB;

        const teacherLoadA = currentEntries.filter(e => e.teacherId === teacherId && e.day === a).length;
        const teacherLoadB = currentEntries.filter(e => e.teacherId === teacherId && e.day === b).length;
        return teacherLoadA - teacherLoadB || Math.random() - 0.5;
      });

      for (const day of sortedDays) {
        if (placed) break;
        if ((dayUsage[day] || 0) >= sub.maxPeriodsPerDay) continue;

        const possibleSlots = periodSlots.map((_, i) => i).filter(pIdx => 
          !currentEntries.some(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx) &&
          !isTeacherBusy(teacherId, day, pIdx, sectionId, subjectId, currentEntries)
        );

        if (possibleSlots.length > 0) {
          // Score each possible slot for integrity
          const scoredSlots = possibleSlots.map(pIdx => {
            let score = 1000;
            
            // 1. Period Preference: core/difficult subjects prefer earlier periods
            // (pIdx 0-3 are usually morning)
            if (item.difficulty > 500) {
              score -= pIdx * 50; 
            }

            // 2. Teacher Rest: avoid too many consecutive periods
            const prevBusy = currentEntries.some(e => e.teacherId === teacherId && e.day === day && e.periodIndex === pIdx - 1);
            const nextBusy = currentEntries.some(e => e.teacherId === teacherId && e.day === day && e.periodIndex === pIdx + 1);
            if (prevBusy) score -= 20;
            if (nextBusy) score -= 20;
            
            // Check for long streaks
            let streak = 0;
            for (let i = pIdx - 1; i >= 0; i--) {
              if (currentEntries.some(e => e.teacherId === teacherId && e.day === day && e.periodIndex === i)) streak++;
              else break;
            }
            for (let i = pIdx + 1; i < periodSlots.length; i++) {
              if (currentEntries.some(e => e.teacherId === teacherId && e.day === day && e.periodIndex === i)) streak++;
              else break;
            }
            if (streak >= 3) score -= 100;

            // 3. Subject Distribution: avoid same subject back-to-back if not allowed
            if (!sub.allowBackToBack) {
              const prevSub = currentEntries.some(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx - 1 && e.subjectId === subjectId);
              const nextSub = currentEntries.some(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx + 1 && e.subjectId === subjectId);
              if (prevSub || nextSub) score -= 500;
            }

            return { pIdx, score };
          }).sort((a, b) => b.score - a.score);

          const pIdx = scoredSlots[0].pIdx;
          
          currentEntries.push({
            id: `auto-${Math.random().toString(36).substr(2, 9)}`,
            sectionId, day, periodIndex: pIdx, subjectId, teacherId
          });
          placed = true;
        }
      }

      // --- Repair: Try to swap if still not placed ---
      if (!placed) {
        for (const day of sortedDays) {
          if (placed) break;
          if ((dayUsage[day] || 0) >= sub.maxPeriodsPerDay) continue;

          // Find slots where section is free but teacher is busy
          const possibleConflictSlots = periodSlots.map((_, i) => i).filter(pIdx => 
            !currentEntries.some(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx)
          );

          for (const pIdx of possibleConflictSlots) {
            if (placed) break;
            
            // Find ALL entries that are blocking the teacher in this slot
            // (There might be multiple if there are overlapping slots in different grade structures)
            const blockingEntries = currentEntries.filter(e => 
              e.teacherId === teacherId && e.day === day && 
              // Check for time overlap
              (() => {
                const s1 = sections.find(s => s.id === sectionId);
                const st1 = gradeStructures[s1?.gradeId || ''];
                const slot1 = st1?.slots.filter(s => s.type === 'period')[pIdx];
                
                const s2 = sections.find(s => s.id === e.sectionId);
                const st2 = gradeStructures[s2?.gradeId || ''];
                const slot2 = st2?.slots.filter(s => s.type === 'period')[e.periodIndex];
                
                if (!slot1 || !slot2) return false;
                const start1 = timeToMinutes(slot1.startTime);
                const end1 = timeToMinutes(slot1.endTime);
                const start2 = timeToMinutes(slot2.startTime);
                const end2 = timeToMinutes(slot2.endTime);
                return start1 < end2 && start2 < end1;
              })() &&
              !e.id.startsWith('sync-') && !e.id.startsWith('sim-') && !e.electiveGroupId
            );

            if (blockingEntries.length > 0 && blockingEntries.length <= 3) {
              // Try to move ALL blocking entries
              let allMoved = true;
              const entriesToMove = [...blockingEntries];
              const originalStates = entriesToMove.map(e => ({ id: e.id, day: e.day, pIdx: e.periodIndex }));
              
              for (const entryToMove of entriesToMove) {
                const otherSection = sections.find(s => s.id === entryToMove.sectionId);
                const otherStructure = gradeStructures[otherSection?.gradeId || ''];
                const otherPeriodSlots = otherStructure?.slots.filter(s => s.type === 'period') || [];
                const otherSub = subjects.find(s => s.id === entryToMove.subjectId);
                
                if (!otherSub) { allMoved = false; break; }

                const alternativeSlots: {day: Day, pIdx: number}[] = [];
                DAYS.forEach(d => {
                  if (d !== entryToMove.day) {
                    const otherDayUsage = currentEntries.filter(e => e.sectionId === entryToMove.sectionId && e.subjectId === entryToMove.subjectId && e.day === d).length;
                    if (otherDayUsage >= otherSub.maxPeriodsPerDay) return;
                  }

                  otherPeriodSlots.forEach((_, apIdx) => {
                    if (currentEntries.some(e => e.sectionId === entryToMove.sectionId && e.day === d && e.periodIndex === apIdx)) return;
                    // Check if teacher is busy, excluding ALL entries we are currently trying to move
                    const excludingIds = entriesToMove.map(e => e.id);
                    if (isTeacherBusy(entryToMove.teacherId, d, apIdx, entryToMove.sectionId, entryToMove.subjectId, currentEntries.filter(e => !excludingIds.includes(e.id)))) return;
                    alternativeSlots.push({day: d, pIdx: apIdx});
                  });
                });

                if (alternativeSlots.length > 0) {
                  const bestAlt = alternativeSlots.sort(() => Math.random() - 0.5)[0];
                  entryToMove.day = bestAlt.day;
                  entryToMove.periodIndex = bestAlt.pIdx;
                } else {
                  allMoved = false;
                  break;
                }
              }

              if (allMoved) {
                currentEntries.push({
                  id: `auto-repair-${Math.random().toString(36).substr(2, 9)}`,
                  sectionId, day, periodIndex: pIdx, subjectId, teacherId
                });
                placed = true;
              } else {
                // Rollback
                originalStates.forEach(state => {
                  const e = entriesToMove.find(ent => ent.id === state.id);
                  if (e) { e.day = state.day; e.periodIndex = state.pIdx; }
                });
              }
            }
          }
        }
      }

      if (!placed) {
        unplacedRegularCount++;
      }
    });

    // --- D. Final Gap Filling Pass (Ensure 100% occupancy) ---
    sectionsToProcess.forEach(section => {
      const structure = gradeStructures[section.gradeId];
      if (!structure) return;
      const periodSlots = structure.slots.filter(s => s.type === 'period');

      DAYS.forEach(day => {
        periodSlots.forEach((_, pIdx) => {
          const hasEntry = currentEntries.some(e => e.sectionId === section.id && e.day === day && e.periodIndex === pIdx);
          if (!hasEntry) {
            // Find ALL available assignments for this gap that STILL HAVE CAPACITY
            const candidates = section.assignments.filter(a => {
              const sub = subjects.find(s => s.id === a.subjectId);
              if (!sub) return false;
              
              // STRICT: Check weekly limit
              const weeklyUsage = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId).length;
              if (weeklyUsage >= sub.maxPeriodsPerWeek) return false;

              // STRICT: Check daily limit
              const dayUsage = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId && e.day === day).length;
              if (dayUsage >= sub.maxPeriodsPerDay) return false;

              // Check teacher availability
              if (isTeacherBusy(a.teacherId, day, pIdx, section.id, a.subjectId, currentEntries)) return false;

              return true;
            }).map(a => {
              const sub = subjects.find(s => s.id === a.subjectId)!;
              const dayUsage = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId && e.day === day).length;
              const weeklyUsage = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId).length;
              
              // Score candidates: prefer those with least daily usage and furthest from weekly limit
              let score = 1000;
              score -= dayUsage * 200; // Heavily penalize same-day repeats
              score += (sub.maxPeriodsPerWeek - weeklyUsage) * 10; // Prefer subjects with more remaining capacity
              
              return { assignment: a, score };
            }).sort((a, b) => b.score - a.score);

            if (candidates.length > 0) {
              const best = candidates[0].assignment;
              currentEntries.push({
                id: `gap-${Math.random().toString(36).substr(2, 9)}`,
                sectionId: section.id,
                day,
                periodIndex: pIdx,
                subjectId: best.subjectId,
                teacherId: best.teacherId
              });
            }
          }
        });
      });
    });

    // --- E. Final Error Counting ---
    // A perfect timetable has NO empty slots (if assignments cover them) 
    // AND all assignments placed.
    let totalMissingPeriods = 0;
    sectionsToProcess.forEach(section => {
      const structure = gradeStructures[section.gradeId];
      if (!structure) return;
      const periodSlots = structure.slots.filter(s => s.type === 'period');
      const totalSlots = periodSlots.length * DAYS.length;
      
      // 1. Check if all required assignments are placed
      section.assignments.forEach(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        if (!sub) return;
        const placed = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId).length;
        if (placed < sub.maxPeriodsPerWeek) {
          totalMissingPeriods += (sub.maxPeriodsPerWeek - placed);
        }
      });

      // 2. Check for empty slots (gaps)
      const sectionEntries = currentEntries.filter(e => e.sectionId === section.id);
      const emptySlots = totalSlots - sectionEntries.length;
      // We only count empty slots as errors if there are assignments that COULD have filled them
      // (i.e. if sum(maxPeriodsPerWeek) >= totalSlots)
      const totalRequestedForSection = section.assignments.reduce((sum, a) => sum + (subjects.find(s => s.id === a.subjectId)?.maxPeriodsPerWeek || 0), 0);
      if (totalRequestedForSection >= totalSlots) {
        totalMissingPeriods += emptySlots;
      }
    });

    const finalErrorScore = totalMissingPeriods;

    if (finalErrorScore < minErrors) {
      minErrors = finalErrorScore;
      bestGlobalEntries = currentEntries;
      if (minErrors > 0) {
        console.log(`Attempt ${attempt + 1}: Found solution with ${minErrors} missing periods/gaps.`);
      }
    }
    if (minErrors === 0) {
      console.log(`Attempt ${attempt + 1}: Success! Found perfect conflict-free timetable.`);
      break;
    }
  }

  if (minErrors > 0) {
    console.warn(`Auto-generation finished with ${minErrors} remaining issues. Some periods may be empty or constraints violated.`);
  }

  return bestGlobalEntries;
}
