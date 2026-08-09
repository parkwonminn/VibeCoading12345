-- ============================================================
-- 로그인/회원가입용 최소 스키마
-- Supabase Auth(auth.users)가 이메일/비밀번호, 세션을 전부 관리하므로
-- 여기서는 "닉네임" 정도만 담는 profiles 테이블 하나만 추가한다.
-- ============================================================

-- 1) 프로필 테이블
--    auth.users.id 를 그대로 PK로 사용해서 1:1로 연결
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now()
);

-- 2) 행 단위 보안 활성화 (필수: 안 켜면 모든 사용자가 서로 데이터를 볼 수 있음)
alter table public.profiles enable row level security;

-- 본인 프로필만 조회 가능
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- 본인 프로필만 수정 가능
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 회원가입 트리거가 아닌 클라이언트에서 직접 insert 할 경우 대비
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3) 회원가입 시 auth.users 에 새 행이 생기면
--    profiles 에도 자동으로 한 줄 생성 (username 은 회원가입 시 넘긴 metadata 사용)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
