-- AQK Library: Inventory controls migration
-- Run this migration only once.

-- Rack location and minimum-stock information
ALTER TABLE racks ADD COLUMN rack_number TEXT;
ALTER TABLE racks ADD COLUMN shelf_number TEXT;
ALTER TABLE racks ADD COLUMN location_code TEXT;
ALTER TABLE racks ADD COLUMN minimum_stock INTEGER NOT NULL DEFAULT 0;

-- Physical copy location
ALTER TABLE book_copies ADD COLUMN rack_id INTEGER;
ALTER TABLE book_copies ADD COLUMN shelf_number TEXT;
ALTER TABLE book_copies ADD COLUMN last_verified_at TEXT;

-- Complete stock movement history
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  book_id INTEGER,
  copy_id INTEGER,
  rack_id INTEGER,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition_before TEXT,
  condition_after TEXT,
  reference_note TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_library
ON inventory_movements(library_id, created_at);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_book
ON inventory_movements(book_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_copy
ON inventory_movements(copy_id);

-- Physical stock verification sessions
CREATE TABLE IF NOT EXISTS stock_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  verification_date TEXT NOT NULL DEFAULT (date('now')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_verifications_library
ON stock_verifications(library_id, verification_date);

-- Actual verification details for each physical copy
CREATE TABLE IF NOT EXISTS stock_verification_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verification_id INTEGER NOT NULL,
  copy_id INTEGER NOT NULL,
  expected_status TEXT,
  actual_status TEXT,
  found INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  checked_by INTEGER,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(verification_id, copy_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_verification_items_session
ON stock_verification_items(verification_id);

-- Minimum-stock alert lookup
CREATE INDEX IF NOT EXISTS idx_racks_library_minimum
ON racks(library_id, minimum_stock);
