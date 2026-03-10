import { Day, Subject, Teacher, Section, TimetableEntry, SyncConstraint, SimultaneousConstraint, ValidationResult, GradeStructure, ElectiveGroup } from '../types';

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function validateTimetable(
  entries: TimetableEntry[],
  subjects: Subject[],
  teachers: Teacher[],
  sections: Section[],
  syncConstraints: SyncConstraint[],
  gradeStructures: GradeStructure[],
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

        if (!isSimultaneousSplit) {
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
  subjects: Subject[],
  teachers: Teacher[],
  sections: Section[],
  gradeStructures: Record<string, GradeStructure>,
  syncConstraints: SyncConstraint[],
  simultaneousConstraints: SimultaneousConstraint[] = [],
  electiveGroups: ElectiveGroup[] = [],
  existingEntries: TimetableEntry[] = [],
  targetSectionId?: string
): TimetableEntry[] {
  // If targetSectionId is provided, we keep entries for other sections
  const baseEntries: TimetableEntry[] = targetSectionId 
    ? [...existingEntries.filter(e => e.sectionId !== targetSectionId)]
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
      return currentEntries.some(e => e.electiveGroupId === eg.id && e.day === day && e.periodIndex === periodIndex);
    });
    
    if (isBusyInElective) {
      // Exception: If the current request is for the SAME elective group, it's not "busy" (it's shared)
      const alreadyPlacedInSameGroup = currentEntries.some(e => 
        e.electiveGroupId && 
        electiveGroups.some(eg => eg.id === e.electiveGroupId && eg.subjectTeacherPairs.some(p => p.teacherId === teacherId)) &&
        e.day === day && 
        e.periodIndex === periodIndex &&
        electiveGroups.some(eg => eg.id === e.electiveGroupId && ((eg.sectionIds?.length || 0) === 0 || eg.sectionIds.includes(sectionId)))
      );
      if (alreadyPlacedInSameGroup) return false;
      return true;
    }

    const section = sections.find(s => s.id === sectionId);
    const structure = gradeStructures[section?.gradeId || ''];
    if (!structure) return false;
    const slot = structure.slots.filter(s => s.type === 'period')[periodIndex];
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

      const sameElectiveGroup = e.electiveGroupId && electiveGroups.some(eg => eg.id === e.electiveGroupId && currentEntries.some(ce => ce.day === day && ce.periodIndex === periodIndex && ce.sectionId === sectionId && ce.electiveGroupId === eg.id));
      if (sameElectiveGroup) return false;

      const otherSection = sections.find(s => s.id === e.sectionId);
      const otherStructure = gradeStructures[otherSection?.gradeId || ''];
      if (!otherStructure) return false;
      const otherSlot = otherStructure.slots.filter(s => s.type === 'period')[e.periodIndex];
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
  
  syncConstraints.forEach(sync => {
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

  simultaneousConstraints.filter(sim => !sim.isAlways).forEach(sim => {
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
      const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
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

  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let currentEntries = [...anchorEntries];
    let failedToPlace = 0;

    // --- A. Place "Always" Simultaneous Constraints (Highest Priority) ---
    simultaneousConstraints.filter(sim => sim.isAlways).forEach(sim => {
      // Determine how many periods we need to place
      const firstPair = sim.sectionSubjectPairs[0];
      const sub = subjects.find(s => s.id === (firstPair?.subjectId || ''));
      const periodsNeeded = sub?.maxPeriodsPerWeek || 0;
      let placedCount = 0;

      const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
      for (const day of shuffledDays) {
        if (placedCount >= periodsNeeded) break;
        
        // Get period count for the first involved section
        const section = sections.find(s => s.id === firstPair.sectionId);
        const structure = gradeStructures[section?.gradeId || ''];
        const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;
        const shuffledPeriods = Array.from({length: periodCount}, (_, i) => i).sort(() => Math.random() - 0.5);
        
        for (const pIdx of shuffledPeriods) {
          if (placedCount >= periodsNeeded) break;

          // Check if all pairs and elective groups are free
          const allFree = sim.sectionSubjectPairs.every(pair => {
            const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
            if (!assignment) return false;
            return !currentEntries.some(e => e.sectionId === pair.sectionId && e.day === day && e.periodIndex === pIdx) &&
                   !isTeacherBusy(assignment.teacherId, day, pIdx, pair.sectionId, pair.subjectId, currentEntries);
          }) && (sim.electiveGroupIds || []).every(groupId => {
            const eg = electiveGroups.find(g => g.id === groupId);
            if (!eg) return true;
            const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
            return targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx)) &&
                   eg.subjectTeacherPairs.every(pair => targetSectionIds.every(secId => !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries)));
          });

          if (allFree) {
            sim.sectionSubjectPairs.forEach(pair => {
              const assignment = sections.find(s => s.id === pair.sectionId)?.assignments.find(a => a.subjectId === pair.subjectId);
              if (assignment) {
                currentEntries.push({
                  id: `sim-always-${Math.random().toString(36).substr(2, 9)}`,
                  sectionId: pair.sectionId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: assignment.teacherId
                });
              }
            });
            sim.electiveGroupIds?.forEach(groupId => {
              const eg = electiveGroups.find(g => g.id === groupId);
              if (!eg) return;
              const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
              targetSectionIds.forEach(secId => {
                const pair = eg.subjectTeacherPairs[0];
                currentEntries.push({
                  id: `sim-always-eg-${Math.random().toString(36).substr(2, 9)}`,
                  sectionId: secId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
                });
              });
            });
            placedCount++;
          }
        }
      }
      failedToPlace += (periodsNeeded - placedCount);
    });

    // --- B. Place Elective Groups (High Priority) ---
    electiveGroups.forEach(eg => {
      const targetSectionIds = (eg.sectionIds?.length || 0) > 0 ? eg.sectionIds : sections.filter(s => s.gradeId === eg.gradeId).map(s => s.id);
      if (targetSectionIds.length === 0) return;
      
      // Check if already placed by a Sim constraint
      let placedCount = currentEntries.filter(e => e.electiveGroupId === eg.id && targetSectionIds.includes(e.sectionId)).length / targetSectionIds.length;
      if (placedCount >= eg.periodsPerWeek) return;

      const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);
      for (const day of shuffledDays) {
        if (placedCount >= eg.periodsPerWeek) break;
        
        const structure = gradeStructures[eg.gradeId];
        const periodCount = structure?.slots.filter(s => s.type === 'period').length || 8;
        const shuffledPeriods = Array.from({length: periodCount}, (_, i) => i).sort(() => Math.random() - 0.5);
        
        for (const pIdx of shuffledPeriods) {
          if (placedCount >= eg.periodsPerWeek) break;
          if (placedCount < eg.periodsPerWeek && currentEntries.filter(e => e.electiveGroupId === eg.id && e.day === day).length >= eg.maxPeriodsPerDay) continue;

          const allFree = targetSectionIds.every(secId => !currentEntries.some(e => e.sectionId === secId && e.day === day && e.periodIndex === pIdx)) &&
                         eg.subjectTeacherPairs.every(pair => targetSectionIds.every(secId => !isTeacherBusy(pair.teacherId, day, pIdx, secId, pair.subjectId, currentEntries)));

          if (allFree) {
            targetSectionIds.forEach(secId => {
              const pair = eg.subjectTeacherPairs[0];
              currentEntries.push({
                id: `gen-elective-${eg.id}-${secId}-${day}-${pIdx}`,
                sectionId: secId, day, periodIndex: pIdx, subjectId: pair.subjectId, teacherId: pair.teacherId, electiveGroupId: eg.id
              });
            });
            placedCount++;
          }
        }
      }
      failedToPlace += (eg.periodsPerWeek - placedCount);
    });

    // --- C. Place Regular Subjects (Fill in the blanks) ---
    const teacherTotalLoad: Record<string, number> = {};
    sections.forEach(s => s.assignments.forEach(a => {
      const sub = subjects.find(sub => sub.id === a.subjectId);
      if (sub) teacherTotalLoad[a.teacherId] = (teacherTotalLoad[a.teacherId] || 0) + sub.maxPeriodsPerWeek;
    }));

    const remainingAssignments: { sectionId: string, subjectId: string, teacherId: string, sub: Subject, difficulty: number }[] = [];
    sectionsToProcess.forEach(section => {
      section.assignments.forEach(a => {
        if (!section.subjectIds.includes(a.subjectId)) return;
        const sub = subjects.find(s => s.id === a.subjectId);
        if (!sub) return;
        
        const placedCount = currentEntries.filter(e => e.sectionId === section.id && e.subjectId === a.subjectId).length;
        const remaining = sub.maxPeriodsPerWeek - placedCount;
        
        if (remaining > 0) {
          const difficulty = (sub.maxPeriodsPerWeek / sub.maxPeriodsPerDay) * (teacherTotalLoad[a.teacherId] || 1);
          for (let i = 0; i < remaining; i++) {
            remainingAssignments.push({ ...a, sectionId: section.id, sub, difficulty });
          }
        }
      });
    });

    // Group and sort by difficulty
    const groupedAssignments: Record<string, typeof remainingAssignments> = {};
    remainingAssignments.forEach(a => {
      const key = `${a.sectionId}-${a.subjectId}`;
      if (!groupedAssignments[key]) groupedAssignments[key] = [];
      groupedAssignments[key].push(a);
    });

    const sortedKeys = Object.keys(groupedAssignments).sort((a, b) => {
      const diffA = groupedAssignments[a][0].difficulty;
      const diffB = groupedAssignments[b][0].difficulty;
      const randomness = (attempt / maxAttempts) * 5;
      return (diffB - diffA) + (Math.random() - 0.5) * randomness;
    });

    sortedKeys.forEach(key => {
      const items = groupedAssignments[key];
      const { sectionId, subjectId, teacherId, sub } = items[0];
      const structure = gradeStructures[sections.find(s => s.id === sectionId)?.gradeId || ''];
      if (!structure) return;
      const periodSlots = structure.slots.filter(s => s.type === 'period');

      const dayUsage: Record<Day, number> = { 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0 };
      currentEntries.filter(e => e.sectionId === sectionId && e.subjectId === subjectId).forEach(e => dayUsage[e.day]++);

      let itemsToPlace = [...items];
      while (itemsToPlace.length > 0) {
        let placed = false;
        const sortedDays = [...DAYS].sort((a, b) => {
          if (dayUsage[a] !== dayUsage[b]) return dayUsage[a] - dayUsage[b];
          const loadA = currentEntries.filter(e => e.sectionId === sectionId && e.day === a).length;
          const loadB = currentEntries.filter(e => e.sectionId === sectionId && e.day === b).length;
          return loadA - loadB || Math.random() - 0.5;
        });

        for (const day of sortedDays) {
          if (placed) break;
          if (dayUsage[day] >= sub.maxPeriodsPerDay) continue;

          const freeSlots = periodSlots.map((_, i) => i).filter(pIdx => 
            !currentEntries.some(e => e.sectionId === sectionId && e.day === day && e.periodIndex === pIdx) &&
            !isTeacherBusy(teacherId, day, pIdx, sectionId, subjectId, currentEntries)
          );

          if (freeSlots.length === 0) continue;

          const neededToday = Math.min(itemsToPlace.length, sub.maxPeriodsPerDay - dayUsage[day]);
          const shouldTryBlock = sub.allowBackToBack && neededToday > 1 && Math.random() > 0.4;

          if (shouldTryBlock) {
            for (let i = 0; i <= freeSlots.length - neededToday; i++) {
              const candidateSlots = freeSlots.slice(i, i + neededToday);
              const isContinuous = candidateSlots.every((val, idx) => idx === 0 || val === candidateSlots[idx - 1] + 1);
              if (isContinuous) {
                candidateSlots.forEach(pIdx => {
                  currentEntries.push({
                    id: `auto-${Math.random().toString(36).substr(2, 9)}`,
                    sectionId, day, periodIndex: pIdx, subjectId, teacherId
                  });
                });
                dayUsage[day] += neededToday;
                itemsToPlace = itemsToPlace.slice(neededToday);
                placed = true;
                break;
              }
            }
          }

          if (!placed && freeSlots.length > 0) {
            const pIdx = freeSlots[Math.floor(Math.random() * freeSlots.length)];
            currentEntries.push({
              id: `auto-${Math.random().toString(36).substr(2, 9)}`,
              sectionId, day, periodIndex: pIdx, subjectId, teacherId
            });
            dayUsage[day]++;
            itemsToPlace = itemsToPlace.slice(1);
            placed = true;
          }
        }

        if (!placed) {
          failedToPlace += itemsToPlace.length;
          itemsToPlace = [];
        }
      }
    });

    if (failedToPlace < minErrors) {
      minErrors = failedToPlace;
      bestGlobalEntries = currentEntries;
    }
    if (minErrors === 0) break;
  }

  return bestGlobalEntries;
}
