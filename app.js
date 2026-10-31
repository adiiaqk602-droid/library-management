(() => {
  const API = (window.AQK_CONFIG?.API_BASE || '/api').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {user:null,libraries:[],categories:[],wings:[],racks:[],books:[],ebooks:[],members:[],copies:[],loans:[],users:[],settings:{}};
  async function api(path, options={}) {
    const res = await fetch(`${API}/${path}`, {credentials:'same-origin',headers:{'content-type':'application/json',...(options.headers||{})},...options});
    let data={};try{data=await res.json();}catch{}
    if(!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  const message = (text, login=false) => { const el=$(login?'loginMessage':'message'); if(el)el.textContent=text; };
  const setupMessage = text => $('setupMessage').textContent=text;
  const show = id => $(id).classList.remove('hidden'); const hide = id => $(id).classList.add('hidden');
  const isAdmin = () => state.user?.role === 'super_admin';
  const scopedLibraries = () => isAdmin() ? state.libraries : state.libraries.filter(l=>Number(l.id)===Number(state.user?.library_id));
  function setOptions(id, rows, label, placeholder='Choose') { const el=$(id);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${safe(placeholder)}</option>`+rows.map(r=>`<option value="${safe(r.id)}">${safe(label(r))}</option>`).join('');if(rows.some(r=>String(r.id)===old))el.value=old; }
  function lockLibrarySelect(id){const el=$(id);if(!el)return;if(!isAdmin())el.value=String(state.user.library_id);}
  
function fillCategoryParents() {
  const libraryId = $('categoryLibrary').value || '';

  const rows = state.categories.filter(
    c => String(c.library_id ?? '') === libraryId
  );

  setOptions(
    'categoryParent',
    rows,
    c => `${c.name} (${c.code})`,
    'Main Category (No Parent)'
  );
}
function fillSelects(){
    const libs=scopedLibraries();['bookLibrary','memberLibrary','categoryLibrary','wingLibrary','rackLibrary','userLibrary'].forEach(id=>setOptions(id, id==='userLibrary'?state.libraries:libs,l=>l.name));
    ['bookLibrary','memberLibrary','categoryLibrary','wingLibrary','rackLibrary'].forEach(lockLibrarySelect);if(!isAdmin())hide('userLibrary');
  fillCategoryParents();setOptions(
  'categoryLibraryFilter',
  scopedLibraries(),
  l => l.name,
  'All Libraries'
);
$('categoryLibrary').onchange = fillCategoryParents;
    setOptions('bookCategory',state.categories,c=>`${c.name} (${c.code})`,'No category');setOptions('bookWing',state.wings,w=>w.name,'No wing');setOptions('bookRack',state.racks,r=>r.name,'No rack');setOptions('rackWing',state.wings,w=>w.name,'No wing');
setOptions('ebookLibrary',libs,l=>l.name,'Choose library');
lockLibrarySelect('ebookLibrary');
setOptions('ebookCategory',state.categories,c=>`${c.name} (${c.code})`,'No category');
    setOptions('loanMember',state.members,m=>`${m.full_name} · ${m.member_no}`,'Choose member');
    const available=state.copies.filter(c=>c.status==='available'&&state.members.some(m=>Number(m.library_id)===Number(c.library_id)));
    $('loanCopy').innerHTML='<option value="">Choose available copy</option>'+available.map(c=>`<option value="${safe(c.id)}">${safe(c.title)} · ${safe(c.copy_code)} · ${safe(c.library_name)}</option>`).join('');
  }
  function renderCategorySearch() {
  const search = ($('categorySearch')?.value || '').trim().toLowerCase();
  const library = $('categoryLibraryFilter')?.value || '';

  const filtered = state.categories.filter(c => {
    const text = `${c.name || ''} ${c.code || ''} ${c.description || ''}`.toLowerCase();

    const matchesSearch = text.includes(search);
    const matchesLibrary = !library ||
      String(c.library_id ?? '') === library;

    return matchesSearch && matchesLibrary;
  });

  $('categoryRows').innerHTML = filtered.map(c => `
    <tr>
      <td>${safe(c.name)}</td>
      <td>${safe(c.code)}</td>
      <td>${safe(state.categories.find(p => Number(p.id) === Number(c.parent_id))?.name || 'Main Category')}</td>
      <td>${safe(state.libraries.find(l => l.id == c.library_id)?.name || 'All libraries')}</td>
      <td>${safe(c.description || '')}</td>
      <td>
        <button class="actionBtn" onclick="window.editAQKCategory(${Number(c.id)})">Edit</button>
        <button class="actionBtn danger" onclick="window.deleteAQKRecord('categories',${Number(c.id)})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6">No categories found.</td></tr>';
}

function render(){
    fillSelects();
    $('libraryCards').innerHTML=state.libraries.map(l=>`<div class="libCard"><b>${safe(l.name)}</b><p class="muted small">${safe(l.code)}${l.id==state.user.library_id&&!isAdmin()?' · Your assigned library':''}</p></div>`).join('');
    $('libraryTable').innerHTML=`<table><thead><tr><th>Library</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.libraries.map(l=>`<tr><td>${safe(l.name)}</td><td>${safe(l.code)}</td><td>${l.active?'Active':'Inactive'}</td><td>${isAdmin()?`<button class="actionBtn" onclick="window.editAQKLibrary(${Number(l.id)})">Rename</button>`:'—'}</td></tr>`).join('')}</tbody></table>`;
    $('bookRows').innerHTML=state.books.map(b=>{const cp=state.copies.filter(c=>Number(c.book_id)===Number(b.id));return `<tr><td>${safe(b.ser_no||'—')}<br><b>${safe(b.title)}</b><div class="muted small">Tag: ${safe(b.tag_id||'—')}</div></td><td>${safe(b.author||'—')}</td><td>${safe(state.libraries.find(l=>l.id==b.library_id)?.name||'')}</td><td>${safe(state.categories.find(c=>c.id==b.category_id)?.name||'—')}</td><td>${cp.length}</td><td>${cp.filter(c=>c.status==='available').length}</td><td>${cp.filter(c=>c.status==='issued').length}</td><td><button class="actionBtn" onclick="window.editAQKBook(${Number(b.id)})">Edit</button> <button class="actionBtn" onclick="window.printAQKLabels(${Number(b.id)})">Print IDs</button></td></tr>`}).join('')||'<tr><td colspan="8">No books entered yet.</td></tr>';

renderCategorySearch();

$('wingRows').innerHTML = state.wings.map(w => `
  <tr>
    <td>${safe(w.name)}</td>
    <td>${safe(state.libraries.find(l => l.id == w.library_id)?.name || '')}</td>
    <td>${safe(w.description || '')}</td>
  </tr>
`).join('') || '<tr><td colspan="3">No wings yet.</td></tr>';    $('rackRows').innerHTML=state.racks.map(r=>`<tr><td>${safe(r.name)}</td><td>${safe(r.code||'')}</td><td>${safe(state.libraries.find(l=>l.id==r.library_id)?.name||'')}</td><td>${safe(state.wings.find(w=>w.id==r.wing_id)?.name||'')}</td></tr>`).join('')||'<tr><td colspan="4">No racks yet.</td></tr>';
    $('memberRows').innerHTML=state.members.map(m=>`<tr><td>${safe(m.member_no)}</td><td>${safe(m.full_name)}</td><td>${safe(m.member_type)}</td><td>${safe(m.college_id||'')}</td><td>${safe(state.libraries.find(l=>l.id==m.library_id)?.name||'')}</td><td>${safe(m.contact||m.email||'')}</td></tr>`).join('')||'<tr><td colspan="6">No members yet.</td></tr>';
    $('copyRows').innerHTML=state.copies.map(c=>`<tr><td>${safe(c.copy_code)}</td><td>${safe(c.title)}</td><td>${safe(c.library_name)}</td><td>${safe(c.stock_type)}</td><td>${safe(c.condition)}</td><td><span class="badge">${safe(c.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">No inventory yet.</td></tr>';
    $('loanRows').innerHTML=state.loans.map(l=>{const overdue=l.status==='issued'&&l.due_date<new Date().toISOString().slice(0,10);return `<tr><td>${safe(l.full_name)}<div class="muted small">${safe(l.member_no)}</div></td><td>${safe(l.title)}<div class="muted small">${safe(l.copy_code)}</div></td><td>${safe(l.library_name)}</td><td>${safe(l.issue_date)}</td><td>${safe(l.due_date)}${overdue?' <span class="badge">Overdue</span>':''}</td><td>${safe(l.return_date||'—')}</td><td>${Number(l.fine_amount||0).toFixed(2)}${Number(l.fine_paid||0)>0?` (paid ${Number(l.fine_paid).toFixed(2)})`:''}</td><td>${safe(l.status)} ${l.status==='issued'?`<button class="actionBtn" onclick="window.returnAQKLoan(${Number(l.id)})">Return</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="8">No issue records yet.</td></tr>';
    const r=state.report||{stats:{}};const stats=r.stats||{};
    $('stats').innerHTML=[['Libraries',state.libraries.length],['Book titles',stats.books??state.books.length],['Physical copies',stats.copies??state.copies.length],['Members',stats.members??state.members.length],['Issued',stats.issued??state.loans.filter(l=>l.status==='issued').length],['Overdue',stats.overdue??0],['Outstanding fine',`Rs. ${Number(stats.outstandingFine||0).toFixed(2)}`]].map(x=>`<div class="stat"><span class="muted">${safe(x[0])}</span><strong>${safe(x[1])}</strong></div>`).join('');
    $('reportStats').innerHTML=$('stats').innerHTML;
const reportRows = (items, makeRow, cols) =>
  (items || []).length
    ? items.map(makeRow).join('')
    : `<tr><td colspan="${cols}">No record found</td></tr>`;

const reportMoney = v =>
  'Rs. ' + Number(v || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

// Existing reports
$('categoryReportRows').innerHTML = reportRows(
  r.byCategory,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.total)}</td></tr>`,
  2
);

$('libraryReportRows').innerHTML = reportRows(
  r.byLibrary,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.total)}</td></tr>`,
  2
);

$('inventoryReportRows').innerHTML = reportRows(
  r.inventory,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.status)}</td><td>${safe(x.total)}</td></tr>`,
  3
);

// 1. Category-wise Stock Value
$('categoryValueRows').innerHTML = reportRows(
  r.byCategoryValue,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.titles)}</td><td>${safe(x.copies)}</td><td>${reportMoney(x.stock_value)}</td></tr>`,
  4
);

// 2. Category-wise Location
$('categoryLocationRows').innerHTML = reportRows(
  r.byCategoryLocation,
  x => `<tr><td>${safe(x.category)}</td><td>${safe(x.library)}</td><td>${safe(x.wing)}</td><td>${safe(x.rack)}</td><td>${safe(x.titles)}</td><td>${safe(x.copies)}</td></tr>`,
  6
);

// 3. Category-wise Issue Report
$('categoryIssueRows').innerHTML = reportRows(
  r.byCategoryIssues,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.total_issues)}</td><td>${safe(x.currently_issued)}</td><td>${safe(x.returned)}</td><td>${safe(x.overdue)}</td></tr>`,
  5
);

// 4. Most Issued Categories
$('mostIssuedRows').innerHTML = reportRows(
  r.mostIssuedCategories,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.total_issues)}</td></tr>`,
  2
);

// 5. Least Issued Categories
$('leastIssuedRows').innerHTML = reportRows(
  r.leastIssuedCategories,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.total_issues)}</td></tr>`,
  2
);

