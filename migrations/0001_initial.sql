PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','librarian')),
  library_id INTEGER REFERENCES libraries(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((role = 'super_admin' AND library_id IS NULL) OR (role = 'librarian' AND library_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  library_id INTEGER REFERENCES libraries(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(code, library_id)
);
CREATE TABLE IF NOT EXISTS wings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, library_id)
);
CREATE TABLE IF NOT EXISTS racks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  wing_id INTEGER REFERENCES wings(id),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, library_id)
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ser_no TEXT,
  entry_date TEXT NOT NULL DEFAULT (date('now')),
  title TEXT NOT NULL,
  author TEXT,
  price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
  vendor TEXT,
  pages INTEGER,
  edition TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  wing_id INTEGER REFERENCES wings(id) ON DELETE SET NULL,
  rack_id INTEGER REFERENCES racks(id) ON DELETE SET NULL,
  tag_id TEXT,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_books_library ON books(library_id);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE TABLE IF NOT EXISTS book_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  copy_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','issued','lost','damaged','repair')),
  condition TEXT NOT NULL DEFAULT 'New' CHECK(condition IN ('New','Old','Good','Damaged','Repair','Binding needed','Lost')),
  stock_type TEXT NOT NULL DEFAULT 'New' CHECK(stock_type IN ('New','Old','Donate','General')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_copies_book ON book_copies(book_id);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  member_type TEXT NOT NULL DEFAULT 'Student' CHECK(member_type IN ('Student','Teacher','Staff')),
  college_id TEXT,
  class_department TEXT,
  father_name TEXT,
  contact TEXT,
  email TEXT,
  expiry_date TEXT,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_library ON members(library_id);
CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  copy_id INTEGER NOT NULL REFERENCES book_copies(id),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  return_date TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','returned','lost')),
  fine_amount REAL NOT NULL DEFAULT 0,
  fine_paid REAL NOT NULL DEFAULT 0,
  issued_by INTEGER REFERENCES users(id),
  returned_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loans_library_status ON loans(library_id,status);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings(key,value) VALUES ('fine_per_day','10'),('damaged_fine_percent','50'),('lost_book_extra_fine','100'),('loan_days','14');
INSERT OR IGNORE INTO libraries(code,name) VALUES
 ('LIB-01','Library 1'),('LIB-02','Library 2'),('LIB-03','Library 3'),('LIB-04','Library 4'),('LIB-05','Library 5');
