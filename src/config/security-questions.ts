export const PREDEFINED_SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What was your childhood nickname?",
  "What was the name of your first pet?",
  "Who was your favorite teacher?",
  "What was the title of a book you remember from childhood?",
] as const;

export const CUSTOM_SECURITY_QUESTION = "Custom Question" as const;

export const SECURITY_QUESTION_OPTIONS = [
  ...PREDEFINED_SECURITY_QUESTIONS,
  CUSTOM_SECURITY_QUESTION,
] as const;

export type SecurityQuestionOption = (typeof SECURITY_QUESTION_OPTIONS)[number];

export function resolveSecurityQuestion(
  selectedQuestion: SecurityQuestionOption,
  customQuestion?: string
): string | null {
  if (selectedQuestion !== CUSTOM_SECURITY_QUESTION) return selectedQuestion;
  const resolved = customQuestion?.trim();
  return resolved || null;
}
