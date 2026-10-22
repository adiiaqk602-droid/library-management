# Dr A Q Khan School & College Library Management System — Starter

This is a secure starter foundation, not the complete production system. It includes:
- Next.js App Router + TypeScript
- Supabase Auth (email/password)
- PostgreSQL schema for five libraries, profiles, books, students and loans
- Row Level Security (RLS): Super Admin can access all libraries; Librarians can access only their assigned library
- One website with routes `/admin`, `/main`, `/bs`, `/ilyas`, `/sajid-ilyas`, `/pre`

## Requirements
- Node.js 20+
- A Supabase project
- A Vercel account (or another HTTPS host)

## 1. Create the app
Unzip this folder, open a terminal in it, then run:

```bash
npm install
cp .env.example .env.local
```

Create a Supabase project at https://supabase.com and copy the Project URL and anon/publishable key into `.env.local`. Do not put the `service_role` key in browser/client code or commit secrets.

## 2. Create database
In Supabase Dashboard → SQL Editor, run `supabase/schema.sql`.
Then run `supabase/seed.sql`.

## 3. Create users
In Supabase Dashboard → Authentication → Users, create each user's email/password. For production, invite users rather than sharing passwords.
Copy each user's UUID, then run SQL like this in SQL Editor (replace UUIDs and emails):
```sql
insert into public.profiles (id, full_name, role, library_id)
values ('SUPER-ADMIN-AUTH-UUID', 'Super Admin', 'super_admin', null);

insert into public.profiles (id, full_name, role, library_id)
select 'MAIN-LIBRARIAN-AUTH-UUID', 'Main Librarian', id
from public.libraries where slug = 'main';
```
Repeat for each librarian, changing the UUID/name/slug. A librarian profile must have exactly one `library_id`; the Super Admin must have `library_id = null`.
Only trusted administrators should be able to edit `profiles`. This starter intentionally does not expose profile management in the browser.

## 4. Run locally
```bash
npm run dev
```
Open http://localhost:3000. Sign in at `/login`. Use `/admin` or one of the library routes.

## 5. Deploy online
1. Push the project to a private GitHub repository.
2. Import it in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.
4. Deploy and attach your school domain.
5. Turn on HTTPS, MFA for Super Admin, and email confirmation/password recovery in Supabase.
6. Test all roles using separate accounts before entering real student data.

## Security model
- Every book/student/loan row carries a `library_id`.
- RLS policies compare that ID with the signed-in user's profile.
- Super Admin access is granted only to profiles whose role is `super_admin`.
- Do not add a Supabase service-role key to this app's public environment.
- Review RLS policies before production and arrange independent backups.

## What's not implemented yet
This starter demonstrates authentication, role isolation, route guards and the initial database. It does not yet include complete issue/return workflows, fines, barcode printing, SMS/WhatsApp, PDFs/OPAC, RFID, attendance, purchases, audit screens, or full bilingual UI. Add these as separate tested modules before using it operationally.
