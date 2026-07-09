const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/suggestions - 전체 제안 목록 + 각 제안의 득표 수
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.description, s.proposed_by, s.created_at,
             COUNT(v.employee_id)::int AS vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제안 목록을 불러오지 못했습니다.' });
  }
});

// POST /api/suggestions - 새 제안 등록
router.post('/', async (req, res) => {
  const { name, description, employeeId } = req.body || {};

  if (!employeeId || !String(employeeId).trim()) {
    return res.status(400).json({ error: '사번을 입력해주세요.' });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: '선물 이름을 입력해주세요.' });
  }

  try {
    const dup = await pool.query(
      'SELECT id FROM suggestions WHERE LOWER(name) = LOWER($1)',
      [String(name).trim()]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: '이미 등록된 선물이에요. 목록에서 투표해주세요.' });
    }

    const result = await pool.query(
      `INSERT INTO suggestions (name, description, proposed_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [String(name).trim(), String(description || '').trim(), String(employeeId).trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '제안을 등록하지 못했습니다.' });
  }
});

module.exports = router;
