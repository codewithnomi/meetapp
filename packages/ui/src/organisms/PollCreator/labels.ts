// Sample labels for the PollCreator stories and tests (the app passes translated words).
import type { PollCreatorProps } from "./PollCreator.tsx";

export const SAMPLE_POLL_LABELS: PollCreatorProps["labels"] = {
  title: "Create a poll",
  description: "Everyone in the meeting can vote.",
  close: "Close",
  question: "Question",
  questionHint: "Up to 200 characters",
  answers: "Answers (2 to 10)",
  answer: (n) => `Answer ${String(n)}`,
  removeAnswer: (n) => `Remove answer ${String(n)}`,
  addAnswer: "Add an answer",
  multiple: "Allow more than one answer",
  anonymous: "Anonymous votes",
  anonymousHint: "Nobody, not even you, will see who voted for what.",
  cancel: "Cancel",
  post: "Post poll",
};