// 6. Academic Year-wise Books
$('academicYearRows').innerHTML = reportRows(
  r.byAcademicYear,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.titles)}</td><td>${safe(x.copies)}</td></tr>`,
  3
);

// 7. New / Old / Donate Books
$('stockTypeRows').innerHTML = reportRows(
  r.byStockType,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.status)}</td><td>${safe(x.total)}</td><td>${reportMoney(x.stock_value)}</td></tr>`,
  4
);

// 8. Library-wise Stock Value
$('libraryValueRows').innerHTML = reportRows(
  r.byLibraryValue,
  x => `<tr><td>${safe(x.label)}</td><td>${safe(x.titles)}</td><td>${safe(x.copies)}</td><td>${reportMoney(x.stock_value)}</td></tr>`,
  4
);

// 9. Rack-wise Book Report
$('rackReportRows').innerHTML = reportRows(
  r.byRack,
  x => `<tr><td>${safe(x.library)}</td><td>${safe(x.wing)}</td><td>${safe(x.rack)}</td><td>${safe(x.titles)}</td><td>${safe(x.copies)}</td><td>${safe(x.available)}</td><td>${safe(x.issued)}</td><td>${reportMoney(x.stock_value)}</td></tr>`,
  8
);

// 10. Monthly Issue & Return Report
$('monthlyRows').innerHTML = reportRows(
  r.monthlyIssuesReturns,
  x => `<tr><td>${safe(x.month)}</td><td>${safe(x.issued)}</td><td>${safe(x.returned)}</td></tr>`,
  3
);    $('statusText').textContent=`Connected to Cloudflare D1 · Signed in as ${state.user.role.replace('_',' ')}.`;
    document.querySelectorAll('[data-admin-only]').forEach(el=>el.classList.toggle('hidden',!isAdmin()));hide('setupPanel');hide('loginPanel');show('appPanel');
    if(isAdmin()){show('fineSettings');$('userRows').innerHTML=state.users.map(u=>`<tr><td>${safe(u.full_name)}</td><td>${safe(u.email)}</td><td>${safe(u.role)}</td><td>${safe(state.libraries.find(l=>l.id==u.library_id)?.name||'All libraries')}</td><td>${u.active?'Active':'Disabled'}</td><td>${u.role==='librarian'?`<button class="actionBtn" onclick="window.toggleAQKUser(${Number(u.id)},${u.active?0:1})">${u.active?'Disable':'Enable'}</button>`:''}</td></tr>`).join('');}else hide('fineSettings');
  }
  async function refresh(){
    const [libs,cats,wings,racks,books,members,copies,loans,report,settings]=await Promise.all(['libraries','categories','wings','racks','books','members','copies','loans','reports','settings'].map(p=>api(p).catch(e=>({error:e.message,data:[]}))));
    for(const [name,res] of [['libraries',libs],['categories',cats],['wings',wings],['racks',racks],['books',books],['members',members],['copies',copies],['loans',loans]])if(res.error)throw new Error(`${name}: ${res.error}`);
    state.libraries=libs.data||[];state.categories=cats.data||[];state.wings=wings.data||[];state.racks=racks.data||[];state.books=books.data||[];state.members=members.data||[];state.copies=copies.data||[];state.loans=loans.data||[];state.report=report;state.settings=Object.fromEntries((settings.data||[]).map(x=>[x.key,x.value]));
    if(isAdmin())state.users=(await api('users')).data||[];
    render();
    if(isAdmin())for(const [key,el] of Object.entries({fine_per_day:'fine_per_day',damaged_fine_percent:'damaged_fine_percent',lost_book_extra_fine:'lost_book_extra_fine',loan_days:'loan_days'}))if($(el))$(el).value=state.settings[key]??'';
  }
  async function init(){
    try{const health=await api('health');const status=await api('setup-status');if(status.setupRequired){show('setupPanel');hide('loginPanel');hide('appPanel');return;}try{const me=await api('me');state.user=me.user;await refresh();}catch{show('loginPanel');hide('appPanel');} }catch(e){show('setupNotice');$('setupNotice').textContent=`Server setup incomplete: ${e.message}. Follow README.md to configure the Cloudflare D1 binding and run migration 0001_initial.sql.`;show('loginPanel');}
  }
  $('setupForm').addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));try{const r=await api('setup',{method:'POST',body:JSON.stringify(f)});setupMessage(r.message);e.currentTarget.reset();hide('setupPanel');show('loginPanel');}catch(err){setupMessage(err.message);}});
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{const result=await api('login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});state.user=result.user;message('Signed in.',true);await refresh();}catch(err){message(err.message,true);}});
  $('logoutBtn').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:'{}'});}finally{state.user=null;hide('appPanel');show('loginPanel');$('password').value='';}});
  $('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!==b.dataset.tab));});
  $('categorySearch')?.addEventListener('input', renderCategorySearch);
$('categoryLibraryFilter')?.addEventListener('change', renderCategorySearch);document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click',()=>refresh().catch(e=>message(e.message))));
  function formPayload(form){const d=Object.fromEntries(new FormData(form));for(const k of Object.keys(d))if(d[k]==='')d[k]=null;return d;}
  async function submitForm(id,endpoint,success,transform){$(id).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;let data=formPayload(form);if(transform)data=transform(data);try{await api(endpoint,{method:'POST',body:JSON.stringify(data)});form.reset();message(success);await refresh();}catch(err){message(err.message);}});}
  submitForm('bookForm','books','Book saved and physical copy IDs generated.',d=>({...d,price:Number(d.price||0),pages:d.pages?Number(d.pages):null,copy_count:Number(d.copy_count||1)}));
  submitForm('categoryForm','categories','Category saved.');submitForm('wingForm','wings','Management wing saved.');submitForm('rackForm','racks','Rack saved.');
  submitForm('memberForm','members','Membership record saved.');
  submitForm('loanForm','issue','Book issued successfully.',d=>d);
  submitForm('userForm','users','Librarian account created.');
  $('settingsForm').addEventListener('submit',async e=>{e.preventDefault();const d=formPayload(e.currentTarget);try{for(const [key,value] of Object.entries(d))await api('settings',{method:'POST',body:JSON.stringify({key,value:Number(value)})});message('Fine settings saved.');await refresh();}catch(err){message(err.message);}});
  $('printReports').addEventListener('click',()=>window.print());
  window.editAQKLibrary=async id=>{const l=state.libraries.find(x=>Number(x.id)===Number(id));if(!l||!isAdmin())return;const name=prompt('Library name:',l.name);if(name===null)return;const code=prompt('Library code:',l.code);if(code===null)return;try{await api('libraries',{method:'PATCH',body:JSON.stringify({id,name:name.trim(),code:code.trim()})});message('Library name updated.');await refresh();}catch(e){message(e.message);}};
  window.editAQKBook=async id=>{const b=state.books.find(x=>Number(x.id)===Number(id));if(!b)return;const title=prompt('Book title:',b.title);if(title===null)return;const author=prompt('Author:',b.author||'');if(author===null)return;const price=prompt('Price in Rs.:',b.price||0);if(price===null)return;const vendor=prompt('Vendor / Publisher:',b.vendor||'');if(vendor===null)return;const edition=prompt('Edition:',b.edition||'');if(edition===null)return;const tag_id=prompt('Tag ID:',b.tag_id||'');if(tag_id===null)return;try{await api(`books/${id}`,{method:'PATCH',body:JSON.stringify({title:title.trim(),author:author||null,price:Number(price)||0,vendor:vendor||null,edition:edition||null,tag_id:tag_id||null})});message('Book record updated.');await refresh();}catch(e){message(e.message);}};
