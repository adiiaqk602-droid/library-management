
-- AQK Library: Book Management Upgrade
-- Existing records will remain محفوظ.

ALTER TABLE books ADD COLUMN accession_no TEXT;
ALTER TABLE books ADD COLUMN co_author TEXT;
ALTER TABLE books ADD COLUMN isbn TEXT;
ALTER TABLE books ADD COLUMN volume_number TEXT;
ALTER TABLE books ADD COLUMN publisher TEXT;
ALTER TABLE books ADD COLUMN publication_year INTEGER;
ALTER TABLE books ADD COLUMN language TEXT;
ALTER TABLE books ADD COLUMN subcategory TEXT;
ALTER TABLE books ADD COLUMN department_class TEXT;
ALTER TABLE books ADD COLUMN shelf_number TEXT;
ALTER TABLE books ADD COLUMN purchase_date TEXT;
ALTER TABLE books ADD COLUMN invoice_number TEXT;
ALTER TABLE books ADD COLUMN discount REAL NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN donor_information TEXT;
ALTER TABLE books ADD COLUMN cover_image TEXT;

-- Book history
CREATE TABLE IF NOT EXISTS book_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_book_history_book
ON book_history(book_id);

CREATE INDEX IF NOT EXISTS idx_book_history_library
ON book_history(library_id);

CREATE INDEX IF NOT EXISTS idx_books_accession
ON books(accession_no);

CREATE INDEX IF NOT EXISTS idx_books_isbn
ON books(isbn);
