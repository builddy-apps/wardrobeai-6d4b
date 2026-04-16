import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mannequins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_data TEXT,
    silhouette_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wardrobe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    image_data TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS outfits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    occasion TEXT,
    weather TEXT,
    items_json TEXT NOT NULL,
    preview_data TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS saved_looks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    outfit_id INTEGER NOT NULL,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shared_outfits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outfit_id INTEGER NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mannequins_user_id ON mannequins(user_id);
  CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_id ON wardrobe_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_wardrobe_items_category ON wardrobe_items(category);
  CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON outfits(user_id);
  CREATE INDEX IF NOT EXISTS idx_outfits_occasion ON outfits(occasion);
  CREATE INDEX IF NOT EXISTS idx_outfits_weather ON outfits(weather);
  CREATE INDEX IF NOT EXISTS idx_saved_looks_user_id ON saved_looks(user_id);
  CREATE INDEX IF NOT EXISTS idx_shared_outfits_share_code ON shared_outfits(share_code);
`);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createUser(email, passwordHash, name) {
  const stmt = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)');
  const result = stmt.run(email, passwordHash, name);
  return result.lastInsertRowid;
}

function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function updateUser(id, updates) {
  const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(updates), id];
  const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

function createMannequin(userId, imageData, silhouetteData) {
  const stmt = db.prepare('INSERT INTO mannequins (user_id, image_data, silhouette_data) VALUES (?, ?, ?)');
  const result = stmt.run(userId, imageData, silhouetteData);
  return result.lastInsertRowid;
}

function getMannequinByUserId(userId) {
  const stmt = db.prepare('SELECT * FROM mannequins WHERE user_id = ?');
  return stmt.get(userId);
}

function updateMannequin(userId, imageData, silhouetteData) {
  const stmt = db.prepare('UPDATE mannequins SET image_data = ?, silhouette_data = ? WHERE user_id = ?');
  const result = stmt.run(imageData, silhouetteData, userId);
  return result.changes > 0;
}

function deleteMannequin(userId) {
  const stmt = db.prepare('DELETE FROM mannequins WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes > 0;
}

function createWardrobeItem(userId, category, name, color, imageData, metadata) {
  const stmt = db.prepare('INSERT INTO wardrobe_items (user_id, category, name, color, image_data, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(userId, category, name, color, imageData, metadata ? JSON.stringify(metadata) : null);
  return result.lastInsertRowid;
}

function getWardrobeItemById(id) {
  const stmt = db.prepare('SELECT * FROM wardrobe_items WHERE id = ?');
  const item = stmt.get(id);
  if (item && item.metadata) {
    item.metadata = JSON.parse(item.metadata);
  }
  return item;
}

function getWardrobeItemsByUserId(userId, category = null) {
  let query = 'SELECT * FROM wardrobe_items WHERE user_id = ?';
  const params = [userId];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(query);
  const items = stmt.all(...params);
  return items.map(item => {
    if (item.metadata) {
      item.metadata = JSON.parse(item.metadata);
    }
    return item;
  });
}

function updateWardrobeItem(id, updates) {
  const allowedFields = ['category', 'name', 'color', 'image_data', 'metadata'];
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'metadata' ? JSON.stringify(value) : value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  const stmt = db.prepare(`UPDATE wardrobe_items SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

