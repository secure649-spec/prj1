const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // 서버가 켜지긴 하지만 DB 요청 시점에 에러가 나므로, 실행 초기에 눈에 띄게 경고합니다.
  console.warn('[경고] DATABASE_URL 환경변수가 설정되지 않았습니다. .env 파일 또는 Render 환경변수를 확인하세요.');
}

// Render Postgres 등 대부분의 클라우드 Postgres는 SSL 연결이 필요합니다.
// 로컬에서 SSL 없이 테스트하고 싶다면 .env에 DATABASE_SSL=false 를 설정하세요.
const useSSL = process.env.DATABASE_SSL !== 'false';

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('예기치 않은 DB 커넥션 에러:', err);
});

module.exports = pool;
