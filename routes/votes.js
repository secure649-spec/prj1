const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/votes/me?employeeId=xxxx - 이 사번이 현재 투표한 항목 조회
router.get('/me', async (req, res) => {
  const { employeeId } = req.query;
  if (!employeeId || !String(employeeId).trim()) {
    return res.status(400).json({ error: '사번이 필요합니다.' });
  }
  try {
    const result = await pool.query(
      'SELECT suggestion_id FROM votes WHERE employee_id = $1',
      [String(employeeId).trim()]
    );
    res.json({ suggestionId: result.rows[0] ? result.rows[0].suggestion_id : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '투표 정보를 불러오지 못했습니다.' });
  }
});

// POST /api/votes - 투표하기 / 투표 변경하기
// votes.employee_id 가 PRIMARY KEY이므로, 같은 사번으로 다시 투표하면
// 새 행을 만드는 대신 기존 행을 덮어씁니다 (ON CONFLICT DO UPDATE).
// 이 덕분에 "사번당 1표"가 애플리케이션 코드가 아니라 DB 제약조건으로 보장됩니다.
router.post('/', async (req, res) => {
  const { employeeId, suggestionId } = req.body || {};

  if (!employeeId || !String(employeeId).trim()) {
    return res.status(400).json({ error: '사번을 입력해주세요.' });
  }
  if (!suggestionId) {
    return res.status(400).json({ error: '선물을 선택해주세요.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO votes (employee_id, suggestion_id, voted_at)
       VALUES ($1, $2, now())
       ON CONFLICT (employee_id)
       DO UPDATE SET suggestion_id = EXCLUDED.suggestion_id, voted_at = now()
       RETURNING *`,
      [String(employeeId).trim(), suggestionId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      // foreign key violation: 존재하지 않는 suggestionId
      return res.status(400).json({ error: '존재하지 않는 제안입니다.' });
    }
    console.error(err);
    res.status(500).json({ error: '투표를 반영하지 못했습니다.' });
  }
});

module.exports = router;
