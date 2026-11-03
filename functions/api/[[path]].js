const COOKIE = "aqk_session"; 
const SESSION_DAYS = 7;
const TABLES = {
  categories: { fields: ["name","code","description","library_id"], scoped: true },
  wings: { fields: ["name","library_id","description"], scoped: true },
 racks: {
 fields: [
  "name",
  "code",
  "library_id",
  "wing_id",
  "description",
  "rack_number"
  ],
  scoped: true
},
books: { fields: ["ser_no","accession_no","entry_date","title","author","co_author","isbn","price","vendor","pages","edition","volume_number","publisher","publication_year","language","category_id","subcategory","library_id","wing_id","department_class","rack_id","shelf_number","tag_id","description","purchase_date","invoice_number","discount","donor_information","cover_image"], scoped: true },  members: { fields: ["member_no","full_name","member_type","college_id","class_department","father_name","contact","email","expiry_date","library_id","address","active"], scoped: true }
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
  if(path==='me'&&method==='GET')return json({user});
  if(path==='users'&&method==='GET'){
    if(!isAdmin(user))return fail('Only Super Admin can manage user accounts.',403);
    const rows=await env.DB.prepare('SELECT id,email,full_name,role,library_id,active,created_at FROM users ORDER BY full_name').all();return json({data:rows.results||[]});
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
    // INVENTORY SUMMARY: stock by library, type, status and condition
  if(path==='inventory/summary'&&method==='GET'){
    const libraryFilter=isAdmin(user)?'':' AND b.library_id=?';
    const binds=isAdmin(user)?[]:[user.library_id];

    const stock=await env.DB.prepare(`
      SELECT
        b.library_id,
        lib.name AS library_name,
        COALESCE(bc.stock_type,'New') AS stock_type,
        COALESCE(bc.status,'available') AS status,
        COALESCE(bc.condition,'Good') AS condition,
        COUNT(*) AS quantity
      FROM book_copies bc
      JOIN books b ON b.id=bc.book_id
      JOIN libraries lib ON lib.id=b.library_id
      WHERE 1=1 ${libraryFilter}
      GROUP BY b.library_id,lib.name,bc.stock_type,bc.status,bc.condition
      ORDER BY lib.name,bc.stock_type,bc.status
    `).bind(...binds).all();

  
const racks=await env.DB.prepare(`
  SELECT
    r.id,
    r.name,
    r.code,
    r.rack_number,
    r.library_id,
    lib.name AS library_name,
    COUNT(DISTINCT bc.id) AS current_stock
  FROM racks r
  JOIN libraries lib ON lib.id=r.library_id
  LEFT JOIN book_copies bc
    ON bc.rack_id=r.id
  LEFT JOIN books b
    ON b.id=bc.book_id
    AND b.library_id=r.library_id
  WHERE 1=1 ${isAdmin(user)?'':' AND r.library_id=?'}
  GROUP BY r.id
  ORDER BY lib.name,r.name
`).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({
      stock:stock.results||[],
      racks:racks.results||[]
    });
  }

 
// RACK-WISE BOOK LIST
if(path==='inventory/rack-books'&&method==='GET'){
  const rackId=Number(url.searchParams.get('rack_id')||0);
  if(!rackId)return fail('Rack ID is required.');

  const rack=await env.DB.prepare(
    'SELECT id,library_id FROM racks WHERE id=?'
  ).bind(rackId).first();

  if(!rack)return fail('Rack not found.',404);

  if(!assertLibrary(user,rack.library_id))
    return fail('You cannot view another library rack.',403);

 const rows=await env.DB.prepare(`
  SELECT
    bc.*,
    COALESCE(bc.rack_id,b.rack_id) AS assigned_rack_id,
    b.title,
    b.author,
    b.ser_no,
    b.accession_no,
    b.price,
    b.library_id,
    r.name AS rack_name,
    r.rack_number
  FROM book_copies bc
  JOIN books b ON b.id=bc.book_id
  LEFT JOIN racks r
    ON r.id=COALESCE(bc.rack_id,b.rack_id)
  WHERE COALESCE(bc.rack_id,b.rack_id)=?
    AND b.library_id=?
  ORDER BY b.title,bc.copy_code
`).bind(rackId,rack.library_id).all();

return json({data:rows.results||[]});
}

  return json({data:rows.results||[]});
}

  // INVENTORY MOVEMENT HISTORY
  if(path==='inventory/movements'&&method==='GET'){
    const rows=await env.DB.prepare(`
      SELECT
        m.*,
        b.title AS book_title,
        bc.copy_code,
        r.name AS rack_name,
        lib.name AS library_name,
        u.full_name AS user_name
      FROM inventory_movements m
      LEFT JOIN books b ON b.id=m.book_id
      LEFT JOIN book_copies bc ON bc.id=m.copy_id
      LEFT JOIN racks r ON r.id=m.rack_id
      JOIN libraries lib ON lib.id=m.library_id
      LEFT JOIN users u ON u.id=m.user_id
      WHERE 1=1 ${isAdmin(user)?'':' AND m.library_id=?'}
      ORDER BY m.created_at DESC
      LIMIT 1000
    `).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({data:rows.results||[]});
  }
   // STOCK IN / OUT, CONDITION CHANGES AND STOCK ADJUSTMENT
  if(path==='inventory/movement'&&method==='POST'){
    const d=await bodyJson(request);
    if(!d)return fail('Invalid request.');

    const copyId=Number(d.copy_id);
    const movementType=String(d.movement_type||'').toLowerCase();

    const allowedTypes=[
      'stock_in',
      'stock_out',
      'damaged',
      'lost',
      'repair',
      'binding_required',
      'adjustment'
    ];

    if(!copyId||!allowedTypes.includes(movementType))
      return fail('Valid copy ID and movement type are required.');

    const copy=await env.DB.prepare(`
      SELECT
        bc.id,bc.book_id,bc.status,bc.condition,
        bc.stock_type,bc.rack_id,
        b.library_id,b.price
      FROM book_copies bc
      JOIN books b ON b.id=bc.book_id
      WHERE bc.id=?
    `).bind(copyId).first();

    if(!copy)return fail('Book copy not found.',404);

    if(!assertLibrary(user,copy.library_id))
      return fail('You cannot change stock in another library.',403);

    if(copy.status==='issued')
      return fail('Issued books cannot be changed. Return the book first.',409);

    const newStatus={
      stock_in:'available',
      stock_out:'withdrawn',
      damaged:'damaged',
      lost:'lost',
      repair:'repair',
      binding_required:'binding_required'
    };

    let status=newStatus[movementType]||String(d.status||'');
    let condition=String(d.condition_after||copy.condition||'Good');

    if(movementType==='adjustment'){
      const allowedStatuses=[
        'available','damaged','lost','repair',
        'binding_required','withdrawn'
      ];
      if(!allowedStatuses.includes(status))
        return fail('Invalid adjustment status.');
    }

    if(movementType==='damaged')condition='Damaged';
    if(movementType==='lost')condition='Lost';
    if(movementType==='repair')condition='Repair';
    if(movementType==='binding_required')condition='Binding Required';
    if(movementType==='stock_in')condition='Good';

    let rackId=copy.rack_id;

    if(d.rack_id!==undefined){
      rackId=d.rack_id===null||d.rack_id===''?null:Number(d.rack_id);

      if(rackId!==null){
        if(!Number.isInteger(rackId)||rackId<=0)
          return fail('Invalid rack ID.');

        const rack=await env.DB.prepare(
          'SELECT id,library_id FROM racks WHERE id=?'
        ).bind(rackId).first();

        if(!rack||Number(rack.library_id)!==Number(copy.library_id))
          return fail('Rack must belong to the same library.');
      }
    }

    const note=String(d.reference_note||'').slice(0,500);
    const quantity=1;

    try{
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE book_copies
          SET status=?,condition=?,rack_id=?
          WHERE id=?
        `).bind(status,condition,rackId,copyId),

        env.DB.prepare(`
          INSERT INTO inventory_movements
          (library_id,book_id,copy_id,rack_id,movement_type,
           quantity,condition_before,condition_after,reference_note,user_id)
          VALUES(?,?,?,?,?,?,?,?,?,?)
        `).bind(
          copy.library_id,
          copy.book_id,
          copyId,
          rackId,
          movementType,
          quantity,
          copy.condition||'',
          condition,
          note,
          user.id
        )
      ]);

      await audit(
        env,user,'inventory_'+movementType,
        'book_copies',copyId,
        `status=${copy.status} -> ${status}; condition=${condition}; ${note}`
      );

      return json({
        ok:true,
        copy_id:copyId,
        previous_status:copy.status,
        status,
        condition,
        rack_id:rackId
      });
    }catch(e){
      console.error('INVENTORY MOVEMENT ERROR:',e);
      return fail('Could not update inventory. Please check the record.',500);
    }
  }
    // PHYSICAL STOCK VERIFICATION: list verification sessions
  if(path==='inventory/verifications'&&method==='GET'){
    const rows=await env.DB.prepare(`
      SELECT
        v.*,
        lib.name AS library_name,
        u.full_name AS created_by_name,
        COUNT(i.id) AS total_copies,
        SUM(CASE WHEN i.found=1 THEN 1 ELSE 0 END) AS found_copies,
        SUM(CASE WHEN i.found=0 THEN 1 ELSE 0 END) AS missing_copies
      FROM stock_verifications v
      JOIN libraries lib ON lib.id=v.library_id
      LEFT JOIN users u ON u.id=v.created_by
      LEFT JOIN stock_verification_items i ON i.verification_id=v.id
      WHERE 1=1 ${isAdmin(user)?'':' AND v.library_id=?'}
      GROUP BY v.id
      ORDER BY v.created_at DESC
      LIMIT 500
    `).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({data:rows.results||[]});
  }

  // START A PHYSICAL STOCK VERIFICATION
  if(path==='inventory/verification'&&method==='POST'){
    const d=await bodyJson(request);
    if(!d)return fail('Invalid request.');

    const libraryId=isAdmin(user)
      ? Number(d.library_id)
      : Number(user.library_id);

    if(!assertLibrary(user,libraryId))
      return fail('You cannot verify another library.',403);

    const library=await env.DB.prepare(
      'SELECT id FROM libraries WHERE id=? AND active=1'
    ).bind(libraryId).first();

    if(!library)return fail('Active library not found.');

    try{
      const result=await env.DB.prepare(`
        INSERT INTO stock_verifications
        (library_id,verification_date,notes,created_by)
        VALUES(?,?,?,?)
      `).bind(
        libraryId,
        String(d.verification_date||new Date().toISOString().slice(0,10)),
        String(d.notes||'').slice(0,500),
        user.id
      ).run();

      const verificationId=result.meta.last_row_id;

      await env.DB.prepare(`
        INSERT INTO stock_verification_items
        (verification_id,copy_id,expected_status,actual_status,found,checked_by)
        SELECT ?,bc.id,bc.status,bc.status,1,?
        FROM book_copies bc
        JOIN books b ON b.id=bc.book_id
        WHERE b.library_id=?
      `).bind(verificationId,user.id,libraryId).run();

      await audit(
        env,user,'create','stock_verifications',
        verificationId,`library=${libraryId}`
      );

      return json({ok:true,id:verificationId},201);
    }catch(e){
      console.error('VERIFICATION START ERROR:',e);
      return fail('Could not start stock verification.',500);
    }
  }

  // CHECK ONE COPY DURING VERIFICATION
  if(path==='inventory/verification/check'&&method==='POST'){
    const d=await bodyJson(request);
    if(!d)return fail('Invalid request.');

    const verificationId=Number(d.verification_id);
    const copyId=Number(d.copy_id);
    const found=d.found===false||Number(d.found)===0?0:1;

    if(!verificationId||!copyId)
      return fail('Verification ID and Copy ID are required.');

    const item=await env.DB.prepare(`
      SELECT
        i.id,i.expected_status,
        v.library_id,v.status AS verification_status,
        bc.book_id,bc.status AS copy_status,bc.condition,
        b.library_id AS book_library_id
      FROM stock_verification_items i
      JOIN stock_verifications v ON v.id=i.verification_id
      JOIN book_copies bc ON bc.id=i.copy_id
      JOIN books b ON b.id=bc.book_id
      WHERE i.verification_id=? AND i.copy_id=?
    `).bind(verificationId,copyId).first();

    if(!item)return fail('Verification item not found.',404);
    if(item.verification_status!=='open')
      return fail('This verification is already completed.',409);
    if(!assertLibrary(user,item.library_id))
      return fail('You cannot verify another library.',403);
    if(Number(item.book_library_id)!==Number(item.library_id))
      return fail('Library record mismatch.',409);

    const actualStatus=found
      ? String(d.actual_status||item.copy_status)
      : 'missing';

    if(found&&![
      'available','issued','damaged','lost','repair',
      'binding_required','withdrawn'
    ].includes(actualStatus)){
      return fail('Invalid actual stock status.');
    }

    try{
      await env.DB.prepare(`
        UPDATE stock_verification_items
        SET found=?,actual_status=?,notes=?,checked_by=?,
            checked_at=datetime('now')
        WHERE verification_id=? AND copy_id=?
      `).bind(
        found,
        actualStatus,
        String(d.notes||'').slice(0,500),
        user.id,
        verificationId,
        copyId
      ).run();

      if(!found){
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE book_copies
            SET status='lost',condition='Lost'
            WHERE id=? AND status!='issued'
          `).bind(copyId),

          env.DB.prepare(`
            INSERT INTO inventory_movements
            (library_id,book_id,copy_id,rack_id,movement_type,
             quantity,condition_before,condition_after,reference_note,user_id)
            SELECT b.library_id,bc.book_id,bc.id,bc.rack_id,
                   'missing',1,bc.condition,'Lost',
                   'Marked missing during physical verification',?
            FROM book_copies bc
            JOIN books b ON b.id=bc.book_id
            WHERE bc.id=? AND bc.status!='issued'
          `).bind(user.id,copyId)
        ]);
      }

      await audit(
        env,user,'verify_copy','stock_verification_items',
        copyId,`verification=${verificationId}; found=${found}`
      );

      return json({ok:true,copy_id:copyId,found});
    }catch(e){
      console.error('VERIFICATION CHECK ERROR:',e);
      return fail('Could not save verification result.',500);
    }
  }

  // COMPLETE A PHYSICAL STOCK VERIFICATION
  if(path==='inventory/verification/complete'&&method==='POST'){
    const d=await bodyJson(request);
    if(!d||!Number(d.verification_id))
      return fail('Verification ID is required.');

    const verificationId=Number(d.verification_id);

    const verification=await env.DB.prepare(
      'SELECT * FROM stock_verifications WHERE id=?'
    ).bind(verificationId).first();

    if(!verification)return fail('Verification not found.',404);
    if(!assertLibrary(user,verification.library_id))
      return fail('You cannot complete another library verification.',403);
    if(verification.status!=='open')
      return fail('Verification is already completed.',409);

    const unchecked=await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM stock_verification_items
      WHERE verification_id=? AND checked_at IS NULL
    `).bind(verificationId).first();

    if(Number(unchecked?.total||0)>0)
      return fail('Please check every copy before completing verification.',409);

    await env.DB.prepare(`
      UPDATE stock_verifications
      SET status='completed',completed_at=datetime('now')
      WHERE id=?
    `).bind(verificationId).run();

    await audit(
      env,user,'complete','stock_verifications',
      verificationId,'Physical stock verification completed'
    );

    return json({ok:true});
  }

  // MISSING BOOKS REPORT
  if(path==='inventory/missing'&&method==='GET'){
    const rows=await env.DB.prepare(`
      SELECT
        bc.id AS copy_id,
        bc.copy_code,
        bc.status,
        bc.condition,
        b.id AS book_id,
        b.title,
        b.author,
        b.ser_no,
        b.accession_no,
        b.price,
        b.library_id,
        lib.name AS library_name,
        r.name AS rack_name,
        m.created_at AS marked_missing_at,
        m.reference_note
      FROM inventory_movements m
      JOIN book_copies bc ON bc.id=m.copy_id
      JOIN books b ON b.id=bc.book_id
      JOIN libraries lib ON lib.id=b.library_id
      LEFT JOIN racks r ON r.id=bc.rack_id
      WHERE m.movement_type='missing'
        AND bc.status='lost'
        ${isAdmin(user)?'':' AND b.library_id=?'}
      ORDER BY m.created_at DESC
      LIMIT 1000
    `).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({data:rows.results||[]});
  }
    // MINIMUM STOCK ALERTS
  if(path==='inventory/alerts'&&method==='GET'){
    const rows=await env.DB.prepare(`
      SELECT
        r.id AS rack_id,
        r.name AS rack_name,
        r.rack_number,
          r.minimum_stock,
        r.library_id,
        lib.name AS library_name,
        COUNT(bc.id) AS current_stock,
        (r.minimum_stock-COUNT(bc.id)) AS shortage
      FROM racks r
      JOIN libraries lib ON lib.id=r.library_id
      LEFT JOIN book_copies bc
        ON COALESCE(bc.rack_id,
          (SELECT b.rack_id FROM books b WHERE b.id=bc.book_id)
        )=r.id
      WHERE r.minimum_stock>0
        ${isAdmin(user)?'':' AND r.library_id=?'}
      GROUP BY r.id
      HAVING COUNT(bc.id)<r.minimum_stock
      ORDER BY shortage DESC,r.name
    `).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({data:rows.results||[]});
  }

  // INVENTORY AUDIT REPORT
  if(path==='inventory/audit'&&method==='GET'){
    const from=url.searchParams.get('from');
    const to=url.searchParams.get('to');

    let conditions='WHERE 1=1';
    const binds=[];

    if(!isAdmin(user)){
      conditions+=' AND m.library_id=?';
      binds.push(user.library_id);
    }

    if(from){
      conditions+=' AND date(m.created_at)>=date(?)';
      binds.push(from);
    }

    if(to){
      conditions+=' AND date(m.created_at)<=date(?)';
      binds.push(to);
    }

    const rows=await env.DB.prepare(`
      SELECT
        m.*,
        b.title AS book_title,
        b.ser_no,
        bc.copy_code,
        r.name AS rack_name,
        lib.name AS library_name,
        u.full_name AS user_name
      FROM inventory_movements m
      LEFT JOIN books b ON b.id=m.book_id
      LEFT JOIN book_copies bc ON bc.id=m.copy_id
      LEFT JOIN racks r ON r.id=m.rack_id
      JOIN libraries lib ON lib.id=m.library_id
      LEFT JOIN users u ON u.id=m.user_id
      ${conditions}
      ORDER BY m.created_at DESC
      LIMIT 2000
    `).bind(...binds).all();

    return json({data:rows.results||[]});
  }

  // STOCK VALUE REPORT
  if(path==='inventory/value'&&method==='GET'){
    const libraryFilter=isAdmin(user)?'':' AND b.library_id=?';
    const binds=isAdmin(user)?[]:[user.library_id];

    const totals=await env.DB.prepare(`
      SELECT
        COUNT(bc.id) AS total_copies,
        COALESCE(SUM(COALESCE(b.price,0)),0) AS total_stock_value,
        COALESCE(SUM(CASE WHEN bc.status='available'
          THEN COALESCE(b.price,0) ELSE 0 END),0) AS available_value,
        COALESCE(SUM(CASE WHEN bc.status='issued'
          THEN COALESCE(b.price,0) ELSE 0 END),0) AS issued_value,
        COALESCE(SUM(CASE WHEN bc.status='damaged'
          THEN COALESCE(b.price,0) ELSE 0 END),0) AS damaged_value,
        COALESCE(SUM(CASE WHEN bc.status='lost'
          THEN COALESCE(b.price,0) ELSE 0 END),0) AS lost_value
      FROM book_copies bc
      JOIN books b ON b.id=bc.book_id
      WHERE 1=1 ${libraryFilter}
    `).bind(...binds).first();

    const byLibrary=await env.DB.prepare(`
      SELECT
        lib.id AS library_id,
        lib.name AS library_name,
        COUNT(bc.id) AS total_copies,
        COALESCE(SUM(COALESCE(b.price,0)),0) AS stock_value
      FROM libraries lib
      LEFT JOIN books b ON b.library_id=lib.id
      LEFT JOIN book_copies bc ON bc.book_id=b.id
      WHERE 1=1 ${isAdmin(user)?'':' AND lib.id=?'}
      GROUP BY lib.id
      ORDER BY lib.name
    `).bind(...(isAdmin(user)?[]:[user.library_id])).all();

    return json({
      totals:totals||{},
      byLibrary:byLibrary.results||[]
    });
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
  if(path==='libraries'&&method==='POST'){
  if(!isAdmin(user))return fail('Only Super Admin can add libraries.',403);

  const d=await bodyJson(request);
  const name=String(d?.name||'').trim();
  const code=String(d?.code||'').trim().toUpperCase();
  const address=String(d?.address||'').trim();

  if(!name||!code)return fail('Library name and code are required.');

  try{
    const result=await env.DB.prepare(
      'INSERT INTO libraries(name,code,address) VALUES(?,?,?)'
    ).bind(name,code,address||null).run();

    await audit(env,user,'create','libraries',result.meta.last_row_id,code);

    return json({ok:true,id:result.meta.last_row_id},201);
  }catch(e){
    return fail('Could not add library. The library name or code may already exist.',409);
  }
}
  if(path==='libraries'&&method==='PATCH'){
    if(!isAdmin(user))return fail('Only Super Admin can rename libraries.',403);const d=await bodyJson(request);if(!d||!Number(d.id)||!String(d.name||'').trim())return fail('Library ID and name are required.');try{await env.DB.prepare('UPDATE libraries SET name=?,code=? WHERE id=?').bind(String(d.name).trim(),String(d.code||'').trim()||`LIB-${String(d.id).padStart(2,'0')}`,Number(d.id)).run();await audit(env,user,'update','libraries',d.id,'');return json({ok:true});}catch{return fail('Could not update library name/code. The name or code may already exist.',409);}
  }
  // Book History - list records visible to the signed-in user
if (path === 'book-history' && method === 'GET') {
  const rows = await env.DB.prepare(`
    SELECT
      h.*,
      b.title,
      b.ser_no,
      l.name AS library_name,
      u.full_name
    FROM book_history h
    LEFT JOIN books b ON b.id = h.book_id
    JOIN libraries l ON l.id = h.library_id
    LEFT JOIN users u ON u.id = h.user_id
    WHERE 1=1
    ${isAdmin(user) ? '' : 'AND h.library_id = ?'}
    ORDER BY h.created_at DESC
    LIMIT 500
  `).bind(
    ...(isAdmin(user) ? [] : [user.library_id])
  ).all();

  return json({ data: rows.results || [] });
}

const match=path.match(/^([a-z_]+)(?:\/(\d+))?$/);if(!match||!TABLES[match[1]])return fail('API route not found.',404);const table=match[1],id=match[2]?Number(match[2]):null,meta=TABLES[table];
  if(method==='GET'){
    const sc=scopeSql(user);let sql=`SELECT * FROM ${table} WHERE 1=1${sc.sql}`;const binds=[...sc.binds];if(url.searchParams.get('q')){const q=`%${url.searchParams.get('q').slice(0,100)}%`;const field=table==='books'?'title':table==='members'?'full_name':'name';sql+=` AND ${field} LIKE ?`;binds.push(q);}sql+=' ORDER BY id DESC LIMIT 1000';const rows=await env.DB.prepare(sql).bind(...binds).all();return json({data:rows.results||[]});
  }
  if(method==='POST'){
    const d=await bodyJson(request);if(!d)return fail('Invalid request.');const row={};for(const f of meta.fields)if(Object.prototype.hasOwnProperty.call(d,f))row[f]=d[f]=== ''?null:d[f];
    if(!isAdmin(user)){if(!meta.scoped)return fail('Forbidden.',403);row.library_id=user.library_id;if(d.library_id&&Number(d.library_id)!==Number(user.library_id))return fail('You cannot add records to another library.',403);}
    if(['books','members','wings','racks'].includes(table)&&!row.library_id)return fail('Library is required.');// RACK VALIDATION AND AUTO CODE
if(table==='racks'){
  if(!row.name || !String(row.name).trim())
    return fail('Rack name is required.');

  if(!row.library_id)
    return fail('Library is required.');

  const library=await env.DB.prepare(
    'SELECT id FROM libraries WHERE id=? AND active=1'
  ).bind(Number(row.library_id)).first();

  if(!library)
    return fail('Please select a valid active library.');

  if(row.wing_id){
    const wing=await env.DB.prepare(
      'SELECT id FROM wings WHERE id=? AND library_id=?'
    ).bind(Number(row.wing_id),Number(row.library_id)).first();

    if(!wing)
      return fail('Selected wing does not belong to this library.');
  } else {
    row.wing_id=null;
  }

  if(!row.code || !String(row.code).trim()){
    const next=await env.DB.prepare(`
      SELECT COALESCE(
        MAX(CAST(SUBSTR(code,6) AS INTEGER)),0
      )+1 AS next_no
      FROM racks
      WHERE code GLOB 'RACK-[0-9]*'
    `).first();

    row.code='RACK-'+String(next?.next_no||1).padStart(3,'0');
  } else {
    row.code=String(row.code).trim().toUpperCase();
  }

  const duplicate=await env.DB.prepare(
    'SELECT id FROM racks WHERE code=?'
  ).bind(row.code).first();

  if(duplicate)
    return fail('This Rack Code already exists. Please use another code.',409);
}if(table==='categories'&&!row.name)return fail('Category name is required.');if(table==='categories'&&!row.code){const prefix=String(row.name||'CAT').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)||'CAT';const n=await env.DB.prepare('SELECT COUNT(*) n FROM categories WHERE code LIKE ?').bind(`${prefix}-%`).first();row.code=`${prefix}-${String(Number(n.n||0)+1).padStart(3,'0')}`;}
    if(table==='books'&&!row.title)return fail('Book title is required.');if(table==='members'){row.member_no=row.member_no||`AQK-${Date.now().toString().slice(-8)}`;row.member_type=row.member_type||'Student';}
    const keys=Object.keys(row);if(!keys.length)return fail('No valid fields provided.');const placeholders=keys.map(()=>'?').join(',');try{const result=await env.DB.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`).bind(...keys.map(k=>row[k])).run();const newId=result.meta.last_row_id;
      if(table==='books'){const count=Math.max(1,Math.min(500,Number(d.copy_count)||1));const prefix=`${String(row.tag_id||row.ser_no||'AQK').replace(/[^A-Za-z0-9-]/g,'').slice(0,24)}-${newId}`;const condition=d.condition||'New';const copyStatus=condition==='Lost'?'lost':condition==='Damaged'?'damaged':condition==='Repair'?'repair':'available';const statements=[];for(let i=1;i<=count;i++)statements.push(env.DB.prepare('INSERT INTO book_copies(book_id,copy_code,status,condition,stock_type) VALUES(?,?,?,?,?)').bind(newId,`${prefix}-C${String(i).padStart(3,'0')}`,copyStatus,condition,d.stock_type||'New'));await env.DB.batch(statements);}
      await audit(env,user,'create',table,newId,'');return json({ok:true,id:newId,row},201);
    }catch(e){return fail('Could not save record. Check required fields and unique codes.',409);}
  }
  if(method==='PATCH'&&id){
  const d=await bodyJson(request);
  if(!d)return fail('Invalid request.');

  const current=await env.DB.prepare(
    `SELECT * FROM ${table} WHERE id=?`
  ).bind(id).first();

  if(!current)return fail('Record not found.',404);
    // RACK EDIT VALIDATION
if(table==='racks'){
  const newLibraryId=Number(d.library_id||current.library_id);
  const newWingId=d.wing_id===undefined
    ? current.wing_id
    : (d.wing_id===''||d.wing_id===null ? null : Number(d.wing_id));

  const library=await env.DB.prepare(
    'SELECT id FROM libraries WHERE id=? AND active=1'
  ).bind(newLibraryId).first();

  if(!library)
    return fail('Please select a valid active library.');

  if(newWingId){
    const wing=await env.DB.prepare(
      'SELECT id FROM wings WHERE id=? AND library_id=?'
    ).bind(newWingId,newLibraryId).first();

    if(!wing)
      return fail('Selected wing does not belong to this library.');
  }

  if(d.code){
    const duplicate=await env.DB.prepare(
      'SELECT id FROM racks WHERE code=? AND id!=?'
    ).bind(String(d.code).trim().toUpperCase(),id).first();

    if(duplicate)
      return fail('This Rack Code is already used by another rack.',409);
  }

  if(d.code) d.code=String(d.code).trim().toUpperCase();
}
  // Prevent moving a book while any of its copies are issued
  if(
    table==='books' &&
    Object.prototype.hasOwnProperty.call(d,'library_id') &&
    Number(d.library_id)!==Number(current.library_id)
  ){
    const issued=await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM loans l
      INNER JOIN book_copies bc ON bc.id=l.copy_id
      WHERE bc.book_id=? AND l.status='issued'
    `).bind(id).first();

    if(Number(issued?.total||0)>0){
      return fail(
        'This book cannot be moved because one or more copies are currently issued. Please return all copies first.',
        409
      );
    }
  }
  if(!isAdmin(user)&&Number(current.library_id)!==Number(user.library_id))
    return fail('Forbidden.',403);

  if(!isAdmin(user)&&Object.prototype.hasOwnProperty.call(d,'library_id')&&Number(d.library_id)!==Number(user.library_id))
    return fail('You cannot move records to another library.',403);

  const keys=meta.fields.filter(f=>Object.prototype.hasOwnProperty.call(d,f));
  if(!keys.length)return fail('No editable fields provided.');

  const vals=keys.map(k=>d[k]===''?null:d[k]);

  try{
    await env.DB.prepare(
      `UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`
    ).bind(...vals,id).run();

    if(table==='books'){
      const newValues={...current};
      keys.forEach((key,index)=>{
        newValues[key]=vals[index];
      });

      await env.DB.prepare(`
        INSERT INTO book_history
        (book_id,library_id,user_id,action,old_values,new_values)
        VALUES(?,?,?,?,?,?)
      `).bind(
        Number(id),
        current.library_id,
        user.id,
        'update',
        JSON.stringify(current),
        JSON.stringify(newValues)
      ).run();
    }

    await audit(env,user,'update',table,id,'');
    return json({ok:true});

  }catch(e){
    console.error('UPDATE ERROR:',e);
    return fail('Could not update record.',409);
  }
}

if(method==='DELETE'&&id){
  const current=await env.DB.prepare(
    `SELECT * FROM ${table} WHERE id=?`
  ).bind(id).first();

  if(!current)return fail('Record not found.',404);

  if(!isAdmin(user)&&(!meta.scoped||Number(current.library_id)!==Number(user.library_id)))
    return fail('You cannot delete records outside your assigned library.',403);

  // PROTECT RACKS CONTAINING INVENTORY OR HISTORY
  if(table==='racks'){
    const copies=await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM book_copies
      WHERE rack_id=?
    `).bind(id).first();

    const books=await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM books
      WHERE rack_id=?
    `).bind(id).first();

    const movements=await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM inventory_movements
      WHERE rack_id=?
    `).bind(id).first();

    const total=
      Number(copies?.total||0)+
      Number(books?.total||0)+
      Number(movements?.total||0);

    if(total>0){
      return fail(
        'This rack cannot be deleted because it contains book stock or inventory history. Move the books to another rack first.',
        409
      );
    }
  }

  await env.DB.prepare(
    `DELETE FROM ${table} WHERE id=?`
  ).bind(id).run();

  await audit(env,user,'delete',table,id,'');

    return json({ok:true});
}

return fail('Method not allowed.',405);
}
export async function onRequest(context) {
  try {
    return await handle(context.request, context.env);
  } catch (e) {
    console.error("AQK API ERROR:", e?.stack || e);
    return json({
      error: String(e?.message || e || "Unknown error")
    }, 500);
  }
}

