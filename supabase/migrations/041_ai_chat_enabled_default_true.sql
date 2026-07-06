-- Migration 041: Enable AI chat by default on all conversations
-- Previously ai_chat_enabled defaulted to FALSE, meaning every new
-- conversation required a manual toggle before the AI receptionist
-- would reply.  This flips the default to TRUE so the AI auto-replies
-- out of the box, and bulk-enables it on all existing conversations.

-- 1. Change the column default for all future rows
ALTER TABLE conversations
  ALTER COLUMN ai_chat_enabled SET DEFAULT TRUE;

-- 2. Bulk-enable AI on every existing conversation that currently has it off
UPDATE conversations
  SET ai_chat_enabled = TRUE
  WHERE ai_chat_enabled = FALSE;
