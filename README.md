# 창립기념일 선물 투표 앱

Node.js + Express + PostgreSQL로 만든 사내 선물 제안/투표 웹앱입니다.

## 로컬에서 실행해보기 (선택)

1. `.env.example`을 복사해 `.env` 파일을 만들고 값을 채웁니다.
2. 패키지 설치 후 실행합니다.
   ```
   npm install
   npm start
   ```
3. 브라우저에서 `http://localhost:3000` 접속.

로컬에 PostgreSQL이 없다면 이 단계는 건너뛰고 바로 Render에 배포해도 됩니다.

## Render 배포 방법

### 1. GitHub에 코드 올리기
이 폴더 전체를 GitHub 저장소에 push 합니다. (`.env`는 `.gitignore`에 있어 올라가지 않습니다 — 정상입니다.)

### 2. PostgreSQL 데이터베이스 만들기
1. Render 대시보드 → **New** → **PostgreSQL**
2. 이름, 리전 등을 정하고 생성
3. 생성 후 상세 페이지에서 **Internal Database URL**(같은 Render 안의 서비스끼리 쓸 때) 또는 **External Database URL**을 복사해둡니다.

### 3. Web Service 만들기
1. Render 대시보드 → **New** → **Web Service**
2. 방금 올린 GitHub 저장소 선택
3. 설정값:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Environment** 탭에서 환경변수 추가:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | 2단계에서 복사한 DB URL |
   | `ADMIN_CODE` | 원하는 관리자 코드 (예: `2026anniv`) |

   `PORT`는 Render가 자동으로 주입하므로 따로 설정하지 않아도 됩니다.
5. **Create Web Service** 클릭 → 배포 완료 후 발급된 주소(`https://xxx.onrender.com`)로 접속

서버가 처음 켜질 때 `db/schema.sql`을 자동으로 실행해서 테이블을 만들기 때문에, 별도의 DB 마이그레이션 작업 없이 바로 사용할 수 있습니다.

## 사번당 1표가 보장되는 원리

`votes` 테이블의 기본키(PRIMARY KEY)가 `employee_id`입니다. 같은 사번으로 다시 투표를 시도하면 새 행이 추가되는 게 아니라, DB의 `ON CONFLICT (employee_id) DO UPDATE` 규칙에 따라 기존 행이 새 선택지로 덮어써집니다. 즉 어떤 사번이든 테이블에는 항상 최대 한 줄만 존재하며, 이는 애플리케이션 코드 실수와 무관하게 DB 자체가 강제하는 규칙입니다.

## 관리자 페이지

`관리자` 탭에서 `ADMIN_CODE` 환경변수 값을 입력하면 집계 결과, CSV 내보내기, 전체 초기화 기능을 사용할 수 있습니다.
