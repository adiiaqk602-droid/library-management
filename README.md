# AQK Library Online System — GitHub + Cloudflare Pages + D1

For Dr A Q Khan School & College, Bahria Town Phase-8. This version removes Supabase and uses Cloudflare Pages Functions (server-side API) plus Cloudflare D1 (SQLite database).

## Features in this build
- Five seeded library records
- Secure server-side email/password login; password hashes use PBKDF2-SHA-256; sessions use an HttpOnly, Secure, SameSite cookie
- One-time first Super Admin setup protected by a Cloudflare secret (`AQK_SETUP_KEY`)
- Super Admin sees all five libraries and can create/disable librarian accounts
- Librarians are restricted server-side to their assigned library
- Book entry: serial number, date, title, author, price, vendor, pages, edition, category, library, wing, rack, tag ID, description, copy count
- Unique physical copy IDs, stock type New / Old / Donate / General, and condition/status tracking
- Categories with auto-generated code, description, edit and delete
- Management wings and racks
- Students / membership
- Issue / return workflow, overdue calculation, late fine, damaged-book fine, lost-book fine
- Dashboard, category-wise and library-wise reports, inventory report, print reports, print copy labels
- Audit log and configurable fine rules

This is a deployable project package, not a claim that the live Cloudflare site has already been changed. The D1 database must be created and bound in your Cloudflare account, the migration must be applied, and the updated files must be committed to the connected GitHub repository before the live site uses this version.

## Deploy on your existing Cloudflare Pages project

### 1. Download and extract
Extract the ZIP. It contains `public/`, `functions/`, `migrations/`, and this README. Keep the existing project name and Cloudflare Pages project; do not delete your current site until you have a backup.

### 2. Create D1 database
In Cloudflare Dashboard:
1. Open **Storage & databases → D1 SQL Database** (the exact menu label may vary).
2. Create a database named `aqk-library-db`.
3. Open the new database's **Console** and run the full SQL from `migrations/0001_initial.sql` once. This creates tables and seeds five library records.

### 3. Bind D1 to the existing Pages project
1. Open **Workers & Pages → your existing `library-management-eic` Pages project**.
2. Go to **Settings → Functions → D1 database bindings** (Cloudflare's labels can change).
3. Add a binding with **Variable name `DB`** and select the `aqk-library-db` database.
4. Save the binding and redeploy the project.

The binding name must be exactly `DB`, because the server-side API uses `env.DB`. For this dashboard-based Pages setup, you do not need to configure a database ID in source code.

### 4. Add the one-time setup secret
1. In your Pages project, open **Settings → Variables and Secrets**.
2. Add `AQK_SETUP_KEY` as an encrypted secret for Production (and Preview too if you will test previews).
3. Make a long random key and keep it private. Do not put it in `public/config.js`, GitHub source, or a chat message.
4. Save and trigger a new deployment.

### 5. Upload/commit the new project files to GitHub
The ZIP is a package; it does not automatically change your GitHub repository. Back up the repository first. Upload/replace the extracted project files in `adiiaqk602-droid/library-management`, preserving the repository root layout:
- `public/index.html`, `public/app.js`, `public/config.js`, `public/styles.css`
- `functions/api/[[path]].js`
- `migrations/0001_initial.sql`
- `wrangler.toml`, `README.md`

Commit the changes. Cloudflare Pages should start a deployment from the connected GitHub branch. Make sure the Pages build output directory is `public` and no build command is required for this plain HTML/Functions project. The `functions/` directory must remain at the repository root, not inside `public/`.

### 6. Create the first Super Admin
After D1 is bound, migration applied, and deployment is complete, open the site. It should show **Initial Super Admin Setup** if no admin exists. Enter the secret you created as `AQK_SETUP_KEY`, admin name, email, and a strong password (at least 12 characters). The first-admin endpoint closes permanently after a Super Admin is created.

Do not share your password or setup key. If the setup page says the setup key is not configured, add the secret in the Production environment and redeploy.

### 7. Add five Librarians
Sign in as Super Admin → **Librarian Accounts** → create a separate account for each librarian and assign one library. Give each librarian a unique strong password. A librarian's API responses and write operations are restricted server-side to their assigned library.

## Testing checklist before school use
- Visit `/api/health` — should return `ok: true` and `database: true`.
- Sign in as Super Admin and confirm five libraries are listed.
- Create a librarian for Library 1 and confirm they cannot see other libraries.
- Add a category and book; check generated copy IDs in Inventory.
- Add a member, issue a copy, return it, and verify the fine calculation.
- Test with a second browser/private window for a different librarian account.
- Back up data and test restore procedures before importing real library records.

## Important limitations / next iterations
- Do not import real data until the deployment has been tested and backed up.
- Fine settings have defaults: Rs. 10 per late day, 50% of price for damage, and book price + Rs. 100 for lost books, plus late fines where applicable. Confirm school policy before use.
- This version provides the core records and workflows. Advanced receipts, RFID/barcode scanner integration, automated cloud backup schedules, student self-service login, e-book storage, SMS/WhatsApp/email notifications, and bulk import/export are not included yet.
- The five initial library names are `Library 1` through `Library 5`; a later admin-facing library naming screen can replace these placeholders with the actual library names.
- The browser does not hold database credentials. All database operations go through Cloudflare Pages Functions and D1.
- Deployment refresh
