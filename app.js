(() => {
  const cfg = window.AQK_CONFIG || {};
  const $ = id => document.getElementById(id);
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let client, currentUser, profile, libraries=[], categories=[], books=[], copies=[], members=[], loans=[];
  const say = (msg, login=false) => { (login ? $('loginMessage') : $('message')).textContent = msg; };
  const ready = () => cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('PASTE_') && !cfg.SUPABASE_ANON_KEY.includes('PASTE_');

  if (!ready()) {
    $('setupNotice').classList.remove('hidden');
    $('setupNotice').innerHTML = '<b>Setup required:</b> add your Supabase Project URL and anon/publishable key in <code>config.js</code>. Read README.md before deployment.';
  } else {
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    client.auth.getSession().then(({data}) => data.session ? startApp(data.session.user) : showLogin());
    client.auth.onAuthStateChange((_event, session) => session ? startApp(session.user) : showLogin());
  }
  function showLogin(){ $('loginPanel').classList.remove('hidden'); $('appPanel').classList.add('hidden'); }
  async function startApp(user){
    currentUser=user;
    const {data:p,error}=await client.from('profiles').select('*').eq('id',user.id).single();
    if(error || !p){ showLogin(); say('Your account has no profile yet. Ask the administrator to assign a role.',true); return; }
    profile=p;
    $('loginPanel').classList.add('hidden'); $('appPanel').classList.remove('hidden');
    $('welcome').textContent=p.full_name || user.email || 'AQK User';
    $('roleLine').textContent=`Role: ${p.role.replace('_',' ')} · ${p.library_id || 'All libraries'}`;
    await loadAll();
  }
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault(); if(!client){say('Complete Supabase setup first.',true);return;}
    const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    say(error ? error.message : 'Signing in…',true);
  });
  $('logoutBtn').addEventListener('click',async()=>{if(client) await client.auth.signOut();});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!==b.dataset.tab));
  }));
  const selectOptions=(el, rows, label, value='id', placeholder='Choose')=>{
    el.innerHTML=`<option value="">${placeholder}</option>`+rows.map(r=>`<option value="${safe(r[value])}">${safe(label(r))}</option>`).join('');
  };
  async function loadAll(){
    const tasks = await Promise.all([
      client.from('libraries').select('*').order('name'),
      client.from('categories').select('*').order('name'),
      client.from('books').select('*, categories(name), libraries(name)').order('title'),
      client.from('book_copies').select('*, books(title, author, price), libraries(name)').order('copy_code'),
      client.from('members').select('*').order('full_name'),
      client.from('loans').select('*, members(full_name), book_copies(copy_code, books(title))').order('created_at',{ascending:false})
    ]);
    const [l,c,b,cp,m,ln]=tasks;
    for(const [name,res] of [['libraries',l],['categories',c],['books',b],['copies',cp],['members',m],['loans',ln]]){
      if(res.error){say(`${name}: ${res.error.message}`);return;}
    }
    [libraries,categories,books,copies,members,loans]=tasks.map(x=>x.data||[]);
    render();
  }
  function render(){
    $('libraryCards').innerHTML=libraries.map(l=>`<div class="libCard"><b>${safe(l.name)}</b><p class="muted small">${safe(l.code||'')}</p></div>`).join('');
    selectOptions($('bookLibrary'),libraries,l=>l.name);
    selectOptions($('memberLibrary'),libraries,l=>l.name);
    selectOptions($('bookCategory'),categories,c=>c.name);
    selectOptions($('loanMember'),members,m=>`${m.full_name} (${m.member_no||m.college_id||m.member_type})`);
    const available=copies.filter(c=>c.status==='available');
    $('loanCopy').innerHTML='<option value="">Choose available copy</option>'+available.map(c=>`<option value="${safe(c.id)}">${safe(c.books?.title)} · ${safe(c.copy_code)} · ${safe(c.libraries?.name||'')}</option>`).join('');
    $('bookRows').innerHTML=books.map(b=>{
      const cp=copies.filter(c=>c.book_id===b.id), av=cp.filter(c=>c.status==='available').length, issued=cp.filter(c=>c.status==='issued').length;
      return `<tr><td><b>${safe(b.title)}</b><div class="muted small">${safe(b.author||'')}</div><div class="muted small">${safe(b.isbn||'')}</div></td><td>${safe(b.libraries?.name||'')}</td><td>${safe(b.categories?.name||'—')}</td><td>${cp.length}</td><td>${av}</td><td>${issued}</td><td><button class="actionBtn" onclick="window.printAQKLabels('${safe(b.id)}')">Print labels</button></td></tr>`;
    }).join('');
    $('memberRows').innerHTML=members.map(m=>`<tr><td>${safe(m.full_name)}</td><td>${safe(m.member_type)}</td><td>${safe(m.college_id||m.member_no||'')}</td><td>${safe(libraries.find(l=>l.id===m.library_id)?.name||'')}</td><td>${safe(m.contact||m.email||'')}</td></tr>`).join('');
    $('loanRows').innerHTML=loans.map(l=>`<tr><td>${safe(l.members?.full_name||'')}</td><td>${safe(l.book_copies?.books?.title||'')}<div class="muted small">${safe(l.book_copies?.copy_code||'')}</div></td><td>${safe(l.issue_date)}</td><td>${safe(l.due_date)}</td><td><span class="badge">${safe(l.status)}</span></td><td>${l.status==='issued'&&profile.role!=='student'?`<button class="actionBtn" onclick="window.returnAQKLoan('${safe(l.id)}','${safe(l.copy_id)}')">Return</button>`:''}</td></tr>`).join('');
    const active=loans.filter(l=>l.status==='issued').length;
    $('stats').innerHTML=[['Libraries',libraries.length],['Book titles',books.length],['Physical copies',copies.length],['Currently issued',active]].map(s=>`<div class="stat"><span class="muted">${s[0]}</span><strong>${s[1]}</strong></div>`).join('');
    $('statusText').textContent=`Signed in as ${profile.role}. Database connected.`;
  }
  $('bookForm').addEventListener('submit',async e=>{
    e.preventDefault(); const f=new FormData(e.currentTarget), count=Math.max(1,Number(f.get('copy_count'))||1);
    const row={title:f.get('title').trim(),author:f.get('author')||null,isbn:f.get('isbn')||null,vendor:f.get('vendor')||null,edition:f.get('edition')||null,pages:Number(f.get('pages'))||null,price:Number(f.get('price'))||0,category_id:f.get('category_id')||null,library_id:f.get('library_id'),wing_name:f.get('wing_name')||null,rack_name:f.get('rack_name')||null,condition:f.get('condition'),stock_type:f.get('stock_type'),description:f.get('description')||null};
    const {data:b,error}=await client.from('books').insert({...row,created_by:currentUser.id}).select().single();
    if(error){say(error.message);return;}
    const prefix=(b.accession_no||('AQK'+b.id.slice(0,6))).toUpperCase();
    const copyRows=Array.from({length:count},(_,i)=>({book_id:b.id,library_id:b.library_id,copy_code:`${prefix}-C${String(i+1).padStart(3,'0')}`,status:row.condition==='Lost'?'lost':'available',condition:row.condition,stock_type:row.stock_type,rack_name:row.rack_name,wing_name:row.wing_name,price:row.price}));
    const {error:copyError}=await client.from('book_copies').insert(copyRows);
    if(copyError){say(`Book saved but copy creation failed: ${copyError.message}. Ask admin to check copy table permissions.`);return;}
    e.currentTarget.reset(); say(`Saved title and generated ${count} unique copy IDs.`); await loadAll();
  });
  $('memberForm').addEventListener('submit',async e=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    const row={full_name:f.get('full_name').trim(),member_type:f.get('member_type'),college_id:f.get('college_id')||null,class_department:f.get('class_department')||null,father_name:f.get('father_name')||null,contact:f.get('contact')||null,email:f.get('email')||null,expiry_date:f.get('expiry_date')||null,library_id:f.get('library_id'),address:f.get('address')||null};
    const {error}=await client.from('members').insert(row);
    if(error){say(error.message);return;} e.currentTarget.reset();say('Member added.');await loadAll();
  });
  $('loanForm').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    const {error}=await client.from('loans').insert({library_id:members.find(m=>m.id===f.get('member_id'))?.library_id,member_id:f.get('member_id'),copy_id:f.get('copy_id'),issue_date:f.get('issue_date'),due_date:f.get('due_date'),status:'issued',issued_by:currentUser.id});
    if(error){say(error.message);return;} e.currentTarget.reset();say('Issue transaction saved.');await loadAll();
  });
  $('refreshBooks').addEventListener('click',loadAll);
  window.returnAQKLoan=async(id,copyId)=>{
    if(!confirm('Mark this book as returned?'))return;
    const {error}=await client.from('loans').update({status:'returned',return_date:new Date().toISOString().slice(0,10),returned_by:currentUser.id}).eq('id',id);
    if(error){say(error.message);return;}
    const {error:ce}=await client.from('book_copies').update({status:'available'}).eq('id',copyId);
    if(ce){say(`Loan returned, but copy status update failed: ${ce.message}`);return;}
    say('Book returned.');await loadAll();
  };
  window.printAQKLabels=async bookId=>{
    const b=books.find(x=>x.id===bookId); const cp=copies.filter(x=>x.book_id===bookId);
    const w=window.open('','_blank'); if(!w){say('Allow pop-ups to print labels.');return;}
    w.document.write(`<!doctype html><html><head><title>AQK Copy Labels</title><style>body{font:12px Arial;margin:10mm}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}.label{border:1px solid #222;padding:8px;min-height:27mm;break-inside:avoid}.code{font-family:monospace;font-size:14px;font-weight:bold;letter-spacing:1px;margin-top:5px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print labels</button><div class="grid">${cp.map(c=>`<div class="label"><b>${safe(b.title)}</b><div>${safe(b.author||'')}</div><div>${safe(c.libraries?.name||'')}</div><div>Rack: ${safe(c.rack_name||'—')}</div><div class="code">${safe(c.copy_code)}</div></div>`).join('')}</div></body></html>`);w.document.close();
  };
})();
