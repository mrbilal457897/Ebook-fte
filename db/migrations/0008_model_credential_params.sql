-- Slice 007: Default generation params on a BYOK credential (AGENTS.md §8
-- promised model_credentials carry "default generation params"; the table only
-- had provider + encrypted key).

ALTER TABLE model_credentials
    ADD COLUMN temperature NUMERIC(4, 2),
    ADD COLUMN top_p NUMERIC(3, 2),
    ADD COLUMN max_tokens INTEGER;
