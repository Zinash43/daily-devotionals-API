import express from 'express';
import type { Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'devotionals.db');
console.log('📁 Using database file at:', dbPath);

const isDbCreated = existsSync(dbPath);
const db = new Database(dbPath, { timeout: 5000 });


if (!isDbCreated) {
  db.exec(`
      CREATE TABLE IF NOT EXISTS devotionals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verse TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT NULL,
        deleted_at TEXT DEFAULT NULL
      );
    `);

  console.log('Database and all tables created successfully!');
}

app.get('/hello_world', (req: Request, res: Response) => {
  res.send('Hello, World!');
});

app.get('/api/devotionals', (req: Request, res: Response) => {
  try {
    const statement = db.prepare('SELECT * FROM devotionals WHERE deleted_at IS NULL ORDER BY created_at DESC');
    const devotionals = statement.all();
    res.status(200).json(devotionals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve devotionals.' });
  }
});
app.get('/api/devotionals/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const statement = db.prepare('SELECT * FROM devotionals WHERE id = ? AND deleted_at IS NULL');
    const devotional = statement.get(id);

    if (devotional) {
      res.status(200).json(devotional);
    } else {
      res.status(404).json({ error: 'Devotional not found.' });
    }
  } catch (error) {
    console.error('❌ Error fetching devotional by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve devotional.' });
  }
});

app.use(express.json()); // middleware for parsing JSON

app.post('/api/devotionals', (req: Request, res: Response) => {
  const { verse, content } = req.body;

  if (!verse || !content) {
    return res.status(400).json({ error: 'Verse and content are required.' });
  }

  try {
    const statement = db.prepare('INSERT INTO devotionals (verse, content) VALUES (?, ?)');
    const result = statement.run(verse, content);
    res.status(201).json({ message: 'Devotional created successfully.', id: result.lastInsertRowid });
  } catch (error) {
    console.error('❌ Error creating devotional:', error);
    res.status(500).json({ error: 'Failed to create devotional.' });
  }
});
app.patch('/api/devotionals/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { verse, content } = req.body;

  if (!verse && !content) {
    return res.status(400).json({ error: 'At least one field (verse or content) must be provided.' });
  }

  try {
    const fields = [];
    const values = [];

    if (verse) {
      fields.push('verse = ?');
      values.push(verse);
    }
    if (content) {
      fields.push('content = ?');
      values.push(content);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE devotionals SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
    values.push(id);

    const statement = db.prepare(sql);
    const result = statement.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Devotional not found or already deleted.' });
    }

    const updated = db.prepare('SELECT * FROM devotionals WHERE id = ?').get(id);
    res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Error updating devotional:', error);
    res.status(500).json({ error: 'Failed to update devotional.' });
  }
});
app.delete('/api/devotionals/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const statement = db.prepare('UPDATE devotionals SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL');
    const result = statement.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Devotional not found or already deleted.' });
    }

    res.status(204).send(); // No Content
  } catch (error) {
    console.error('❌ Error soft deleting devotional:', error);
    res.status(500).json({ error: 'Failed to delete devotional.' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});