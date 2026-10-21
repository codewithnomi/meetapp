// A poll in the meeting chat (F03 AC-F03-21–23): the poll card, results after voting, Close for those allowed.
import type { PollView } from "@meetapp/contracts";
import { PollCard } from "@meetapp/ui";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { closePoll, pollOf, votePoll } from "../../features/meetings/chat/index.ts";
import type { ChatView } from "./chat-view.ts";

/** A poll in the chat: fetched for this viewer (results only after voting), again after poll news. */
export function PollMessage({ view, pollId }: { view: ChatView; pollId: string }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const version = view.chat.state.pollVersions[pollId] ?? 0;
  const key = ["chat-poll", pollId, version];
  // A vote raises the version: keep showing the last result while the new one loads, so the card never blinks.
  const poll = useQuery<PollView>({
    queryKey: key,
    queryFn: () => pollOf(view.place, pollId),
    placeholderData: keepPreviousData,
  });
  if (!poll.data) return null;
  const p = poll.data;
  const vote = (optionIds: string[]) =>
    void votePoll(view.place, pollId, optionIds).then((next) => queries.setQueryData(key, next), view.onFailed);
  const kind = t(p.multiple ? "meetings.chat.poll.several" : "meetings.chat.poll.one");
  const names = t(p.anonymous ? "meetings.chat.poll.anonymous" : "meetings.chat.poll.named");
  return (
    <PollCard
      question={p.question}
      about={t("meetings.chat.poll.about", { name: p.creatorName, kind, names })}
      options={p.options}
      multiple={p.multiple}
      chosen={p.yourChoice}
      results={
        p.results
          ? {
              summary: t("meetings.chat.poll.voters", { count: p.results.voters }),
              options: p.results.options.map((o) => ({
                ...o,
                label: t("meetings.chat.poll.result", { percent: o.percent, votes: o.votes }),
              })),
            }
          : undefined
      }
      hint={t("meetings.chat.poll.voteToSee")}
      closedLabel={p.closed ? t("meetings.chat.poll.closed") : undefined}
      onVote={vote}
      close={
        view.rights.moderate && !view.readOnly
          ? {
              label: t("meetings.chat.poll.close"),
              onClose: () => void closePoll(view.place, pollId).catch(view.onFailed),
            }
          : undefined
      }
    />
  );
}
