const express = require('express');
const app = express();

const SECRET_LOGIC = "this code is encrypted on disk — you cannot read this file";
const DB_URL = process.env.DATABASE_URL || "not set";

app.get('/', (req, res) => {
  res.json({ message: 'Running from encrypted filesystem', status: 'ok' });
});

app.get('/secret', (req, res) => {
  res.json({ secret: SECRET_LOGIC, db: DB_URL });
});

app.listen(3000, () => console.log('[app] Express running on :3000 from encrypted FS'));
