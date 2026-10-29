
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ebooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  file_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf'
    CHECK (mime_type = 'application/pdf'),
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ebooks_library
  ON ebooks(library_id);

CREATE INDEX IF NOT EXISTS idx_ebooks_title
  ON ebooks(title);

CREATE INDEX IF NOT EXISTS idx_ebooks_category
  ON ebooks(category_id);

CREATE TABLE IF NOT EXISTS ebook_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebook_id INTEGER NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, ebook_id)
);

CREATE TABLE IF NOT EXISTS ebook_reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebook_id INTEGER NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 1 CHECK (last_page >= 1),
  last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, ebook_id)
);

CREATE INDEX IF NOT EXISTS idx_ebook_history_user
  ON ebook_reading_history(user_id, last_read_at);
