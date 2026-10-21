// The words of the chat's message box and poll form (F03), written out key by key so the compiler checks
// every translation key (code-quality review, verification round 1).
import type { ChatComposerLabels, PollCreatorProps } from "@meetapp/ui";
import type { TFunction } from "i18next";

export const composerLabels = (t: TFunction): ChatComposerLabels => ({
  placeholder: t("meetings.chat.composer.placeholder"),
  send: t("meetings.chat.composer.send"),
  format: t("meetings.chat.composer.format"),
  emoji: t("meetings.chat.composer.emoji"),
  formatting: t("meetings.chat.composer.formatting"),
  bold: t("meetings.chat.composer.bold"),
  italic: t("meetings.chat.composer.italic"),
  underline: t("meetings.chat.composer.underline"),
  strike: t("meetings.chat.composer.strike"),
  bulletList: t("meetings.chat.composer.bulletList"),
  orderedList: t("meetings.chat.composer.orderedList"),
  quote: t("meetings.chat.composer.quote"),
  link: t("meetings.chat.composer.link"),
  linkAddress: t("meetings.chat.composer.linkAddress"),
  applyLink: t("meetings.chat.composer.applyLink"),
  code: t("meetings.chat.composer.code"),
  codeBlock: t("meetings.chat.composer.codeBlock"),
});

export const pollLabels = (t: TFunction): PollCreatorProps["labels"] => ({
  title: t("meetings.chat.newPoll.title"),
  description: t("meetings.chat.newPoll.description"),
  close: t("meetings.chat.newPoll.close"),
  question: t("meetings.chat.newPoll.question"),
  questionHint: t("meetings.chat.newPoll.questionHint"),
  answers: t("meetings.chat.newPoll.answers"),
  answer: (n: number) => t("meetings.chat.newPoll.answer", { n }),
  removeAnswer: (n: number) => t("meetings.chat.newPoll.removeAnswer", { n }),
  addAnswer: t("meetings.chat.newPoll.addAnswer"),
  multiple: t("meetings.chat.newPoll.multiple"),
  anonymous: t("meetings.chat.newPoll.anonymous"),
  anonymousHint: t("meetings.chat.newPoll.anonymousHint"),
  cancel: t("meetings.chat.newPoll.cancel"),
  post: t("meetings.chat.newPoll.post"),
});
