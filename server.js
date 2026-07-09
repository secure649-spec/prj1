require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');

const pool = require('./db');
const suggestionsRouter = require('./routes/suggestions');
const votesRouter = require('./routes/votes');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/suggestions', suggestionsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/admin', adminRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('DB 스키마 확인/생성 완료');
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`서버 실행 중: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB 초기화 중 오류가 발생해 서버를 시작하지 못했습니다:', err);
    process.exit(1);
  });