function deleteWardrobeItem(id) {
  const stmt = db.prepare('DELETE FROM wardrobe_items WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

function getWardrobeItemCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM wardrobe_items WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count;
}

function getCategoryCounts(userId) {
  const stmt = db.prepare('SELECT category, COUNT(*) as count FROM wardrobe_items WHERE user_id = ? GROUP BY category');
  return stmt.all(userId);
}

function createOutfit(userId, name, occasion, weather, itemsJson, previewData) {
  const stmt = db.prepare('INSERT INTO outfits (user_id, name, occasion, weather, items_json, preview_data) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(userId, name, occasion, weather, JSON.stringify(itemsJson), previewData);
  return result.lastInsertRowid;
}

function getOutfitById(id) {
  const stmt = db.prepare('SELECT * FROM outfits WHERE id = ?');
  const outfit = stmt.get(id);
  if (outfit && outfit.items_json) {
    outfit.items_json = JSON.parse(outfit.items_json);
  }
  return outfit;
}

function getOutfitsByUserId(userId, filters = {}) {
  let query = 'SELECT * FROM outfits WHERE user_id = ?';
  const params = [userId];
  
  if (filters.occasion) {
    query += ' AND occasion = ?';
    params.push(filters.occasion);
  }
  
  if (filters.weather) {
    query += ' AND weather = ?';
    params.push(filters.weather);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(query);
  const outfits = stmt.all(...params);
  return outfits.map(outfit => {
    if (outfit.items_json) {
      outfit.items_json = JSON.parse(outfit.items_json);
    }
    return outfit;
  });
}

function updateOutfit(id, updates) {
  const allowedFields = ['name', 'occasion', 'weather', 'items_json', 'preview_data'];
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'items_json' ? JSON.stringify(value) : value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  const stmt = db.prepare(`UPDATE outfits SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

function deleteOutfit(id) {
  const stmt = db.prepare('DELETE FROM outfits WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

function getOutfitCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM outfits WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count;
}

function createSavedLook(userId, outfitId, isFavorite = false) {
  const stmt = db.prepare('INSERT INTO saved_looks (user_id, outfit_id, is_favorite) VALUES (?, ?, ?)');
  const result = stmt.run(userId, outfitId, isFavorite ? 1 : 0);
  return result.lastInsertRowid;
}

function getSavedLookById(id) {
  const stmt = db.prepare(`
    SELECT sl.*, o.name, o.occasion, o.weather, o.items_json, o.preview_data, o.created_at as outfit_created_at
    FROM saved_looks sl
    JOIN outfits o ON sl.outfit_id = o.id
    WHERE sl.id = ?
  `);
  const look = stmt.get(id);
  if (look && look.items_json) {
    look.items_json = JSON.parse(look.items_json);
  }
  return look;
}

function getSavedLooksByUserId(userId, filters = {}) {
  let query = `
    SELECT sl.*, o.name, o.occasion, o.weather, o.items_json, o.preview_data, o.created_at as outfit_created_at
    FROM saved_looks sl
    JOIN outfits o ON sl.outfit_id = o.id
    WHERE sl.user_id = ?
  `;
  const params = [userId];
  
  if (filters.isFavorite) {
    query += ' AND sl.is_favorite = 1';
  }
  
  if (filters.occasion) {
    query += ' AND o.occasion = ?';
    params.push(filters.occasion);
  }
  
  query += ' ORDER BY sl.created_at DESC';
  
  const stmt = db.prepare(query);
  const looks = stmt.all(...params);
  return looks.map(look => {
    if (look.items_json) {
      look.items_json = JSON.parse(look.items_json);
    }
    return look;
  });
}

function updateSavedLook(id, updates) {
  const allowedFields = ['is_favorite'];
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'is_favorite' ? (value ? 1 : 0) : value);
    }
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  const stmt = db.prepare(`UPDATE saved_looks SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

function deleteSavedLook(id) {
  const stmt = db.prepare('DELETE FROM saved_looks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

function getSavedLookByUserAndOutfit(userId, outfitId) {
  const stmt = db.prepare('SELECT * FROM saved_looks WHERE user_id = ? AND outfit_id = ?');
  return stmt.get(userId, outfitId);
}

function getSavedLookCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM saved_looks WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count;
}

function createSharedOutfit(outfitId, shareCode) {
  const stmt = db.prepare('INSERT INTO shared_outfits (outfit_id, share_code) VALUES (?, ?)');
  const result = stmt.run(outfitId, shareCode);
  return result.lastInsertRowid;
}

function getSharedOutfitByCode(shareCode) {
  const stmt = db.prepare(`
    SELECT so.*, o.user_id, o.name, o.occasion, o.weather, o.items_json, o.preview_data
    FROM shared_outfits so
    JOIN outfits o ON so.outfit_id = o.id
    WHERE so.share_code = ?
  `);
  const shared = stmt.get(shareCode);
  if (shared && shared.items_json) {
    shared.items_json = JSON.parse(shared.items_json);
  }
  return shared;
}

function getSharedOutfitByOutfitId(outfitId) {
  const stmt = db.prepare('SELECT * FROM shared_outfits WHERE outfit_id = ?');
  return stmt.get(outfitId);
}

function deleteSharedOutfit(outfitId) {
  const stmt = db.prepare('DELETE FROM shared_outfits WHERE outfit_id = ?');
  const result = stmt.run(outfitId);
  return result.changes > 0;
}

function getAnalytics(userId) {
  const itemCount = getWardrobeItemCount(userId);
  const outfitCount = getOutfitCount(userId);
  const savedLookCount = getSavedLookCount(userId);
  const categoryCounts = getCategoryCounts(userId);
  
  const colorStmt = db.prepare('SELECT color, COUNT(*) as count FROM wardrobe_items WHERE user_id = ? AND color IS NOT NULL GROUP BY color ORDER BY count DESC LIMIT 5');
  const topColors = colorStmt.all(userId);
  
  const occasionStmt = db.prepare('SELECT occasion, COUNT(*) as count FROM outfits WHERE user_id = ? AND occasion IS NOT NULL GROUP BY occasion ORDER BY count DESC');
  const occasionCounts = occasionStmt.all(userId);
  
  const weatherStmt = db.prepare('SELECT weather, COUNT(*) as count FROM outfits WHERE user_id = ? AND weather IS NOT NULL GROUP BY weather ORDER BY count DESC');
  const weatherCounts = weatherStmt.all(userId);
  
  const recentItemsStmt = db.prepare('SELECT id, name, category, color, created_at FROM wardrobe_items WHERE user_id = ? ORDER BY created_at DESC LIMIT 5');
  const recentItems = recentItemsStmt.all(userId);
  
  const recentOutfitsStmt = db.prepare('SELECT id, name, occasion, weather, created_at FROM outfits WHERE user_id = ? ORDER BY created_at DESC LIMIT 5');
  const recentOutfits = recentOutfitsStmt.all(userId);
  
  return {
    itemCount,
    outfitCount,
    savedLookCount,
    categoryCounts,
    topColors,
    occasionCounts,
    weatherCounts,
    recentItems,
    recentOutfits
  };
}

export {
  db,
  generateId,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  createMannequin,
  getMannequinByUserId,
  updateMannequin,
  deleteMannequin,
  createWardrobeItem,
  getWardrobeItemById,
  getWardrobeItemsByUserId,
  updateWardrobeItem,
  deleteWardrobeItem,
  getWardrobeItemCount,
  getCategoryCounts,
  createOutfit,
  getOutfitById,
  getOutfitsByUserId,
  updateOutfit,
  deleteOutfit,
  getOutfitCount,
  createSavedLook,
  getSavedLookById,
  getSavedLooksByUserId,
  updateSavedLook,
  deleteSavedLook,
  getSavedLookByUserAndOutfit,
  getSavedLookCount,
  createSharedOutfit,
  getSharedOutfitByCode,
  getSharedOutfitByOutfitId,
  deleteSharedOutfit,
  getAnalytics
};