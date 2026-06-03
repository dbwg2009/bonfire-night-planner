CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'planning',
  meeting_location TEXT DEFAULT '',
  meeting_location_coords TEXT DEFAULT '',
  event_location TEXT DEFAULT '',
  event_location_coords TEXT DEFAULT '',
  conflict_event_enabled INTEGER DEFAULT 0,
  conflict_event_name TEXT DEFAULT '',
  food_split_ratio REAL DEFAULT 0.6,
  food_buffer_factor REAL DEFAULT 1.1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organisers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  color TEXT DEFAULT '#e85f00',
  permissions TEXT DEFAULT '{"guest_management":false,"finance":false,"check_in":false,"tasks_and_settings":false}',
  is_owner INTEGER DEFAULT 0,
  event_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rsvp_status TEXT DEFAULT 'pending',
  dietary TEXT DEFAULT '[]',
  pickup_time TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  on_whatsapp INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  conflict_event INTEGER DEFAULT 0,
  event_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  location TEXT NOT NULL,
  checked_in INTEGER DEFAULT 0,
  checked_in_at TEXT,
  event_id TEXT NOT NULL,
  UNIQUE(guest_id, location),
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  owner TEXT DEFAULT '',
  stage TEXT DEFAULT 'pre_event',
  due_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  event_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  activity_type TEXT DEFAULT '',
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  event_id TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  budget_amount REAL,
  actual_amount REAL,
  transaction_date TEXT DEFAULT '',
  paid_by TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  transaction_type TEXT DEFAULT 'expense',
  event_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  map_url TEXT DEFAULT '',
  status TEXT DEFAULT 'considering',
  pros TEXT DEFAULT '[]',
  cons TEXT DEFAULT '[]',
  capacity INTEGER,
  parking TEXT,
  accessibility TEXT DEFAULT '',
  walk_time_from_meeting INTEGER,
  fire_permission INTEGER DEFAULT 0,
  fireworks_permission INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  event_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conflict_schedule (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  transport TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  event_id TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_event ON schedule_items(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_locations_event ON locations(event_id);
CREATE INDEX IF NOT EXISTS idx_conflict_schedule_event ON conflict_schedule(event_id);
