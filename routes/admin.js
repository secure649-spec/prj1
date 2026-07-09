const express = require('express');
const router = express.Router();
const pool = require('../db');

// 모든 관리자 API는 x-admin-code 헤더를 ADMIN_CODE 환경변수와 비교합니다.
function checkAdmin(req, res, next) {
  if (!process.env.ADMIN_CODE) {
    return res.status(500).json({ error: '서버에 ADMIN_CODE 환경변수가 설정되어 있지 않습니다.' });
  }
  const code = req.headers['x-admin-code'];
  if (code !== process.env.ADMIN_CODE) {
    return res.status(401).json({ error: '관리자 코드가 올바르지 않습니다.' });
  }
  next();
}

// POST /api/admin/login - 코드 확인 (프론트에서 최초 잠금 해제용)
router.post('/login', (req, res) => {
  if (!process.env.ADMIN_CODE) {
    return res.status(500).json({ error: '서버에 ADMIN_CODE 환경변수가 설정되어 있지 않습니다.' });
  }
  const { code } = req.body || {};
  if (code === process.env.ADMIN_CODE) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '코드가 올바르지 않습니다.' });
});

// GET /api/admin/results - 순위/집계 결과
router.get('/results', checkAdmin, async (req, res) => {
  try {
    const suggestions = await pool.query(`
      SELECT s.id, s.name, s.description, s.proposed_by, s.created_at,
             COUNT(v.employee_id)::int AS vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id
      GROUP BY s.id
      ORDER BY vote_count DESC, s.created_at ASC
    `);
    const totalVotes = await pool.query('SELECT COUNT(*)::int AS count FROM votes');
    res.json({
      suggestions: suggestions.rows,
      totalVotes: totalVotes.rows[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '집계 결과를 불러오지 못했습니다.' });
  }
});

// GET /api/admin/export.csv - CSV 다운로드
router.get('/export.csv', checkAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.name, s.proposed_by, s.description,
             COUNT(v.employee_id)::int AS vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id
      GROUP BY s.id
      ORDER BY vote_count DESC, s.created_at ASC
    `);

    const rows = [['순위', '선물명', '제안자 사번', '득표수', '설명']];
    result.rows.forEach((r, i) => {
      rows.push([i + 1, r.name, r.proposed_by, r.vote_count, (r.description || '').replace(/\n/g, ' ')]);
    });

    const csv = '\uFEFF' + rows
      .map((r) => r.map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','))
      .join('\r\n');

    const filename = `gift_vote_results_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV를 생성하지 못했습니다.' });
  }
});

// POST /api/admin/reset - 전체 데이터 초기화 (다음 행사 재사용용)
router.post('/reset', checkAdmin, async (req, res) => {
  try {
    await pool.query('TRUNCATE votes, suggestions RESTART IDENTITY CASCADE');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '초기화하지 못했습니다.' });
  }
});

module.exports = router;