window.editAQKCategory=async id=>{
  const c=state.categories.find(x=>Number(x.id)===Number(id));
  if(!c)return;

  const name=prompt('Category name:',c.name);
  if(name===null)return;

  const description=prompt('Description:',c.description||'');
  if(description===null)return;

  const code=prompt('Category code:',c.code);
  if(code===null)return;

  const possibleParents=state.categories.filter(x=>
    Number(x.library_id??0)===Number(c.library_id??0)&&
    Number(x.id)!==Number(c.id)
  );

  const parentChoices=[
    '0 = Main Category (No Parent)',
    ...possibleParents.map(x=>`${x.id} = ${x.name}`)
  ].join('\n');

  const parentInput=prompt(
    `Parent Category ID:\n${parentChoices}`,
    c.parent_id||'0'
  );

  if(parentInput===null)return;

  const parent_id=parentInput.trim()===''||parentInput.trim()==='0'
    ?null:Number(parentInput);

  if(parent_id!==null&&!possibleParents.some(x=>Number(x.id)===parent_id)){
    message('Invalid parent category ID.');
    return;
  }

  try{
    await api(`categories/${id}`,{
      method:'PATCH',
      body:JSON.stringify({
        name:name.trim(),
        description,
        code:code.trim(),
        parent_id
      })
    });

    message('Category updated.');
    await refresh();
  }catch(e){
    message(e.message);
  }
};  window.deleteAQKRecord=async(table,id)=>{if(!confirm('Delete this category? This cannot be undone.'))return;try{await api(`${table}/${id}`,{method:'DELETE'});message('Record deleted.');await refresh();}catch(e){message(e.message);}};
  window.returnAQKLoan=async id=>{const disposition=prompt('Return condition: type returned, damaged, or lost','returned');if(disposition===null)return;if(!['returned','damaged','lost'].includes(disposition.toLowerCase())){message('Use returned, damaged, or lost.');return;}const return_date=new Date().toISOString().slice(0,10);try{const r=await api('return',{method:'POST',body:JSON.stringify({id,disposition:disposition.toLowerCase(),return_date})});message(`Return saved. Fine calculated: Rs. ${Number(r.fine||0).toFixed(2)} (${r.lateDays} late days).`);await refresh();}catch(e){message(e.message);}};
  window.toggleAQKUser=async(id,active)=>{if(!confirm(`${active?'Enable':'Disable'} this librarian account?`))return;try{await api('users',{method:'PATCH',body:JSON.stringify({id,active})});await refresh();message('User account updated.');}catch(e){message(e.message);}};

