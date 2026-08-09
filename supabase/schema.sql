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

-- ============================================================
-- 쇼핑몰용 임시 스키마 (카테고리 / 상품 / 장바구니 / 주문 / 주문상세)
-- ============================================================

-- 1) 카테고리 테이블
create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_all"
  on public.categories for select
  to authenticated, anon
  using (true);

-- 2) 상품 테이블
create table public.products (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  created_at timestamptz not null default now()
);

create index products_category_id_idx on public.products(category_id);

alter table public.products enable row level security;

create policy "products_select_all"
  on public.products for select
  to authenticated, anon
  using (true);

-- 3) 장바구니 테이블 (사용자별로 담은 상품)
create table public.cart_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index cart_items_user_id_idx on public.cart_items(user_id);

alter table public.cart_items enable row level security;

create policy "cart_items_select_own"
  on public.cart_items for select
  using (auth.uid() = user_id);

create policy "cart_items_insert_own"
  on public.cart_items for insert
  with check (auth.uid() = user_id);

create policy "cart_items_update_own"
  on public.cart_items for update
  using (auth.uid() = user_id);

create policy "cart_items_delete_own"
  on public.cart_items for delete
  using (auth.uid() = user_id);

-- 4) 주문 테이블
create table public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','completed','cancelled')),
  total_price numeric(10,2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create index orders_user_id_idx on public.orders(user_id);

alter table public.orders enable row level security;

create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- 5) 주문 상세 테이블 (주문 시점 상품 정보 스냅샷)
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_name text not null,
  price numeric(10,2) not null check (price >= 0),
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items(order_id);

alter table public.order_items enable row level security;

create policy "order_items_select_own"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- 6) 테스트용 임시 카테고리/상품 데이터
insert into public.categories (name) values
  ('의류'), ('전자제품'), ('식품'), ('도서');

insert into public.products (category_id, name, description, price, stock, image_url)
select id, '샘플 티셔츠', '테스트용 임시 상품입니다.', 19900, 50, null from public.categories where name = '의류'
union all
select id, '샘플 무선이어폰', '테스트용 임시 상품입니다.', 59000, 30, null from public.categories where name = '전자제품'
union all
select id, '샘플 원두커피', '테스트용 임시 상품입니다.', 12900, 100, null from public.categories where name = '식품'
union all
select id, '샘플 소설책', '테스트용 임시 상품입니다.', 15800, 40, null from public.categories where name = '도서';
