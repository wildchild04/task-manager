-- Agents' tokens kept encrypted (AES-256-GCM under SECRET_KEY), so Settings can show one again.
-- Null for tokens registered before, or while no SECRET_KEY is set. Requests are still checked by token_hash.
ALTER TABLE agent_tokens ADD COLUMN token_encrypted TEXT;