window.printAQKLabels = id => {
  const b = state.books.find(x => Number(x.id) === Number(id));
  if (!b) {
    message('Book record not found.');
    return;
  }

  const copies = state.copies.filter(
    c => Number(c.book_id) === Number(id)
  );

  const library = state.libraries.find(
    x => Number(x.id) === Number(b.library_id)
  );

  const category = state.categories.find(
    x => Number(x.id) === Number(b.category_id)
  );

  const wing = state.wings.find(
    x => Number(x.id) === Number(b.wing_id)
  );

  const rack = state.racks.find(
    x => Number(x.id) === Number(b.rack_id)
  );

  const w = window.open('', '_blank');

  if (!w) {
    message('Allow pop-ups to print labels.');
    return;
  }

  const details = [
    ['Serial No', b.ser_no],
    ['Accession No', b.accession_no],
    ['Entry Date', b.entry_date || b.date],
    ['Book Title', b.title],
    ['Author', b.author],
    ['Category', category?.name],
    ['Price', b.price != null ? 'Rs. ' + b.price : ''],
    ['Vendor / Publisher', b.vendor],
    ['Pages', b.pages],
    ['Edition', b.edition],
    ['Tag ID', b.tag_id],
    ['Library', library?.name],
    ['Wing', wing?.name],
    ['Rack', rack?.name]
  ];

  const rows = details.map(([label, value]) => `
    <tr>
      <th>${safe(label)}</th>
      <td>${safe(value || '—')}</td>
    </tr>
  `).join('');

  const labels = copies.length
    ? copies.map(c => `
        <div class="label">
          <h3>Dr A Q Khan School &amp; College</h3>
          <h4>${safe(b.title)}</h4>
          <p><b>Accession No:</b> ${safe(b.accession_no || b.ser_no || '—')}</p>
          <div class="code">${safe(c.copy_code)}</div>
          <p>${safe(c.library_name || library?.name || '—')}</p>
          <p><b>Category:</b> ${safe(category?.name || '—')}</p>
          <p><b>Rack:</b> ${safe(rack?.name || '—')}</p>
        </div>
      `).join('')
    : '<p>No physical copies found for this book.</p>';

  w.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AQK Book Details & Labels</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 15mm;
          color: #111;
        }

        h1, h2 {
          text-align: center;
          margin: 5px 0;
        }

        .school {
          text-align: center;
          font-size: 14px;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }

        th, td {
          border: 1px solid #333;
          padding: 9px;
          text-align: left;
        }

        th {
          width: 30%;
          background: #e8edf5;
        }

        .labelHeading {
          margin-top: 30px;
          border-bottom: 2px solid #222;
          padding-bottom: 8px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8mm;
          margin-top: 15px;
        }

        .label {
          border: 2px solid #222;
          padding: 10px;
          text-align: center;
          break-inside: avoid;
        }

        .label h3 {
          font-size: 13px;
          margin: 3px;
        }

        .label h4 {
          font-size: 15px;
          margin: 8px 0;
        }

        .label p {
          font-size: 11px;
          margin: 5px;
        }

        .code {
          font-family: monospace;
          font-weight: bold;
          font-size: 18px;
          border: 1px solid #333;
          padding: 7px;
          margin: 8px 0;
        }

        @media print {
          body { margin: 10mm; }
          .label { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>Dr A Q Khan School &amp; College</h1>
      <div class="school">AQK Library Management System</div>

      <h2>Complete Book Details</h2>

      <table>
        <tbody>${rows}</tbody>
      </table>

      <h2 class="labelHeading">AQK Book Labels</h2>

      <div class="grid">${labels}</div>

      <script>
        window.onload = () => window.print();
      <\/script>
    </body>
    </html>
  `);

  w.document.close();
};
  
  // AQK E-Books module
  async function loadEbooks() {
    const rows = $('ebookRows');
    try {
      const result = await api('ebooks');
      state.ebooks = result.data || [];
      const q = ($('ebookSearch').value || '').trim().toLowerCase();
      const filtered = state.ebooks.filter(b =>
        `${b.title || ''} ${b.author || ''}`.toLowerCase().includes(q)
      );

      rows.innerHTML = filtered.map(b => {
        const lib = state.libraries.find(l => Number(l.id) === Number(b.library_id));
        return `<tr>
          <td><b>${safe(b.title)}</b></td>
          <td>${safe(b.author || '—')}</td>
          <td>${safe(b.library_name || lib?.name || '—')}</td>
          <td>${(Number(b.file_size || 0) / 1048576).toFixed(2)} MB</td>
          <td><button type="button" class="actionBtn"
            data-open-ebook="${Number(b.id)}">Read PDF</button></td>
        </tr>`;
      }).join('') || '<tr><td colspan="5">No E-Books found.</td></tr>';

      $('ebookMessage').textContent = '';
    } catch (err) {
      rows.innerHTML = '<tr><td colspan="5">Could not load E-Books.</td></tr>';
      $('ebookMessage').textContent = err.message;
    }
  }

  if ($('ebookForm')) {
    if (isAdmin()) hide('ebookUploadPanel');

    $('ebookForm').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const file = form.elements.file.files[0];

      if (!file) {
        $('ebookMessage').textContent = 'Please select a PDF file.';
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        $('ebookMessage').textContent = 'PDF must be 25 MB or smaller.';
        return;
      }
      if (file.type && file.type !== 'application/pdf') {
        $('ebookMessage').textContent = 'Please select a PDF file only.';
        return;
      }

      const payload = new FormData(form);
      $('ebookMessage').textContent = 'Uploading PDF…';

      try {
        const response = await fetch(`${API}/ebooks`, {
          method: 'POST',
          credentials: 'same-origin',
          body: payload
        });
        let result = {};
        try { result = await response.json(); } catch {}
        if (!response.ok) {
          throw new Error(result.error || `Upload failed (${response.status})`);
        }

        form.reset();
        $('ebookMessage').textContent = 'PDF uploaded successfully.';
        await loadEbooks();
      } catch (err) {
        $('ebookMessage').textContent = err.message;
      }
    });

    $('refreshEbooks').addEventListener('click', loadEbooks);
    $('ebookSearch').addEventListener('input', () => {
      const q = $('ebookSearch').value.trim().toLowerCase();
      const filtered = state.ebooks.filter(b =>
        `${b.title || ''} ${b.author || ''}`.toLowerCase().includes(q)
      );
      $('ebookRows').innerHTML = filtered.map(b => {
        const lib = state.libraries.find(l => Number(l.id) === Number(b.library_id));
        return `<tr>
          <td><b>${safe(b.title)}</b></td>
          <td>${safe(b.author || '—')}</td>
          <td>${safe(b.library_name || lib?.name || '—')}</td>
          <td>${(Number(b.file_size || 0) / 1048576).toFixed(2)} MB</td>
          <td><button type="button" class="actionBtn"
            data-open-ebook="${Number(b.id)}">Read PDF</button></td>
        </tr>`;
      }).join('') || '<tr><td colspan="5">No E-Books found.</td></tr>';
    });

    $('ebookRows').addEventListener('click', e => {
      const btn = e.target.closest('[data-open-ebook]');
      if (!btn) return;
      const book = state.ebooks.find(b => Number(b.id) === Number(btn.dataset.openEbook));
      if (!book) return;

      $('ebookReaderTitle').textContent = book.title || 'PDF Reader';
      $('ebookPdfFrame').src = `${API}/ebooks/${Number(book.id)}/file`;
      show('ebookReader');
    });

    $('closeEbookReader').addEventListener('click', () => {
      $('ebookPdfFrame').src = 'about:blank';
      hide('ebookReader');
    });
  }
  $('bookForm').elements.entry_date.value=new Date().toISOString().slice(0,10);
  $('loanForm').elements.issue_date.value=new Date().toISOString().slice(0,10);
  $('loanForm').elements.due_date.value=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  init();
})();
