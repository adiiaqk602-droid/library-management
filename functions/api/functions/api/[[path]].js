const COOKIE = "aqk_session";
const SESSION_DAYS = 7;
const TABLES = {
  categories: { fields: ["name","code","description","library_id"], scoped: true },
  wings: { fields: ["name","library_id","description"], scoped: true },
  racks: { fields: ["name","code","library_id","wing_id","description"], scoped: true },
  books: { fields: ["ser_no","entry_date","title","author","price","vendor","pages","edition","category_id","library_id","wing_id","rack_id","tag_id","description"], scoped: true },
  members: { fields: ["member_no","full_name","member_type","college_id","class_department","father_name","contact","email","expiry_date","library_id","address","active"], scoped: true }
};
const json = (data, status=200, extra={}) => new Response(JSON.stringify(data), { status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...extra} });
const fail = (message, status=400) => json({error:message}, status);
const safeEqual = (a,b) => { if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false; let n=0; for(let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n===0; };
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function hashPassword(password, saltText) {
  const salt = saltText ? unb64(saltText) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations:100000, hash:"SHA-256"}, key, 256);
return `${b64(salt)}.${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = String(stored||"").split("."); if(!salt||!expected) return false;
  const got = (await hashPassword(password,salt)).split(".")[1]; return safeEqual(got,expected);
}
async function sha256(s) { return b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
function cookieValue(request,name){const raw=request.headers.get("Cookie")||""; const item=raw.split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="));return item?decodeURIComponent(item.slice(name.length+1)):"";}
function cookie(value,maxAge){return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
async function getUser(request,env){const token=cookieValue(request,COOKIE);if(!token)return null;const tokenHash=await sha256(token);const row=await env.DB.prepare(`SELECT u.id,u.email,u.full_name,u.role,u.library_id,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND u.active=1`).bind(tokenHash).first();return row||null;}
function isAdmin(user){return user.role==='super_admin';}
function scopeSql(user,alias=''){if(isAdmin(user))return {sql:'',binds:[]};return {sql:` AND ${alias?alias+'.':''}library_id=?`,binds:[user.library_id]};}
function assertLibrary(user, libraryId){return isAdmin(user) ? Number(libraryId)>0 : Number(libraryId)===Number(user.library_id);}
async function audit(env,user,action,entity,id,details=''){try{await env.DB.prepare('INSERT INTO audit_log(user_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)').bind(user?.id||null,action,entity,String(id??''),String(details).slice(0,1000)).run();}catch{}}
async function bodyJson(request){try{return await request.json();}catch{return null;}}

async function b2Authorize(env) {
  if (!env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_NAME) {
    throw new Error("Backblaze configuration is missing.");
  }

  const credentials = btoa(
    `${env.B2_KEY_ID}:${env.B2_APPLICATION_KEY}`
  );

  const response = await fetch(
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  if (!response.ok) {
    throw new Error("Backblaze authorization failed.");
  }

  const auth = await response.json();
  let bucketId = auth.allowed?.bucketId;

  if (!bucketId) {
    const bucketsResponse = await fetch(
      `${auth.apiUrl}/b2api/v2/b2_list_buckets`,
      {
        method: "POST",
        headers: {
          Authorization: auth.authorizationToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accountId: auth.accountId,
          bucketName: env.B2_BUCKET_NAME
        })
      }
    );

    if (!bucketsResponse.ok) {
      throw new Error("Could not find the Backblaze bucket.");
    }

    const bucketsData = await bucketsResponse.json();
    bucketId = bucketsData.buckets?.find(
      b => b.bucketName === env.B2_BUCKET_NAME
    )?.bucketId;
  }

  if (!bucketId) throw new Error("Backblaze bucket not found.");

  return { ...auth, bucketId };
}

async function b2UploadPdf(env, fileKey, bytes) {
  const auth = await b2Authorize(env);

  const uploadResponse = await fetch(
    `${auth.apiUrl}/b2api/v2/b2_get_upload_url`,
    {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ bucketId: auth.bucketId })
    }
  );

  if (!uploadResponse.ok) {
    throw new Error("Could not prepare PDF upload.");
  }

  const upload = await uploadResponse.json();
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  const sha1 = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const result = await fetch(upload.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: upload.authorizationToken,
      "X-Bz-File-Name": fileKey
        .split("/")
        .map(encodeURIComponent)
        .join("/"),
      "Content-Type": "application/pdf",
      "X-Bz-Content-Sha1": sha1
    },
    body: bytes
  });

  if (!result.ok) throw new Error("PDF upload failed.");
  return await result.json();
}

async function b2ReadPdf(env, fileKey) {
  const auth = await b2Authorize(env);
  const filePath = fileKey
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return await fetch(
    `${auth.downloadUrl}/file/${encodeURIComponent(
      env.B2_BUCKET_NAME
    )}/${filePath}`,
    {
      headers: { Authorization: auth.authorizationToken }
    }
  );
}

async function handle(request,env){
  if(!env.DB) return fail('Cloudflare D1 binding DB is missing. Add the D1 database binding in Cloudflare Pages settings.',503);
  const url=new URL(request.url), path=url.pathname.replace(/^\/api\/?/,''), method=request.method.toUpperCase();
  if(path==='health'&&method==='GET'){const r=await env.DB.prepare('SELECT COUNT(*) AS libraries FROM libraries').first();return json({ok:true,database:true,libraries:r?.libraries||0});}
  if(path==='setup-status'&&method==='GET'){const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE role=\'super_admin\'').first();return json({setupRequired:Number(row?.n||0)===0});}
  if(path==='setup'&&method==='POST'){
    const data=await bodyJson(request);if(!data||!env.AQK_SETUP_KEY)return fail('Admin setup is not configured. Add AQK_SETUP_KEY as a secret in Cloudflare Pages settings.',503);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='super_admin'").first();if(Number(count?.n||0)>0)return fail('Super Admin is already configured. Ask the existing administrator to create users.',409);
    if(!safeEqual(String(data.setup_key||''),String(env.AQK_SETUP_KEY)))return fail('Setup key is incorrect.',403);
    const email=String(data.email||'').trim().toLowerCase(), name=String(data.full_name||'').trim(), password=String(data.password||'');
    if(!email.includes('@')||name.length<2||password.length<12)return fail('Enter a valid email, name, and password of at least 12 characters.');
    const passHash=await hashPassword(password);try{await env.DB.prepare("INSERT INTO users(email,full_name,password_hash,role,library_id) VALUES(?,?,?,'super_admin',NULL)").bind(email,name,passHash).run();}catch(e){return fail('Could not create administrator. Email may already exist.',409);}
    await audit(env,{id:1},'setup','users',email,'First Super Admin created');return json({ok:true,message:'Super Admin created. Sign in now.'},201);
  }
  if(path==='login'&&method==='POST'){
    const data=await bodyJson(request);if(!data)return fail('Invalid request.');const email=String(data.email||'').trim().toLowerCase(), password=String(data.password||'');
    const user=await env.DB.prepare('SELECT id,email,full_name,password_hash,role,library_id,active FROM users WHERE email=? COLLATE NOCASE').bind(email).first();
    if(!user||!user.active||!(await verifyPassword(password,user.password_hash)))return fail('Email or password is incorrect.',401);
    const token=b64(crypto.getRandomValues(new Uint8Array(32))), tokenHash=await sha256(token);
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')").run();
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now',?))").bind(tokenHash,user.id,`+${SESSION_DAYS} days`).run();
    await audit(env,user,'login','users',user.id,'');delete user.password_hash;
    return json({user},200,{'set-cookie':cookie(token,SESSION_DAYS*86400)});
  }
  if(path==='logout'&&method==='POST'){const token=cookieValue(request,COOKIE);if(token)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();return json({ok:true},200,{'set-cookie':cookie('',0)});}
  const user=await getUser(request,env);if(!user)return fail('Please sign in.',401);
  
  // List E-Books visible to the signed-in user
  if (path === "ebooks" && method === "GET") {
    const rows = await env.DB.prepare(`
      SELECT e.id, e.title, e.author, e.description,
             e.category_id, e.library_id, e.file_size,
             e.original_filename, e.created_at,
             c.name AS category_name, l.name AS library_name
      FROM ebooks e
      LEFT JOIN categories c ON c.id = e.category_id
      JOIN libraries l ON l.id = e.library_id
      WHERE e.active = 1
      ${isAdmin(user) ? "" : "AND e.library_id = ?"}
      ORDER BY e.created_at DESC
      LIMIT 500
    `).bind(...(isAdmin(user) ? [] : [user.library_id])).all();

    return json({ data: rows.results || [] });
  }

   // Upload a PDF to the private Backblaze bucket
  if (path === "ebooks" && method === "POST") {
    if (isAdmin(user)) {
      return fail("Super Admin can view E-Books but cannot upload.", 403);
    }

    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const author = String(form.get("author") || "").trim();
    const description = String(form.get("description") || "").trim();
    const libraryId = Number(form.get("library_id"));
    const categoryValue = String(form.get("category_id") || "").trim();
    const categoryId = categoryValue ? Number(categoryValue) : null;

    if (!title || !libraryId || !(file instanceof File)) {
      return fail("Title, library and PDF file are required.");
    }

    if (!assertLibrary(user, libraryId)) {
      return fail("You cannot upload to another library.", 403);
    }

    if (file.size < 5 || file.size > 25 * 1024 * 1024 || file.type !== "application/pdf") {
      return fail("Choose a PDF file no larger than 25 MB.");
    }

    if (categoryId !== null) {
      const category = await env.DB.prepare(
        "SELECT id FROM categories WHERE id = ?"
      ).bind(categoryId).first();

      if (!category) return fail("Category not found.");
    }

    const library = await env.DB.prepare(
      "SELECT id FROM libraries WHERE id = ?"
    ).bind(libraryId).first();

    if (!library) return fail("Library not found.");

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return fail("The selected file is not a valid PDF.");
    }

    const fileKey = `ebooks/${libraryId}/${crypto.randomUUID()}.pdf`;

    try {
      await b2UploadPdf(env, fileKey, bytes);
    } catch {
      return fail("PDF storage failed. Check Backblaze bucket permissions and Cloudflare Secrets.", 502);
    }

    try {
      const result = await env.DB.prepare(`
        INSERT INTO ebooks
          (title, author, description, category_id, library_id,
           file_key, original_filename, mime_type, file_size,
           active, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'application/pdf', ?, 1, ?)
      `).bind(
        title,
        author || null,
        description || null,
        categoryId,
        libraryId,
        fileKey,
        file.name.slice(0, 255),
        file.size,
        user.id
      ).run();

      await audit(env, user, "create", "ebooks", result.meta.last_row_id, title);

      return json({ ok: true, id: result.meta.last_row_id }, 201);
    } catch {
      return fail("PDF uploaded but database save failed. Contact the administrator.", 500);
    }
  }
  
  // Stream a private PDF only after checking library access
  const ebookFileMatch = path.match(/^ebooks\/(\d+)\/file$/);

  if (ebookFileMatch && method === "GET") {
    const ebook = await env.DB.prepare(`
      SELECT id, library_id, file_key
      FROM ebooks
      WHERE id = ? AND active = 1
    `).bind(Number(ebookFileMatch[1])).first();

    if (!ebook) return fail("E-Book not found.", 404);

    if (!assertLibrary(user, ebook.library_id)) {
      return fail("You cannot read this library's E-Books.", 403);
    }

    let response;
    try {
      response = await b2ReadPdf(env, ebook.file_key);
    } catch {
      return fail("Could not access PDF storage.", 502);
    }

    if (!response.ok) {
      return fail("Could not retrieve PDF.", 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  if(path==='me'&&method==='GET')return json({user});
   if(path==='users'&&method==='GET'){
    const rows=await env.DB.prepare('SELECT id,email,full_name,role,library_id,active,created_at FROM users ORDER BY full_name').all();
    return json({data:rows.results||[]});
  }
  if(path==='users'&&method==='POST'){
    if(!isAdmin(user))return fail('Only Super Admin can create librarian accounts.',403);const d=await bodyJson(request);if(!d)return fail('Invalid request.');
    const email=String(d.email||'').trim().toLowerCase(),name=String(d.full_name||'').trim(),password=String(d.password||''),libraryId=Number(d.library_id);
    if(!email.includes('@')||name.length<2||password.length<12||!libraryId)return fail('Provide name, valid email, library and a password of at least 12 characters.');
    const lib=await env.DB.prepare('SELECT id FROM libraries WHERE id=?').bind(libraryId).first();if(!lib)return fail('Library not found.');
    try{const r=await env.DB.prepare("INSERT INTO users(email,full_name,password_hash,role,library_id) VALUES(?,?,?,'librarian',?)").bind(email,name,await hashPassword(password),libraryId).run();await audit(env,user,'create','users',r.meta.last_row_id,email);return json({ok:true,id:r.meta.last_row_id},201);}catch{return fail('Could not create account; email may already exist.',409);}
  }
  if(path==='users'&&method==='PATCH'){
    if(!isAdmin(user))return fail('Forbidden.',403);const d=await bodyJson(request);if(!d||!Number(d.id))return fail('User ID required.');const active=d.active?1:0;await env.DB.prepare("UPDATE users SET active=? WHERE id=? AND role='librarian'").bind(active,Number(d.id)).run();await audit(env,user,'update','users',d.id,`active=${active}`);return json({ok:true});
  }
  if(path==='settings'&&method==='GET'){const rows=await env.DB.prepare('SELECT key,value FROM settings ORDER BY key').all();return json({data:rows.results||[]});}
  if(path==='settings'&&method==='POST'){
    if(!isAdmin(user))return fail('Only Super Admin can change fine settings.',403);const d=await bodyJson(request);const allowed={fine_per_day:0,damaged_fine_percent:0,lost_book_extra_fine:0,loan_days:1};if(!d||!(d.key in allowed)||!Number.isFinite(Number(d.value))||Number(d.value)<allowed[d.key])return fail('Invalid setting.');await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(d.key,String(d.value)).run();return json({ok:true});
  }
  if(path==='reports'&&method==='GET'){
    const sc=scopeSql(user,'l');const [bookCount,copyCount,memberCount,activeLoans,overdue,fines,categoryRows,libraryRows,inventoryRows]=await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) n FROM books b WHERE 1=1${isAdmin(user)?'':' AND b.library_id=?'}`).bind(...(isAdmin(user)?[]:[user.library_id])).first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM book_copies c JOIN books b ON b.id=c.book_id WHERE 1=1${isAdmin(user)?'':' AND b.library_id=?'}`).bind(...(isAdmin(user)?[]:[user.library_id])).first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM members WHERE 1=1${isAdmin(user)?'':' AND library_id=?'}`).bind(...(isAdmin(user)?[]:[user.library_id])).first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM loans l WHERE l.status='issued'${sc.sql}`).bind(...sc.binds).first(),
      env.DB.prepare(`SELECT COUNT(*) n FROM loans l WHERE l.status='issued' AND l.due_date<date('now')${sc.sql}`).bind(...sc.binds).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(fine_amount-fine_paid),0) n FROM loans l WHERE 1=1${sc.sql}`).bind(...sc.binds).first(),
      env.DB.prepare(`SELECT COALESCE(c.name,'Uncategorised') label,COUNT(b.id) total FROM books b LEFT JOIN categories c ON c.id=b.category_id WHERE 1=1${isAdmin(user)?'':' AND b.library_id=?'} GROUP BY c.name ORDER BY total DESC`).bind(...(isAdmin(user)?[]:[user.library_id])).all(),
      env.DB.prepare(`SELECT l.name label,COUNT(b.id) total FROM libraries l LEFT JOIN books b ON b.library_id=l.id ${isAdmin(user)?'':'WHERE l.id=?'} GROUP BY l.id ORDER BY l.name`).bind(...(isAdmin(user)?[]:[user.library_id])).all(),
      env.DB.prepare(`SELECT bc.stock_type label,bc.status status,COUNT(*) total FROM book_copies bc JOIN books b ON b.id=bc.book_id WHERE 1=1${isAdmin(user)?'':' AND b.library_id=?'} GROUP BY bc.stock_type,bc.status ORDER BY bc.stock_type,bc.status`).bind(...(isAdmin(user)?[]:[user.library_id])).all()
    ]);return json({stats:{books:bookCount.n,copies:copyCount.n,members:memberCount.n,issued:activeLoans.n,overdue:overdue.n,outstandingFine:fines.n},byCategory:categoryRows.results||[],byLibrary:libraryRows.results||[],inventory:inventoryRows.results||[]});
  }
  if(path==='issue'&&method==='POST'){
    const d=await bodyJson(request);if(!d)return fail('Invalid request.');const member=await env.DB.prepare('SELECT id,library_id,active FROM members WHERE id=?').bind(Number(d.member_id)).first();const copy=await env.DB.prepare('SELECT c.id,c.status,b.library_id,b.price FROM book_copies c JOIN books b ON b.id=c.book_id WHERE c.id=?').bind(Number(d.copy_id)).first();
    if(!member||!copy||!member.active)return fail('Member or book copy not found/active.');if(Number(member.library_id)!==Number(copy.library_id))return fail('Member and book copy must belong to the same library.');if(!assertLibrary(user,member.library_id))return fail('You cannot issue books from another library.',403);if(copy.status!=='available')return fail('This copy is not available.',409);
    const issueDate=String(d.issue_date||new Date().toISOString().slice(0,10)),dueDate=String(d.due_date||'');if(!dueDate||dueDate<issueDate)return fail('Due date must be on or after issue date.');
    const result=await env.DB.prepare("INSERT INTO loans(library_id,member_id,copy_id,issue_date,due_date,status,issued_by) VALUES(?,?,?,?,?,'issued',?)").bind(member.library_id,member.id,copy.id,issueDate,dueDate,user.id).run();await env.DB.prepare("UPDATE book_copies SET status='issued' WHERE id=?").bind(copy.id).run();await audit(env,user,'issue','loans',result.meta.last_row_id,`copy=${copy.id}`);return json({ok:true,id:result.meta.last_row_id},201);
  }
  if(path==='return'&&method==='POST'){
    const d=await bodyJson(request);if(!d||!Number(d.id))return fail('Loan ID required.');const loan=await env.DB.prepare('SELECT l.*,c.book_id,b.price FROM loans l JOIN book_copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id WHERE l.id=?').bind(Number(d.id)).first();if(!loan||loan.status!=='issued')return fail('Active loan not found.');if(!assertLibrary(user,loan.library_id))return fail('You cannot return a book from another library.',403);
    const returnDate=String(d.return_date||new Date().toISOString().slice(0,10));const lateDays=Math.max(0,Math.floor((Date.parse(returnDate+'T00:00:00Z')-Date.parse(loan.due_date+'T00:00:00Z'))/86400000));const setting=async(k,def)=>Number((await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(k).first())?.value??def);const finePerDay=await setting('fine_per_day',10);let fine=lateDays*finePerDay;const disposition=String(d.disposition||'returned');if(disposition==='damaged')fine+=loan.price*(await setting('damaged_fine_percent',50))/100;if(disposition==='lost')fine+=loan.price+await setting('lost_book_extra_fine',100);
    const status=disposition==='lost'?'lost':'returned';await env.DB.prepare('UPDATE loans SET status=?,return_date=?,returned_by=?,fine_amount=?,notes=? WHERE id=?').bind(status,returnDate,user.id,fine,String(d.notes||'').slice(0,500),loan.id).run();await env.DB.prepare('UPDATE book_copies SET status=?,condition=? WHERE id=?').bind(disposition==='lost'?'lost':disposition==='damaged'?'damaged':'available',disposition==='lost'?'Lost':disposition==='damaged'?'Damaged':'Good',loan.copy_id).run();await audit(env,user,'return','loans',loan.id,`fine=${fine}; disposition=${disposition}`);return json({ok:true,fine,lateDays});
  }
  if(path==='loans'&&method==='GET'){
    const rows=await env.DB.prepare(`SELECT l.*,m.full_name,m.member_no,bc.copy_code,b.title,b.price,lib.name library_name FROM loans l JOIN members m ON m.id=l.member_id JOIN book_copies bc ON bc.id=l.copy_id JOIN books b ON b.id=bc.book_id JOIN libraries lib ON lib.id=l.library_id WHERE 1=1${isAdmin(user)?'':' AND l.library_id=?'} ORDER BY l.created_at DESC LIMIT 1000`).bind(...(isAdmin(user)?[]:[user.library_id])).all();return json({data:rows.results||[]});
  }
  if(path==='copies'&&method==='GET'){
    const rows=await env.DB.prepare(`SELECT c.*,b.title,b.author,b.price,b.library_id,lib.name library_name FROM book_copies c JOIN books b ON b.id=c.book_id JOIN libraries lib ON lib.id=b.library_id WHERE 1=1${isAdmin(user)?'':' AND b.library_id=?'} ORDER BY b.title,c.copy_code`).bind(...(isAdmin(user)?[]:[user.library_id])).all();return json({data:rows.results||[]});
  }
  if(path==='libraries'&&method==='GET'){
    const rows=await env.DB.prepare(`SELECT * FROM libraries ${isAdmin(user)?'':'WHERE id=?'} ORDER BY name`).bind(...(isAdmin(user)?[]:[user.library_id])).all();return json({data:rows.results||[]});
  }
  if(path==='libraries'&&method==='PATCH'){
    if(!isAdmin(user))return fail('Only Super Admin can rename libraries.',403);const d=await bodyJson(request);if(!d||!Number(d.id)||!String(d.name||'').trim())return fail('Library ID and name are required.');try{await env.DB.prepare('UPDATE libraries SET name=?,code=? WHERE id=?').bind(String(d.name).trim(),String(d.code||'').trim()||`LIB-${String(d.id).padStart(2,'0')}`,Number(d.id)).run();await audit(env,user,'update','libraries',d.id,'');return json({ok:true});}catch{return fail('Could not update library name/code. The name or code may already exist.',409);}
  }
  const match=path.match(/^([a-z_]+)(?:\/(\d+))?$/);if(!match||!TABLES[match[1]])return fail('API route not found.',404);const table=match[1],id=match[2]?Number(match[2]):null,meta=TABLES[table];
  if(method==='GET'){
    const sc=scopeSql(user);let sql=`SELECT * FROM ${table} WHERE 1=1${sc.sql}`;const binds=[...sc.binds];if(url.searchParams.get('q')){const q=`%${url.searchParams.get('q').slice(0,100)}%`;const field=table==='books'?'title':table==='members'?'full_name':'name';sql+=` AND ${field} LIKE ?`;binds.push(q);}sql+=' ORDER BY id DESC LIMIT 1000';const rows=await env.DB.prepare(sql).bind(...binds).all();return json({data:rows.results||[]});
  }
  if(method==='POST'){
    const d=await bodyJson(request);if(!d)return fail('Invalid request.');const row={};for(const f of meta.fields)if(Object.prototype.hasOwnProperty.call(d,f))row[f]=d[f]=== ''?null:d[f];
    if(!isAdmin(user)){if(!meta.scoped)return fail('Forbidden.',403);row.library_id=user.library_id;if(d.library_id&&Number(d.library_id)!==Number(user.library_id))return fail('You cannot add records to another library.',403);}
    if(['books','members','wings','racks'].includes(table)&&!row.library_id)return fail('Library is required.');if(table==='categories'&&!row.name)return fail('Category name is required.');if(table==='categories'&&!row.code){const prefix=String(row.name||'CAT').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)||'CAT';const n=await env.DB.prepare('SELECT COUNT(*) n FROM categories WHERE code LIKE ?').bind(`${prefix}-%`).first();row.code=`${prefix}-${String(Number(n.n||0)+1).padStart(3,'0')}`;}
    if(table==='books'&&!row.title)return fail('Book title is required.');if(table==='members'){row.member_no=row.member_no||`AQK-${Date.now().toString().slice(-8)}`;row.member_type=row.member_type||'Student';}
    const keys=Object.keys(row);if(!keys.length)return fail('No valid fields provided.');const placeholders=keys.map(()=>'?').join(',');try{const result=await env.DB.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).bind(...keys.map(k=>row[k])).run();const newId=result.meta.last_row_id;
      if(table==='books'){const count=Math.max(1,Math.min(500,Number(d.copy_count)||1));const prefix=`${String(row.tag_id||row.ser_no||'AQK').replace(/[^A-Za-z0-9-]/g,'').slice(0,24)}-${newId}`;const condition=d.condition||'New';const copyStatus=condition==='Lost'?'lost':condition==='Damaged'?'damaged':condition==='Repair'?'repair':'available';const statements=[];for(let i=1;i<=count;i++)statements.push(env.DB.prepare('INSERT INTO book_copies(book_id,copy_code,status,condition,stock_type) VALUES(?,?,?,?,?)').bind(newId,`${prefix}-C${String(i).padStart(3,'0')}`,copyStatus,condition,d.stock_type||'New'));await env.DB.batch(statements);}
      await audit(env,user,'create',table,newId,'');return json({ok:true,id:newId,row},201);
    }catch(e){return fail('Could not save record. Check required fields and unique codes.',409);}
  }
  if(method==='PATCH'&&id){const d=await bodyJson(request);if(!d)return fail('Invalid request.');const current=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();if(!current)return fail('Record not found.',404);if(!isAdmin(user)&&Number(current.library_id)!==Number(user.library_id))return fail('Forbidden.',403);if(!isAdmin(user)&&Object.prototype.hasOwnProperty.call(d,'library_id')&&Number(d.library_id)!==Number(user.library_id))return fail('You cannot move records to another library.',403);const keys=meta.fields.filter(f=>Object.prototype.hasOwnProperty.call(d,f));if(!keys.length)return fail('No editable fields provided.');const vals=keys.map(k=>d[k]===''?null:d[k]);try{await env.DB.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...vals,id).run();await audit(env,user,'update',table,id,'');return json({ok:true});}catch{return fail('Could not update record.',409);}}
  if(method==='DELETE'&&id){const current=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();if(!current)return fail('Record not found.',404);if(!isAdmin(user)&&(!meta.scoped||Number(current.library_id)!==Number(user.library_id)))return fail('You cannot delete records outside your assigned library.',403);await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();await audit(env,user,'delete',table,id,'');return json({ok:true});}
  return fail('Method not allowed.',405);
}
export async function onRequest(context){try{return await handle(context.request,context.env);}catch(e){return json({error:'Server error. Check D1 migration and Cloudflare function logs.'},500);}}
