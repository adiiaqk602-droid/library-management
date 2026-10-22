create extension if not exists pgcrypto;

create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug in ('main','bs','ilyas','sajid-ilyas','pre')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('super_admin','librarian')),
  library_id uuid references public.libraries(id),
  created_at timestamptz not null default now(),
  constraint role_library_consistency check (
    (role = 'super_admin' and library_id is null) or
    (role = 'librarian' and library_id is not null)
  )
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id),
  accession_no text not null,
  title text not null,
  author text,
  category text,
  price numeric(12,2) not null default 0 check (price >= 0),
  vendor text,
  pages integer check (pages is null or pages > 0),
  edition text,
  rack_no text,
  tag_id text,
  condition text not null default 'good' check (condition in ('new','good','worn','damaged','lost')),
  inventory_type text not null default 'new' check (inventory_type in ('new','old','donated')),
  status text not null default 'available' check (status in ('available','issued','reserved','damaged','lost','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(library_id, accession_no)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id),
  admission_no text not null,
  full_name text not null,
  class_name text,
  section text,
  guardian_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(library_id, admission_no)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id),
  book_id uuid not null references public.books(id),
  student_id uuid not null references public.students(id),
  issued_at date not null default current_date,
  due_at date not null,
  returned_at date,
  fine_amount numeric(12,2) not null default 0 check (fine_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists books_library_title_idx on public.books(library_id, title);
create index if not exists students_library_name_idx on public.students(library_id, full_name);
create index if not exists loans_library_due_idx on public.loans(library_id, due_at) where returned_at is null;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_user_library_id()
returns uuid language sql stable security definer set search_path = public
as $$ select library_id from public.profiles where id = auth.uid() $$;

alter table public.libraries enable row level security;
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.students enable row level security;
alter table public.loans enable row level security;

-- Signed-in users can see library names for navigation; only Super Admin can modify libraries.
drop policy if exists "signed in can read libraries" on public.libraries;
create policy "signed in can read libraries" on public.libraries for select to authenticated using (true);
drop policy if exists "super admin manages libraries" on public.libraries;
create policy "super admin manages libraries" on public.libraries for all to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

-- Users may read their own profile. Super Admin may read/manage all profiles.
drop policy if exists "read own profile or admin" on public.profiles;
create policy "read own profile or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'super_admin');
drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles" on public.profiles for all to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

-- Library-scoped records: Super Admin sees all; librarians only their assigned library.
drop policy if exists "books scoped access" on public.books;
create policy "books scoped access" on public.books for all to authenticated
using (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id())
with check (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id());

drop policy if exists "students scoped access" on public.students;
create policy "students scoped access" on public.students for all to authenticated
using (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id())
with check (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id());

drop policy if exists "loans scoped access" on public.loans;
create policy "loans scoped access" on public.loans for all to authenticated
using (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id())
with check (public.current_user_role() = 'super_admin' or library_id = public.current_user_library_id());

-- Important: do not grant anon access to these tables.
grant usage on schema public to authenticated;
grant select on public.libraries to authenticated;
grant select, insert, update, delete on public.profiles, public.books, public.students, public.loans to authenticated;
grant insert, update, delete on public.libraries to authenticated;
