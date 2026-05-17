const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const connectionString = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/metamorphosis_db';
const pool = new Pool({ connectionString });

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname)));

async function dbQuery(text, params) {
  const result = await pool.query(text, params);
  return result;
}

async function initDb() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      pass TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT NOT NULL REFERENCES users(username) ON DELETE SET NULL,
      date TIMESTAMPTZ DEFAULT NOW(),
      media_data TEXT,
      media_type TEXT
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author TEXT NOT NULL REFERENCES users(username) ON DELETE SET NULL,
      text TEXT NOT NULL,
      date TIMESTAMPTZ DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender TEXT,
      real_user TEXT REFERENCES users(username) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      date TIMESTAMPTZ DEFAULT NOW(),
      file_data TEXT,
      file_type TEXT,
      read BOOLEAN DEFAULT false
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS domains (
      domain TEXT PRIMARY KEY
    );
  `);

  await dbQuery(
    `INSERT INTO users (username, pass, role) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING`,
    ['admin', 'admin123', 'admin']
  );

  await dbQuery(
    `INSERT INTO domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING`,
    ['@colegio.edu.co']
  );
}

function toClientRows(rows) {
  return rows.map(row => {
    const copy = { ...row };
    if (copy.created_at) copy.createdAt = copy.created_at;
    if (copy.date) copy.date = new Date(copy.date).toLocaleString();
    delete copy.created_at;
    return copy;
  });
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/state', async (req, res, next) => {
  try {
    const users = await dbQuery('SELECT username, pass, role, created_at FROM users ORDER BY created_at DESC');
    const posts = await dbQuery('SELECT id, title, body, author, date, media_data AS "mediaData", media_type AS "mediaType" FROM posts ORDER BY date DESC');
    const comments = await dbQuery('SELECT id, post_id AS "postId", author, text, date, status FROM comments ORDER BY date DESC');
    const messages = await dbQuery('SELECT id, sender, real_user AS "realUser", subject, body, date, file_data AS "fileData", file_type AS "fileType", read FROM messages ORDER BY date DESC');
    const domains = await dbQuery('SELECT domain FROM domains ORDER BY domain ASC');

    res.json({
      users: toClientRows(users.rows),
      posts: toClientRows(posts.rows),
      comments: toClientRows(comments.rows),
      messages: toClientRows(messages.rows),
      domains: domains.rows.map(row => row.domain)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { username, pass } = req.body;
    const result = await dbQuery('SELECT username, role FROM users WHERE username = $1 AND pass = $2', [username, pass]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/posts', async (req, res, next) => {
  try {
    const result = await dbQuery('SELECT id, title, body, author, date, media_data AS "mediaData", media_type AS "mediaType" FROM posts ORDER BY date DESC');
    res.json(toClientRows(result.rows));
  } catch (error) {
    next(error);
  }
});

app.post('/api/posts', async (req, res, next) => {
  try {
    const { title, body, author, mediaData, mediaType } = req.body;
    const result = await dbQuery(
      'INSERT INTO posts (title, body, author, media_data, media_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, body, author, date, media_data AS "mediaData", media_type AS "mediaType"',
      [title, body, author, mediaData, mediaType]
    );
    res.status(201).json(toClientRows(result.rows)[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/posts/:id', async (req, res, next) => {
  try {
    await dbQuery('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/comments', async (req, res, next) => {
  try {
    const { postId } = req.query;
    const query = postId ? 'SELECT id, post_id AS "postId", author, text, date, status FROM comments WHERE post_id = $1 ORDER BY date DESC' : 'SELECT id, post_id AS "postId", author, text, date, status FROM comments ORDER BY date DESC';
    const params = postId ? [postId] : [];
    const result = await dbQuery(query, params);
    res.json(toClientRows(result.rows));
  } catch (error) {
    next(error);
  }
});

app.post('/api/posts/:postId/comments', async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { author, text, status } = req.body;
    const result = await dbQuery(
      'INSERT INTO comments (post_id, author, text, status) VALUES ($1, $2, $3, $4) RETURNING id, post_id AS "postId", author, text, date, status',
      [postId, author, text, status || 'pending']
    );
    res.status(201).json(toClientRows(result.rows)[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/messages', async (req, res, next) => {
  try {
    const result = await dbQuery('SELECT id, sender, real_user AS "realUser", subject, body, date, file_data AS "fileData", file_type AS "fileType", read FROM messages ORDER BY date DESC');
    res.json(toClientRows(result.rows));
  } catch (error) {
    next(error);
  }
});

app.post('/api/messages', async (req, res, next) => {
  try {
    const { sender, realUser, subject, body, fileData, fileType } = req.body;
    const result = await dbQuery(
      'INSERT INTO messages (sender, real_user, subject, body, file_data, file_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sender, real_user AS "realUser", subject, body, date, file_data AS "fileData", file_type AS "fileType", read',
      [sender, realUser, subject, body, fileData, fileType]
    );
    res.status(201).json(toClientRows(result.rows)[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', async (req, res, next) => {
  try {
    const result = await dbQuery('SELECT username, pass, role, created_at FROM users ORDER BY created_at DESC');
    res.json(toClientRows(result.rows));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/users/:username/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    await dbQuery('UPDATE users SET role = $1 WHERE username = $2', [role, req.params.username]);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.put('/api/users/:username', async (req, res, next) => {
  try {
    const { newUsername } = req.body;
    const oldUsername = req.params.username;
    await pool.query('BEGIN');
    await dbQuery('UPDATE users SET username = $1 WHERE username = $2', [newUsername, oldUsername]);
    await dbQuery('UPDATE posts SET author = $1 WHERE author = $2', [newUsername, oldUsername]);
    await dbQuery('UPDATE comments SET author = $1 WHERE author = $2', [newUsername, oldUsername]);
    await dbQuery('UPDATE messages SET real_user = $1 WHERE real_user = $2', [newUsername, oldUsername]);
    await pool.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
});

app.get('/api/domains', async (req, res, next) => {
  try {
    const result = await dbQuery('SELECT domain FROM domains ORDER BY domain ASC');
    res.json(result.rows.map(row => row.domain));
  } catch (error) {
    next(error);
  }
});

app.post('/api/domains', async (req, res, next) => {
  try {
    const { domain } = req.body;
    await dbQuery('INSERT INTO domains (domain) VALUES ($1) ON CONFLICT (domain) DO NOTHING', [domain]);
    res.status(201).json({ domain });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Error interno del servidor' });
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor iniciado en http://localhost:${port}`);
    });
  })
  .catch(error => {
    console.error('No se pudo inicializar la base de datos:', error);
    process.exit(1);
  });
