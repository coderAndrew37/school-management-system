// lib/utils/promotion-utils.ts

export const CBC_ORDER = [
  "PP1", "PP2", 
  "Grade 1", "Grade 2", "Grade 3", 
  "Grade 4", "Grade 5", "Grade 6", 
  "Grade 7", "Grade 8", "Grade 9"
];

export const getNextGrade = (current: string): string | null => {
  const idx = CBC_ORDER.indexOf(current);
  if (idx === -1 || idx === CBC_ORDER.length - 1) return null;
  return CBC_ORDER[idx + 1];
};

/**
 * Maps the grade to the DB level check constraint
 */
export const getGradeLevel = (grade: string): string => {
  if (["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"].includes(grade)) {
    return "lower_primary";
  }
  if (["Grade 4", "Grade 5", "Grade 6"].includes(grade)) {
    return "upper_primary";
  }
  return "junior_secondary";
};