-- 선물 제안 테이블
CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  proposed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 투표 테이블
-- employee_id를 PRIMARY KEY로 지정했기 때문에
-- 같은 사번으로는 행이 하나만 존재할 수 있습니다 (= 중복 투표가 DB 차원에서 불가능).
-- 투표를 바꿀 때는 INSERT ... ON CONFLICT (employee_id) DO UPDATE 로 기존 행을 덮어씁니다.
CREATE TABLE IF NOT EXISTS votes (
  employee_id TEXT PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_votes_suggestion_id ON votes (suggestion_id);
