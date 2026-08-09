// ============================================================
// Supabase 연결 설정
// supabase/schema.sql 의 profiles 테이블/트리거와 함께 사용됩니다.
//
// 실제 배포(.io 환경) 전 아래 두 값을 Supabase 프로젝트 설정에서
// 발급받은 값으로 교체하세요. (Project Settings > API)
//   SUPABASE_URL      -> Project URL
//   SUPABASE_ANON_KEY  -> anon public key
//
// 값이 채워지면 login.js / signup.js 에서 이 client를 통해
// supabase.auth.signInWithPassword / supabase.auth.signUp 을 호출합니다.
// ============================================================

const SUPABASE_URL = "https://pkdjuiebvgtdxpzyocve.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZGp1aWVidmd0ZHhwenlvY3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNjMzNzYsImV4cCI6MjEwMTczOTM3Nn0.iXF8bcnOE1eXveOdw3kL7B94Wcr4w2cbD_ydcQztD1k";

const isSupabaseConfigured =
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

// supabase-js CDN(UMD) 스크립트가 로드된 경우에만 client 생성
const supabaseClient =
  isSupabaseConfigured && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
