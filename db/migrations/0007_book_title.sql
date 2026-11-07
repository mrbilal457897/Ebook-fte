-- Slice 006: A book needs a human-readable title. Before this, `books` had no
-- title column and the customer-facing library could only show UUIDs.

ALTER TABLE books
    ADD COLUMN title text NOT NULL DEFAULT 'Untitled draft';
