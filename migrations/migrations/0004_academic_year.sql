-- Add Academic Year to AQK Books
ALTER TABLE books ADD COLUMN academic_year TEXT;

CREATE INDEX IF NOT EXISTS idx_books_academic_year
ON books(academic_year);
