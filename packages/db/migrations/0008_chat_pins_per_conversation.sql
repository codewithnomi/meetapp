-- At most 3 pinned messages per chat (F14 AC-F14-19; F03 AC-F03-19 for meetings). One-to-one and group
-- chats have no meeting, so the count is now per conversation, with the conversation row locked first
-- so two pins at the same moment can't both slip past it. A pin row without a conversation (before the
-- F14 fill) keeps the old per-meeting count.
CREATE OR REPLACE FUNCTION "chat_pins_limit"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."conversation_id" IS NOT NULL THEN
    PERFORM 1 FROM "conversations" WHERE "id" = NEW."conversation_id" FOR UPDATE;
    IF (SELECT count(*) FROM "chat_pins" WHERE "conversation_id" = NEW."conversation_id") >= 3 THEN
      RAISE EXCEPTION 'a chat has at most 3 pinned messages' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    PERFORM 1 FROM "meetings" WHERE "id" = NEW."meeting_id" FOR UPDATE;
    IF (SELECT count(*) FROM "chat_pins" WHERE "meeting_id" = NEW."meeting_id") >= 3 THEN
      RAISE EXCEPTION 'a meeting has at most 3 pinned messages' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
