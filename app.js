(() => {
  const API = (window.AQK_CONFIG?.API_BASE || '/api').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {user:null,libraries:[],categories:[],wings:[],racks:[],books:[],ebooks:[],members:[],copies:[],loans:[],users:[],settings:{}};
  window.AQK_STOCK_CHECK = () => {
  console.log('TOTAL BOOKS:', state.books.length);
  console.log('TOTAL COPIES:', state.copies.length);

  console.table(state.books.map(b => {
    const cp = state.copies.filter(c =>
      Number(c.book_id) === Number(b.id)
    );

    const available = cp.filter(c =>
      String(c.status || '').trim().toLowerCase() === 'available'
    ).length;

    return {
      title: b.title,
      book_id: b.id,
      total_copies: cp.length,
      available: available,
      statuses: cp.map(c => c.status).join(', ')
    };
  }));
};
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
  setOptions('bookFilterLibrary', scopedLibraries(), l => l.name, 'All Libraries');
setOptions('bookFilterCategory', state.categories, c => `${c.name} (${c.code})`, 'All Categories');
$('categoryLibrary').onchange = fillCategoryParents;
    setOptions('bookCategory',state.categories,c=>`${c.name} (${c.code})`,'No category');setOptions('bookWing',state.wings,w=>w.name,'No wing');setOptions('bookRack',state.racks,r=>r.name,'No rack');setOptions('rackWing',state.wings,w=>w.name,'No wing');
  setOptions(
  'rackBooksSelect',
  state.racks.filter(r =>
    scopedLibraries().some(l => Number(l.id) === Number(r.library_id))
  ),
  r => `${r.name} · ${r.rack_number || r.code || ''}`,
  'Choose Rack'
);
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
function renderLibraryInventory() {
  const libraries = scopedLibraries();

  const copies = state.copies.filter(c =>
    libraries.some(l => Number(l.id) === Number(c.library_id))
  );

  const total = copies.length;
  const available = copies.filter(c =>
    String(c.status).toLowerCase() === 'available'
  ).length;
  const issued = copies.filter(c =>
    String(c.status).toLowerCase() === 'issued'
  ).length;
  const damaged = copies.filter(c =>
  String(c.status).toLowerCase() === 'damaged'
).length;
    const lost = copies.filter(c =>
    String(c.status).toLowerCase() === 'lost'
  ).length;

  const stockCount = type => copies.filter(c =>
    String(c.stock_type || '').trim().toLowerCase() === type
  ).length;

  $('inventorySummaryStats').innerHTML = [
    ['Total Copies', total],
    ['New Books', stockCount('new')],
    ['Old Books', stockCount('old')],
    ['Donate Books', stockCount('donate')],
    ['Available', available],
    ['Issued', issued],
    ['Damaged', damaged],
    ['Lost', lost]
  ].map(([label, count]) => `
    <div class="stat">
      <span class="muted">${safe(label)}</span>
      <strong>${count}</strong>
    </div>
  `).join('');

  $('libraryInventoryRows').innerHTML = libraries.map(library => {
    const rows = copies.filter(c =>
      Number(c.library_id) === Number(library.id)
    );

    const count = type => rows.filter(c =>
      String(c.stock_type || '').trim().toLowerCase() === type
    ).length;

    const availableCount = rows.filter(c =>
      String(c.status).toLowerCase() === 'available'
    ).length;

    const issuedCount = rows.filter(c =>
      String(c.status).toLowerCase() === 'issued'
    ).length;
    const damagedCount = rows.filter(c =>
  String(c.status).toLowerCase() === 'damaged'
).length;
    const lostCount = rows.filter(c =>
  String(c.status).toLowerCase() === 'lost'
).length;

    return `
      <tr>
        <td>${safe(library.name)}</td>
        <td>${rows.length}</td>
        <td>${count('new')}</td>
        <td>${count('old')}</td>
        <td>${count('donate')}</td>
        <td>${availableCount}</td>
        <td>${issuedCount}</td>
        <td>${damagedCount}</td>
        <td>${lostCount}</td>
      </tr>
    `;
 }).join('') || '<tr><td colspan="8">No inventory found.</td></tr>';
}

// AQK MEMBERS: Search, Filters, Pagination and Printing

let memberCurrentPage = 1;
let memberControlsBound = false;

function renderAQKMembers() {
  const search = ($('memberSearch')?.value || '').trim().toLowerCase();
  const type = $('memberTypeFilter')?.value || '';
  const libraryId = $('memberLibraryFilter')?.value || '';
  const pageSize = Number($('memberPageSize')?.value || 10);

  const filtered = (state.members || []).filter(m => {
    const libraryName = state.libraries.find(
      l => Number(l.id) === Number(m.library_id)
    )?.name || '';

    const matchesSearch = [
      m.member_no, m.full_name, m.college_id,
      m.contact, m.email, libraryName
    ].some(v => String(v || '').toLowerCase().includes(search));

    return matchesSearch &&
      (!type || m.member_type === type) &&
      (!libraryId || Number(m.library_id) === Number(libraryId));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  memberCurrentPage = Math.min(memberCurrentPage, totalPages);

  const start = (memberCurrentPage - 1) * pageSize;
  const pageMembers = filtered.slice(start, start + pageSize);

  $('memberRows').innerHTML = pageMembers.map(m => `
    <tr>
      <td>
        <input type="checkbox" class="memberSelectCheckbox"
          value="${Number(m.id)}">
      </td>
      <td>${safe(m.member_no)}</td>
      <td>${safe(m.full_name)}</td>
      <td>${safe(m.member_type)}</td>
      <td>${safe(m.college_id || '')}</td>
      <td>${safe(state.libraries.find(
        l => Number(l.id) === Number(m.library_id)
      )?.name || '')}</td>
      <td>${safe(m.contact || m.email || '')}</td>
      <td>
        <button class="actionBtn"
          onclick="window.viewAQKMember(${Number(m.id)})">View</button>
        <button class="actionBtn"
          onclick="window.editAQKMember(${Number(m.id)})">Edit</button>
        ${isAdmin() ? `
          <button class="actionBtn danger"
            onclick="window.deleteAQKRecord('members',${Number(m.id)})">
            Delete
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8">No members found.</td></tr>';

  $('memberCountInfo').textContent =
    `Showing ${filtered.length ? start + 1 : 0}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length} members`;

  $('memberPagination').innerHTML = `
    <button type="button" class="secondary"
      ${memberCurrentPage <= 1 ? 'disabled' : ''}
      onclick="window.changeAQKMemberPage(${memberCurrentPage - 1})">
      Previous
    </button>
    <span>Page ${memberCurrentPage} of ${totalPages}</span>
    <button type="button" class="secondary"
      ${memberCurrentPage >= totalPages ? 'disabled' : ''}
      onclick="window.changeAQKMemberPage(${memberCurrentPage + 1})">
      Next
    </button>
  `;

  const libraryFilter = $('memberLibraryFilter');
  if (libraryFilter && libraryFilter.options.length <= 1) {
    state.libraries.forEach(l => {
      libraryFilter.add(new Option(l.name, l.id));
    });
  }

  if (!memberControlsBound) {
    memberControlsBound = true;

    ['memberSearch', 'memberTypeFilter',
     'memberLibraryFilter', 'memberPageSize'].forEach(id => {
      $(id)?.addEventListener(
        id === 'memberSearch' ? 'input' : 'change',
        () => {
          memberCurrentPage = 1;
          renderAQKMembers();
        }
      );
    });

    $('memberSelectAll')?.addEventListener('change', e => {
      document.querySelectorAll('.memberSelectCheckbox')
        .forEach(box => box.checked = e.target.checked);
    });

    $('closeMemberView')?.addEventListener('click', () => {
      $('memberViewPanel').classList.add('hidden');
    });

    $('printSelectedMembers')?.addEventListener('click', () => {
      const ids = [...document.querySelectorAll(
        '.memberSelectCheckbox:checked'
      )].map(box => Number(box.value));

      printAQKMembers(
        state.members.filter(m => ids.includes(Number(m.id))),
        'Selected Members Register'
      );
    });

    $('printFilteredMembers')?.addEventListener('click', () => {
  const search = ($('memberSearch')?.value || '').trim().toLowerCase();
  const type = $('memberTypeFilter')?.value || '';
  const libraryId = $('memberLibraryFilter')?.value || '';

  const filteredMembers = state.members.filter(m => {
    const libraryName = state.libraries.find(
      l => Number(l.id) === Number(m.library_id)
    )?.name || '';

    const matchesSearch = [
      m.member_no, m.full_name, m.college_id,
      m.contact, m.email, libraryName
    ].some(v => String(v || '').toLowerCase().includes(search));

    return matchesSearch &&
      (!type || m.member_type === type) &&
      (!libraryId || Number(m.library_id) === Number(libraryId));
  });

  printAQKMembers(filteredMembers, 'Filtered Members Register');
});

    $('printAllMembers')?.addEventListener('click', () => {
      printAQKMembers(state.members, 'Complete Members Register');
    });
  }
}

window.changeAQKMemberPage = page => {
  memberCurrentPage = page;
  renderAQKMembers();
};

window.viewAQKMember = id => {
  const m = state.members.find(x => Number(x.id) === Number(id));
  if (!m) return;

  const library = state.libraries.find(
    l => Number(l.id) === Number(m.library_id)
  )?.name || '';

  const fields = [
    ['Member No.', m.member_no],
    ['Full Name', m.full_name],
    ['Member Type', m.member_type],
    ['Student / College ID', m.college_id],
    ['Class / Department', m.class_department],
    ['Father / Guardian', m.father_name],
    ['Contact', m.contact],
    ['Email', m.email],
    ['Library', library],
    ['Membership Expiry', m.expiry_date],
    ['Address', m.address]
  ];

  $('memberViewContent').innerHTML = `
    <div class="tableWrap">
      <table>
        <tbody>
          ${fields.map(([label, value]) => `
            <tr>
              <th>${safe(label)}</th>
              <td>${safe(value || '—')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('memberViewPanel').classList.remove('hidden');
  $('memberViewPanel').scrollIntoView({ behavior: 'smooth' });
};

function printAQKMembers(members, title) {
  if (!members.length) {
    alert('No members available to print.');
    return;
  }

  const rows = members.map(m => {
    const library = state.libraries.find(
      l => Number(l.id) === Number(m.library_id)
    )?.name || '';

    return `
      <tr>
        <td>${safe(m.member_no)}</td>
        <td>${safe(m.full_name)}</td>
        <td>${safe(m.member_type)}</td>
        <td>${safe(m.college_id || '')}</td>
        <td>${safe(library)}</td>
        <td>${safe(m.contact || '')}</td>
        <td>${safe(m.email || '')}</td>
      </tr>
    `;
  }).join('');

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to print the register.');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${safe(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 25px; }
        h2, h3, p { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #333; padding: 7px; text-align: left; }
        th { background: #eee; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h2>Dr A Q Khan School & College</h2>
      <h3>BS Library</h3>
      <h3>${safe(title)}</h3>
      <p>Total Members: ${members.length}</p>
      <table>
        <thead>
          <tr>
            <th>Member No.</th>
            <th>Name</th>
            <th>Type</th>
            <th>Roll / ID</th>
            <th>Library</th>
            <th>Contact</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  win.document.close();
}
  function render(){
    fillSelects();
  
// AQK DATE-WISE BOOK ENTRY REPORT
const entryLibrary = $('entryReportLibrary');
const entryTitle = $('entryReportTitle');

if (entryLibrary && entryTitle) {
  const oldLibrary = entryLibrary.value;
  const oldTitle = entryTitle.value;

  const reportLibraries = isAdmin()
    ? state.libraries
    : state.libraries.filter(l =>
        state.books.some(b => Number(b.library_id) === Number(l.id))
      );

  entryLibrary.innerHTML =
    '<option value="">All Libraries</option>' +
    reportLibraries.map(l =>
      `<option value="${Number(l.id)}">${safe(l.name)}</option>`
    ).join('');

  entryLibrary.value = oldLibrary;

  const titleBooks = state.books.filter(b =>
    !entryLibrary.value ||
    Number(b.library_id) === Number(entryLibrary.value)
  );

  entryTitle.innerHTML =
    '<option value="">All Books</option>' +
    titleBooks.map(b =>
      `<option value="${Number(b.id)}">${safe(b.title)}</option>`
    ).join('');

  entryTitle.value = oldTitle;

  const showEntryReport = () => {
    const from = $('entryReportFrom').value;
    const to = $('entryReportTo').value;
    const libraryId = entryLibrary.value;
    const bookId = entryTitle.value;

    if (from && to && from > to) {
      message('From Date cannot be after To Date.');
      return;
    }

    const rows = state.books.filter(b => {
      const date = String(b.entry_date || b.date || '').slice(0, 10);

      if (from && (!date || date < from)) return false;
      if (to && (!date || date > to)) return false;

      if (libraryId && Number(b.library_id) !== Number(libraryId)) return false;
      if (bookId && Number(b.id) !== Number(bookId)) return false;

      return true;
    });

    let totalCopies = 0;

    $('entryReportRows').innerHTML = rows.map(b => {
      const copies = state.copies.filter(c =>
        Number(c.book_id) === Number(b.id)
      ).length;

      totalCopies += copies;

      const library = state.libraries.find(l =>
        Number(l.id) === Number(b.library_id)
      );

      return `
        <tr>
          <td>${safe(b.entry_date || b.date || '—')}</td>
          <td>${safe(b.title || '—')}</td>
          <td>${safe(b.author || '—')}</td>
          <td>${safe(library?.name || '—')}</td>
          <td>${copies}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="5">No records found.</td></tr>';

    $('entryReportSummary').innerHTML = `
      <div class="stat">
        <span>Book Records</span>
        <strong>${rows.length}</strong>
      </div>
      <div class="stat">
        <span>Total Physical Copies</span>
        <strong>${totalCopies}</strong>
      </div>
    `;
  };

  entryLibrary.onchange = () => {
    entryTitle.value = '';
    const books = state.books.filter(b =>
      !entryLibrary.value ||
      Number(b.library_id) === Number(entryLibrary.value)
    );

    entryTitle.innerHTML =
      '<option value="">All Books</option>' +
      books.map(b =>
        `<option value="${Number(b.id)}">${safe(b.title)}</option>`
      ).join('');
  };

  $('applyEntryReport').onclick = showEntryReport;
// AQK BOOK ENTRY REPORT PRINT
$('printEntryReport').onclick = () => {

  const libraryId = entryLibrary.value;

  const library = state.libraries.find(l =>
    Number(l.id) === Number(libraryId)
  );

  const from = $('entryReportFrom').value || 'All Dates';
  const to = $('entryReportTo').value || 'All Dates';

  const selectedTitle =
    entryTitle.selectedOptions[0]?.textContent || 'All Books';

  const rows = $('entryReportRows').innerHTML;
  const summary = $('entryReportSummary').innerHTML;

  const w = window.open('', '_blank');

  if (!w) {
    message('Please allow pop-ups to print.');
    return;
  }

  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AQK Book Entry Report</title>

      <style id="pageStyle">
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
      </style>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #222;
          margin: 15px;
        }

        .toolbar {
          text-align: center;
          margin-bottom: 20px;
        }

        button {
          padding: 9px 16px;
          margin: 4px;
          cursor: pointer;
          background: #6d5032;
          color: white;
          border: 0;
          border-radius: 4px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          display: table-header-group;
        }

        th, td {
          border: 1px solid #555;
          padding: 7px;
          font-size: 11px;
          text-align: left;
        }

        th {
          background: #eee4d1;
        }

        .schoolHeading {
          text-align: center;
          padding: 8px;
          border-bottom: 2px solid #6d5032;
        }

        .schoolHeading h2 {
          margin: 3px;
          font-size: 19px;
        }

        .schoolHeading h3 {
          margin: 5px;
          font-size: 15px;
        }

        .schoolHeading p {
          margin: 4px;
          font-size: 11px;
          font-weight: normal;
        }

        .summary {
          display: flex;
          justify-content: space-around;
          margin: 12px 0;
          font-size: 12px;
        }

        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @media print {
          body {
            margin: 0;
          }

          .toolbar {
            display: none !important;
          }

          .summary {
            display: none;
          }

          th {
            background: #eee4d1 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>

      <div class="toolbar">
        <button onclick="setPage('portrait')">
          A4 Portrait
        </button>

        <button onclick="setPage('landscape')">
          A4 Landscape
        </button>

        <button onclick="window.print()">
          Print Report
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th colspan="5">
              <div class="schoolHeading">
                <h2>Dr A Q Khan School &amp; College</h2>
                <p>Bahria Town Phase-8</p>
                <h3>AQK Library Management System</h3>
                <h3>BOOK ENTRY REPORT</h3>
                <p>${safe(library?.name || 'All Libraries')}</p>
                <p>From: ${safe(from)} | To: ${safe(to)}</p>
                <p>Book: ${safe(selectedTitle)}</p>
              </div>
            </th>
          </tr>

          <tr>
            <th>Entry Date</th>
            <th>Book Title</th>
            <th>Author</th>
            <th>Library</th>
            <th>Total Copies</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary">
        ${summary}
      </div>

      <script>
        function setPage(mode) {
          document.getElementById('pageStyle').textContent =
            '@page { size: A4 ' + mode + '; margin: 12mm; }';
        }
      <\/script>

    </body>
    </html>
  `);

  w.document.close();
};
  
  $('resetEntryReport').onclick = () => {
    $('entryReportFrom').value = '';
    $('entryReportTo').value = '';
    entryLibrary.value = '';
    entryTitle.value = '';
    showEntryReport();
  };
}

$('libraryCards').innerHTML = state.libraries.map(l => {
  const books = state.books.filter(
    b => Number(b.library_id) === Number(l.id)
  );

  const copies = state.copies.filter(c =>
    books.some(b => Number(b.id) === Number(c.book_id))
  );

  const available = copies.filter(c =>
    String(c.status || '').toLowerCase() === 'available'
  ).length;

  const shelfBooks = books.slice(0, 10).map((b, i) =>
    `<span class="shelfBook shelfBook-${i % 6}" title="${safe(b.title)}"></span>`
  ).join('');

  return `
    <div class="libCard shelfCard">
      <div class="shelfCardHead">
        <b>${safe(l.name)}</b>
        <span>${safe(l.code)}</span>
      </div>
      <div class="bookshelf">
        <div class="shelfBookRow">
          ${shelfBooks || '<span class="emptyShelf">No books yet</span>'}
        </div>
        <div class="shelfWood"></div>
      </div>
      <div class="shelfInfo">
        <span>Book Titles: <b>${books.length}</b></span>
        <span>Copies: <b>${copies.length}</b></span>
        <span>Available: <b>${available}</b></span>
      </div>
    </div>
  `;
}).join('');   $('libraryTable').innerHTML=`<table><thead><tr><th>Library</th><th>Code</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.libraries.map(l=>`<tr><td>${safe(l.name)}</td><td>${safe(l.code)}</td><td>${l.active?'Active':'Inactive'}</td><td>${isAdmin()?`<button class="actionBtn" onclick="window.editAQKLibrary(${Number(l.id)})">Rename</button>`:'—'}</td></tr>`).join('')}</tbody></table>`;

// AQK SMART BOOK CATALOGUE
const stockFilter = $('bookFilterStock')?.value || 'all';

const searchText = ($('bookFilterSearch')?.value || '').trim().toLowerCase();
const libraryFilter = $('bookFilterLibrary')?.value || '';
const categoryFilter = $('bookFilterCategory')?.value || '';

// Group duplicate books without mixing libraries or categories
const bookGroups = new Map();

state.books.forEach(b => {
  const title = String(b.title || '').trim().toLowerCase();
  const author = String(b.author || '').trim().toLowerCase();
  const isbn = String(b.isbn || '').replace(/[\s-]/g, '').toLowerCase();
  const edition = String(b.edition || '').trim().toLowerCase();
  const year = String(b.publication_year || '').trim();

  const identity = isbn
    ? 'isbn:' + isbn
    : 'title:' + title + '|author:' + author + '|edition:' + edition + '|year:' + year;

  const groupKey = [
    Number(b.library_id || 0),
    Number(b.category_id || 0),
    identity
  ].join('|');

  if (!bookGroups.has(groupKey)) {
    bookGroups.set(groupKey, []);
  }

  bookGroups.get(groupKey).push(b);
});

const filteredGroups = [...bookGroups.values()]
  .map(group => {
    const bookIds = group.map(b => Number(b.id));

    const copies = state.copies.filter(c =>
      bookIds.includes(Number(c.book_id))
    );

    const countStatus = status =>
      copies.filter(c =>
        String(c.status || '').trim().toLowerCase() === status
      ).length;

    return {
      books: group,
      copies,
      total: copies.length,
      available: countStatus('available'),
      issued: countStatus('issued'),
      damaged: countStatus('damaged'),
      lost: countStatus('lost')
    };
  })
  .filter(g => {
    const first = g.books[0];

    const searchData = g.books.map(b => [
      b.title,
      b.author,
      b.accession_no,
      b.isbn,
      b.ser_no
    ].join(' ')).join(' ').toLowerCase();

    if (searchText && !searchData.includes(searchText)) return false;

    if (libraryFilter &&
        String(first.library_id) !== libraryFilter) return false;

    if (categoryFilter &&
        String(first.category_id) !== categoryFilter) return false;

    if (stockFilter === 'available' && g.available === 0) return false;
    if (stockFilter === 'issued' && g.issued === 0) return false;
    if (stockFilter === 'out' && g.available !== 0) return false;

    return true;
  })
  .sort((a, b) =>
    String(a.books[0].ser_no || '')
      .localeCompare(String(b.books[0].ser_no || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
      })
  );
window.deleteAQKCopy = async copyId => {
  if (!isAdmin()) {
    message('Only Super Admin can delete physical copies.');
    return;
  }

  if (!confirm('Kya aap sirf ye physical copy delete karna chahte hain?')) {
    return;
  }

  try {
    await api(`copies/${Number(copyId)}`, {
      method: 'DELETE'
    });

    message('Physical copy deleted successfully.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};

window.toggleAQKBookGroup = groupId => {
  const row = document.querySelector(
    `[data-aqk-book-details="${groupId}"]`
  );

  if (row) {
    row.style.display =
      row.style.display === 'none' ? 'table-row' : 'none';
  }
};


$('bookRows').innerHTML = filteredGroups.flatMap(g => {
  return g.books.map(b => {
    const bookId = Number(b.id);

    const library = state.libraries.find(
      l => Number(l.id) === Number(b.library_id)
    );

    const category = state.categories.find(
      c => Number(c.id) === Number(b.category_id)
    );

    const bookCopies = g.copies.filter(
      c => Number(c.book_id) === bookId
    );

    const availableCopies = bookCopies.filter(
      c => String(c.status || '').toLowerCase() === 'available'
    ).length;

    const totalCopies = bookCopies.length;
    const detailId = 'book-' + bookId;

    const copyRows = bookCopies.map(c => `
      <div style="padding:8px;border-bottom:1px solid #e2e8f0">
        <b>${safe(c.copy_code || 'Copy #' + c.id)}</b>
        <span class="muted"> — ${safe(c.status || '—')}</span>
      </div>
    `).join('');

    const status = availableCopies === 0
      ? '<b style="color:#dc2626">Out of Stock</b>'
      : availableCopies <= 5
        ? '<b style="color:#d97706">Low Stock</b>'
        : '<b style="color:#16a34a">Available</b>';

    return `
      <tr>
        <td>
          <input type="checkbox"
            class="bookSelectCheckbox"
            data-book-ids="${bookId}">
        </td>
        <td>
          <b>${safe(b.title || '')}</b>
          <div class="muted small">
            Accession: ${safe(b.accession_no || '—')}
          </div>
        </td>
        <td>${safe(b.author || '—')}</td>
        <td>${safe(library?.name || '—')}</td>
        <td>${safe(category?.name || '—')}</td>
        <td><b>${totalCopies}</b></td>
        <td><b>${availableCopies}</b></td>
        <td>${status}</td>
        <td>
          <button class="actionBtn"
            onclick="window.editAQKBook(${bookId})">Edit</button>

          <button class="actionBtn"
            onclick="window.toggleAQKBookGroup('${detailId}')">View</button>

          ${isAdmin() ? `
            <button class="actionBtn danger"
              onclick="window.deleteAQKRecord('books', ${bookId})">
              Delete
            </button>
          ` : ''}
        </td>
      </tr>

      <tr data-aqk-book-details="${detailId}" style="display:none">
        <td colspan="9">
          <div class="tableWrap">
            <b>Individual Copies — ${safe(b.title || '')}</b>
            ${copyRows || '<div>No physical copies found.</div>'}
            <div style="padding:8px">
              Total: ${totalCopies} |
              Available: ${availableCopies}
            </div>
          </div>
        </td>
      </tr>
    `;
  });
}).join('') || '<tr><td colspan="9">No books found.</td></tr>';


renderCategorySearch();
// END AQK SMART BOOK CATALOGUE


$('wingRows').innerHTML = state.wings.map(w => `
  <tr>
    <td>${safe(w.name)}</td>
    <td>${safe(state.libraries.find(l => l.id == w.library_id)?.name || '')}</td>
    <td>${safe(w.description || '')}</td>
    <td>
      ${isAdmin() ? `
        <button class="actionBtn"
          onclick="window.editAQKWing(${Number(w.id)})">
          Edit
        </button>
      ` : '—'}
    </td>
  </tr>
`).join('') || '<tr><td colspan="4">No wings yet.</td></tr>';
  renderLibraryInventory();
  const lowStockBooks = state.books.filter(b => {
  const available = state.copies.filter(c =>
    Number(c.book_id) === Number(b.id) &&
    String(c.status || '').toLowerCase() === 'available'
  ).length;

  return available <= 5;
});

const outOfStockBooks = lowStockBooks.filter(b =>
  !state.copies.some(c =>
    Number(c.book_id) === Number(b.id) &&
    String(c.status || '').toLowerCase() === 'available'
  )
);
// AQK Dashboard: Stock Alerts
const stockAlertBox = $('dashboardStockAlerts');

if (stockAlertBox) {
  const alertItems = lowStockBooks.map(b => {
    const available = state.copies.filter(c =>
      Number(c.book_id) === Number(b.id) &&
      String(c.status || '').toLowerCase() === 'available'
    ).length;

    return `<div class="reportRow">
      <strong>${safe(b.title)}</strong>
      <span>${available === 0 ? 'Out of Stock' : `${available} Available`}</span>
    </div>`;
  });

  stockAlertBox.innerHTML = alertItems.join('') ||
    '<p class="muted">No stock alerts. All books have sufficient stock.</p>';
}

// AQK Dashboard: Recent Activities
const activityBox = $('recentActivities');

if (activityBox) {
  const activities = state.loans
    .map(l => ({
      loan: l,
      date: l.return_date || l.issue_date,
      action: l.return_date ? 'Returned' : 'Issued'
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8);

  activityBox.innerHTML = activities.map(a => `
    <div class="reportRow">
      <strong>${safe(a.action)}: ${safe(a.loan.title)}</strong>
      <span>${safe(a.loan.full_name)} · ${safe(a.date || '')}</span>
    </div>
  `).join('') || '<p class="muted">No recent activities yet.</p>';
}
console.log('AQK Minimum Stock Alert:', {
  lowStock: lowStockBooks.length,
  outOfStock: outOfStockBooks.length
});
 console.log('AQK Rack Data:', state.racks);
  $('rackRows').innerHTML = state.racks.map(r => `
  <tr>
    <td>${safe(r.name)}</td>
    <td>${safe(r.code || '')}</td>
    <td>${safe(state.libraries.find(l => Number(l.id) === Number(r.library_id))?.name || '')}</td>
    <td>${safe(state.wings.find(w => Number(w.id) === Number(r.wing_id))?.name || '')}</td>
    <td>
      <button type="button" class="actionBtn"
        onclick="window.editAQKRack(${Number(r.id)})">
        Edit
      </button>
      <button type="button" class="actionBtn danger"
        onclick="window.deleteAQKRecord('racks', ${Number(r.id)})">
        Delete
      </button>
    </td>
  </tr>
`).join('') || '<tr><td colspan="5">No racks yet.</td></tr>';renderAQKMembers();
    $('copyRows').innerHTML=state.copies.map(c=>`<tr><td>${safe(c.copy_code)}</td><td>${safe(c.title)}</td><td>${safe(c.library_name)}</td><td>${safe(c.stock_type)}</td><td>${safe(c.condition)}</td><td><span class="badge">${safe(c.status)}</span></td></tr>`).join('')||'<tr><td colspan="6">No inventory yet.</td></tr>';
   $('loanRows').innerHTML = state.loans.map(l => {
  const overdue = l.status === 'issued' &&
    l.due_date < new Date().toISOString().slice(0,10);

  return `<tr>
    <td>${safe(l.full_name)}<div class="muted small">${safe(l.member_no)}</div></td>
    <td>${safe(l.title)}<div class="muted small">${safe(l.copy_code)}</div></td>
    <td>${safe(l.library_name)}</td>
    <td>${safe(l.issue_date)}</td>
    <td>${safe(l.due_date)}${overdue ? ' <span class="badge">Overdue</span>' : ''}</td>
    <td>${safe(l.return_date || '—')}</td>
    <td>
      ${Number(l.fine_amount || 0).toFixed(2)}
      ${Number(l.fine_paid || 0) > 0 ? ` (paid ${Number(l.fine_paid).toFixed(2)})` : ''}
    </td>
    <td>
      ${safe(l.status)}
      ${l.status === 'issued' ? `
        <button class="actionBtn" onclick="window.returnAQKLoan(${Number(l.id)})">Return</button>
      ` : ''}
    </td>
    <td>
      ${l.status === 'issued' ? `
        <button class="actionBtn" onclick="window.editAQKLoan(${Number(l.id)})">Edit Issue</button>
        ${isAdmin() ? `
          <button class="actionBtn danger" onclick="window.cancelAQKLoan(${Number(l.id)})">Cancel</button>
        ` : ''}
      ` : ''}
      ${['returned','lost'].includes(l.status) && isAdmin() ? `
        <button class="actionBtn" onclick="window.editAQKReturn(${Number(l.id)})">Edit Return</button>
        ${isAdmin() ? `
  <button class="actionBtn danger"
    onclick="window.deleteAQKLoan(${Number(l.id)})">Delete</button>
` : ''}
      ` : ''}
    </td>
  </tr>`;
}).join('') || '<tr><td colspan="9">No issue records yet.</td></tr>'
    const r=state.report||{stats:{}};const stats=r.stats||{};
    const lowStockCount = state.books.filter(b => {
  const available = state.copies.filter(c =>
    Number(c.book_id) === Number(b.id) &&
    String(c.status || '').toLowerCase() === 'available'
  ).length;

  return available > 0 && available <= 5;
}).length;

const outOfStockCount = state.books.filter(b => {
  const available = state.copies.filter(c =>
    Number(c.book_id) === Number(b.id) &&
    String(c.status || '').toLowerCase() === 'available'
  ).length;

  return available === 0;
}).length;

$('stats').innerHTML=[
  ['Libraries',state.libraries.length],
  ['Book titles',stats.books??state.books.length],
  ['Physical copies',stats.copies??state.copies.length],
  ['Members',stats.members??state.members.length],
  ['Issued',stats.issued??state.loans.filter(l=>l.status==='issued').length],
  ['Overdue',stats.overdue??0],
  ['Outstanding fine',`Rs. ${Number(stats.outstandingFine||0).toFixed(2)}`],
  ['Low Stock Books',lowStockCount],
  ['Out of Stock Books',outOfStockCount]
].map(x=>`<div class="stat"><span class="muted">${safe(x[0])}</span><strong>${safe(x[1])}</strong></div>`).join('');

$('reportStats').innerHTML=$('stats').innerHTML;

// AQK Library-wise Books Chart
const libraryChartData = state.libraries.map(l => ({
  name: l.name,
  total: state.copies.filter(
    c => Number(c.library_id) === Number(l.id)
  ).length
}));

const maxLibraryBooks = Math.max(
  1,
  ...libraryChartData.map(x => x.total)
);

$('libraryBooksChart').innerHTML = libraryChartData.map(x => `
  <div class="chartRow">
    <div class="chartLabel">
      <span>${safe(x.name)}</span>
      <b>${x.total}</b>
    </div>
    <div class="chartTrack">
      <div class="chartBar"
        style="width:${(x.total / maxLibraryBooks) * 100}%">
      </div>
    </div>
  </div>
`).join('');

// AQK Monthly Issue / Return Chart
const monthlyData = [];

const today = new Date();

for (let i = 5; i >= 0; i--) {
  const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
  const year = d.getFullYear();
  const month = d.getMonth();

  const monthLoans = state.loans || [];

  const issued = monthLoans.filter(l => {
    if (!l.issue_date) return false;
    const date = new Date(l.issue_date);
    return !isNaN(date) &&
      date.getFullYear() === year &&
      date.getMonth() === month;
  }).length;

  const returned = monthLoans.filter(l => {
    if (!l.return_date) return false;
    const date = new Date(l.return_date);
    return !isNaN(date) &&
      date.getFullYear() === year &&
      date.getMonth() === month;
  }).length;

  monthlyData.push({
    label: d.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
    issued,
    returned
  });
}

const monthlyMax = Math.max(
  1,
  ...monthlyData.map(x => Math.max(x.issued, x.returned))
);

$('monthlyIssueChart').innerHTML = `
  <div class="chartLegend">
    <span>🟦 Issued</span>
    <span>🟨 Returned</span>
  </div>
  ${monthlyData.map(x => `
    <div class="chartRow">
      <div class="chartLabel">
        <span>${x.label}</span>
        <b>${x.issued} issued / ${x.returned} returned</b>
      </div>
      <div class="chartTrack">
        <div class="chartBar"
          style="width:${x.issued / monthlyMax * 100}%">
        </div>
      </div>
      <div class="chartTrack returnTrack">
        <div class="chartBar returnBar"
          style="width:${x.returned / monthlyMax * 100}%">
        </div>
      </div>
    </div>
  `).join('')}
`;
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
);    // AQK Dashboard: Category-wise Books Overview
const categoryBox = $('dashboardCategoryChart');
if (categoryBox) {
  categoryBox.innerHTML = state.categories.map(c => {
    const total = state.books.filter(b => String(b.category_id) === String(c.id)).length;
    return `<div class="reportRow"><strong>${safe(c.name)}</strong><span>${total} Book Titles</span></div>`;
  }).join('') || '<p class="muted">No category data available.</p>';
}

// AQK Dashboard: Daily Issue / Return Statistics
const dailyBox = $('dashboardDailyStats');
if (dailyBox) {
  const today = new Date().toISOString().slice(0, 10);
  const issuedToday = state.loans.filter(l => String(l.issue_date || '').slice(0, 10) === today).length;
  const returnedToday = state.loans.filter(l => String(l.return_date || '').slice(0, 10) === today).length;
  dailyBox.innerHTML = `
    <div class="stat"><strong>${issuedToday}</strong><span>Issued Today</span></div>
    <div class="stat"><strong>${returnedToday}</strong><span>Returned Today</span></div>`;
}

// AQK Dashboard: Fine Collection Summary
const fineBox = $('dashboardFineSummary');
if (fineBox) {
  const totalFine = state.loans.reduce((sum, l) => sum + Number(l.fine_amount || 0), 0);
  const paidFine = state.loans.reduce((sum, l) => sum + Number(l.fine_paid || 0), 0);
  fineBox.innerHTML = `
    <div class="stat"><strong>${reportMoney(paidFine)}</strong><span>Fine Collected</span></div>
    <div class="stat"><strong>${reportMoney(Math.max(0, totalFine - paidFine))}</strong><span>Fine Outstanding</span></div>`;
}$('statusText').textContent=`Connected to Cloudflare D1 · Signed in as ${state.user.role.replace('_',' ')}.`;
    document.querySelectorAll('[data-admin-only]').forEach(el=>el.classList.toggle('hidden',!isAdmin()));hide('setupPanel');hide('loginPanel');show('appPanel');
    if(isAdmin()){show('fineSettings');$('userRows').innerHTML=state.users.map(u=>`<tr><td>${safe(u.full_name)}</td><td>${safe(u.email)}</td><td>${safe(u.role)}</td><td>${safe(state.libraries.find(l=>l.id==u.library_id)?.name||'All libraries')}</td><td>${u.active?'Active':'Disabled'}</td><td>${u.role==='librarian'?`<button class="actionBtn" onclick="window.toggleAQKUser(${Number(u.id)},${u.active?0:1})">${u.active?'Disable':'Enable'}</button>`:''}</td></tr>`).join('');}else hide('fineSettings');
  }
  async function refresh(){
    const [libs,cats,wings,racks,books,members,copies,loans,report,settings]=await Promise.all(['libraries','categories','wings','racks','books','members','copies','loans','reports','settings'].map(p=>api(p).catch(e=>({error:e.message,data:[]}))));
    for(const [name,res] of [['libraries',libs],['categories',cats],['wings',wings],['racks',racks],['books',books],['members',members],['copies',copies],['loans',loans]])if(res.error)throw new Error(`${name}: ${res.error}`);
    state.libraries=libs.data||[];state.categories=cats.data||[];state.wings=wings.data||[];state.racks=racks.data||[];state.books=books.data||[];state.members=members.data||[];state.copies=copies.data||[];state.loans=loans.data||[];state.report=report;state.settings=Object.fromEntries((settings.data||[]).map(x=>[x.key,x.value]));
    
state.users = [];

if (isAdmin()) {
  try {
    const usersResponse = await api('users');
    state.users = usersResponse.data || [];
    console.log('AQK Users loaded:', state.users);
  } catch (error) {
    console.error('AQK Users loading failed:', error);
    message('Librarian accounts could not load: ' + error.message);
  }
}

   
       show('appPanel');
    hide('loginPanel');
    render();
    await loadEbooks();

    if(isAdmin())for(const [key,el] of Object.entries({fine_per_day:'fine_per_day',damaged_fine_percent:'damaged_fine_percent',lost_book_extra_fine:'lost_book_extra_fine',loan_days:'loan_days'}))if($(el))$(el).value=state.settings[key]??'';
  }
  
async function init(){
  try {
    const health = await api('health');
    const status = await api('setup-status');

    if (status.setupRequired) {
      show('setupPanel');
      hide('loginPanel');
      hide('appPanel');
      return;
    }

    try {
      const me = await api('me');
      state.user = me.user;
      await refresh();
    } catch (error) {
      console.error('AQK INIT ERROR:', error);
      show('loginPanel');
      hide('appPanel');
      message('Login/session error: ' + error.message, true);
    }

  } catch (error) {
    console.error('AQK SERVER ERROR:', error);
    show('setupNotice');
    $('setupNotice').textContent = 'Server setup incomplete: ' + error.message;
    show('loginPanel');
  }
}

  $('setupForm').addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));try{const r=await api('setup',{method:'POST',body:JSON.stringify(f)});setupMessage(r.message);e.currentTarget.reset();hide('setupPanel');show('loginPanel');}catch(err){setupMessage(err.message);}});
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{const result=await api('login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});state.user=result.user;message('Signed in.',true);await refresh();}catch(err){message(err.message,true);}});
  $('logoutBtn').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:'{}'});}finally{state.user=null;hide('appPanel');show('loginPanel');$('password').value='';}});
 $('tabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-tab]');
  if(!b)return;

  if(b.dataset.tab==='books' && !window.aqkOpenFilteredBooks){
    window.aqkStockFilter='all';
  }

  document.querySelectorAll('[data-tab]').forEach(x=>
    x.classList.toggle('active',x===b)
  );

  document.querySelectorAll('.tab').forEach(x=>
    x.classList.toggle('hidden',x.id!==b.dataset.tab)
  );
});

// AQK Feature 117: Click Stock Dashboard Cards
$('stats').addEventListener('click',e=>{
  const card=e.target.closest('.stat');
  if(!card)return;

  const label=card.querySelector('span')?.textContent?.trim();

  if(label==='Low Stock Books'){
    window.aqkStockFilter='low';
  }else if(label==='Out of Stock Books'){
    window.aqkStockFilter='out';
  }else{
    return;
  }

  window.aqkOpenFilteredBooks=true;
  document.querySelector('[data-tab="books"]').click();
  window.aqkOpenFilteredBooks=false;

  render();
});
  $('categorySearch')?.addEventListener('input', renderCategorySearch);
$('categoryLibraryFilter')?.addEventListener('change', renderCategorySearch);document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click',()=>refresh().catch(e=>message(e.message))));
  // AQK BOOK FILTER EVENTS
$('bookFilterSearch')?.addEventListener('input', render);
$('bookFilterLibrary')?.addEventListener('change', render);
$('bookFilterCategory')?.addEventListener('change', render);
$('bookFilterStock')?.addEventListener('change', render);

$('clearBookFilters')?.addEventListener('click', () => {
  $('bookFilterSearch').value = '';
  $('bookFilterLibrary').value = '';
  $('bookFilterCategory').value = '';
  $('bookFilterStock').value = '';
  window.aqkStockFilter = 'all';
  render();
});
  
$('applyBookFilters')?.addEventListener('click', () => {
  window.aqkStockFilter = $('bookFilterStock')?.value || 'all';
  render();
});

// END AQK BOOK FILTER EVENTS
  // AQK: Select all books
$('selectAllBooks')?.addEventListener('change', e => {
  document.querySelectorAll('.bookSelectCheckbox').forEach(box => {
    box.checked = e.target.checked;
  });
});

// AQK: Select all button
$('selectAllBooksBtn')?.addEventListener('click', () => {
  document.querySelectorAll('.bookSelectCheckbox').forEach(box => {
    box.checked = true;
  });

  if ($('selectAllBooks')) {
    $('selectAllBooks').checked = true;
  }
});

// AQK: Update Select All checkbox when individual books change
$('bookRows')?.addEventListener('change', e => {
  if (!e.target.classList.contains('bookSelectCheckbox')) return;

  const boxes = [...document.querySelectorAll('.bookSelectCheckbox')];

  if ($('selectAllBooks')) {
    $('selectAllBooks').checked =
      boxes.length > 0 && boxes.every(box => box.checked);
  }
});
  // AQK: Print selected books
$('printSelectedBooks')?.addEventListener('click', () => {

const ids = [
  ...new Set(
    [...document.querySelectorAll('.bookSelectCheckbox:checked')]
      .flatMap(box =>
        (box.dataset.bookIds || '')
          .split('-')
          .map(Number)
      )
      .filter(id => Number.isFinite(id) && id > 0)
  )
];


  if (!ids.length) {
    message('Please select at least one book.');
    return;
  }

  window.printAQKMultiple(ids);
});
  // AQK: Print Combined Book Register
$('printCombinedBooks')?.addEventListener('click', () => {
  const ids = [
    ...new Set(
      [...document.querySelectorAll('.bookSelectCheckbox:checked')]
        .flatMap(box =>
          (box.dataset.bookIds || '')
            .split('-')
            .map(Number)
        )
        .filter(id => Number.isFinite(id) && id > 0)
    )
  ];

  if (!ids.length) {
    message('Please select at least one book.');
    return;
  }

  window.printAQKCombined(ids);
});
  function formPayload(form){const d=Object.fromEntries(new FormData(form));for(const k of Object.keys(d))if(d[k]==='')d[k]=null;return d;}
  async function submitForm(id,endpoint,success,transform){$(id).addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;let data=formPayload(form);if(transform)data=transform(data);try{await api(endpoint,{method:'POST',body:JSON.stringify(data)});form.reset();message(success);await refresh();}catch(err){message(err.message);}});}
let printAfterBookSave = false;

const bookForm = $('bookForm');

bookForm.addEventListener('click', e => {
  if (e.target.closest('#savePrintBook')) {
    printAfterBookSave = true;
  }
});

bookForm.addEventListener('submit', async e => {
  e.preventDefault();

  const form = e.currentTarget;

  const previousIds = new Set(
    state.books.map(b => Number(b.id))
  );

  let data = formPayload(form);

  data = {
    ...data,
    price: Number(data.price || 0),
    pages: data.pages ? Number(data.pages) : null,
    copy_count: Number(data.copy_count || 1)
  };

  const shouldPrint = printAfterBookSave;
  printAfterBookSave = false;

  try {
    await api('books', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    form.reset();

    message('Book saved and physical copy IDs generated.');

    await refresh();

    if (shouldPrint) {
      const savedBook = [...state.books]
        .filter(b => !previousIds.has(Number(b.id)))
        .sort((a, b) => Number(b.id) - Number(a.id))[0];

      if (savedBook) {
        window.printAQKLabels(savedBook.id);
      } else {
        message('Book saved, but its print record could not be identified.');
      }
    }

  } catch (err) {
    message(err.message);
  }
}); 
  submitForm('categoryForm','categories','Category saved.');
submitForm('wingForm','wings','Management wing saved.');

// Rack auto-code
$('rackForm').addEventListener('submit', function () {
  const codeInput = this.elements.namedItem('code');

  if (codeInput && !codeInput.value.trim()) {
    const numbers = state.racks.map(r =>
      Number((r.code || '').match(/^RACK-(\d+)$/i)?.[1] || 0)
    );

    const nextNumber = Math.max(0, ...numbers) + 1;
    codeInput.value = 'RACK-' + String(nextNumber).padStart(3, '0');
  }
});

submitForm('rackForm','racks','Rack saved.');
  $('loadRackBooks').addEventListener('click', async () => {
  const rackId = $('rackBooksSelect').value;

  if (!rackId) {
    message('Please select a rack first.');
    return;
  }

  try {
    const result = await api(
      `inventory/rack-books?rack_id=${encodeURIComponent(rackId)}`
    );

    const rows = result.data || [];

    $('rackBooksRows').innerHTML = rows.map(c => `
      <tr>
        <td>${safe(c.copy_code || c.id)}</td>
        <td>${safe(c.title || '')}</td>
        <td>${safe(c.rack_number || '')}</td>
        <td>${safe(c.shelf_number || '')}</td>
        <td>${safe(c.stock_type || '')}</td>
        <td>${safe(c.condition || '')}</td>
        <td>${safe(c.status || '')}</td>
      </tr>
    `).join('') || '<tr><td colspan="7">No books found in this rack.</td></tr>';

    $('rackBooksStats').innerHTML = `
      <div class="stat">
        <span class="muted">Total Copies</span>
        <strong>${rows.length}</strong>
      </div>
      <div class="stat">
        <span class="muted">Available</span>
        <strong>${rows.filter(c => c.status === 'available').length}</strong>
      </div>
      <div class="stat">
        <span class="muted">Issued</span>
        <strong>${rows.filter(c => c.status === 'issued').length}</strong>
      </div>
    `;
  } catch (err) {
    message('Rack books error: ' + err.message);
  }
});
  // AQK MEMBER ADD AND EDIT
$('memberForm').addEventListener('submit', async e => {
  e.preventDefault();

  const form = e.currentTarget;
  const editId = form.dataset.editId;
  const data = formPayload(form);

  try {
    if (editId) {
      await api(`members/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });

      message('Member record updated successfully.');
    } else {
      await api('members', {
        method: 'POST',
        body: JSON.stringify(data)
      });

      message('New member added successfully.');
    }

    delete form.dataset.editId;
    form.reset();

    const button = form.querySelector('button[type="submit"]');
    if (button) button.textContent = 'Add Member';

    await refresh();

  } catch (err) {
    message(err.message);
  }
});
  submitForm('loanForm','issue','Book issued successfully.',d=>d);
  submitForm('userForm','users','Librarian account created.');
  $('settingsForm').addEventListener('submit',async e=>{e.preventDefault();const d=formPayload(e.currentTarget);try{for(const [key,value] of Object.entries(d))await api('settings',{method:'POST',body:JSON.stringify({key,value:Number(value)})});message('Fine settings saved.');await refresh();}catch(err){message(err.message);}});
  $('printReports').addEventListener('click',()=>window.print());
window.editAQKWing = async function(id) {
  if (!isAdmin()) {
    message('Only Super Admin can edit wings.');
    return;
  }

  const wing = state.wings.find(w => Number(w.id) === Number(id));
  if (!wing) {
    message('Wing not found.');
    return;
  }
  const name = prompt('Enter Wing Name:', wing.name);
  if (name === null) return;

  const description = prompt('Enter Description:', wing.description || '');
  if (description === null) return;

  const currentLibrary = state.libraries.find(
    l => Number(l.id) === Number(wing.library_id)
  );

  const libraryCode = prompt(
    'Enter Library Code:',
    currentLibrary?.code || ''
  );
  if (libraryCode === null) return;

  const library = state.libraries.find(
    l => String(l.code).toUpperCase() === libraryCode.trim().toUpperCase()
  );

  if (!name.trim() || !library) {
    message('Valid Wing Name and Library Code are required.');
    return;
  }

  try {
    await api(`wings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        library_id: Number(library.id)
      })
    });

    message('Management Wing updated successfully.');
    await refresh();
  } catch (err) {
    message(err.message);
  }
};

window.editAQKLibrary = async id => {
  const l = state.libraries.find(x => Number(x.id) === Number(id));
  if (!l || !isAdmin()) return;

  const name = prompt('Library name:', l.name);
  if (name === null) return;

  const code = prompt('Library code:', l.code);
  if (code === null) return;

  try {
    await api('libraries', {
      method: 'PATCH',
      body: JSON.stringify({
        id,
        name: name.trim(),
        code: code.trim()
      })
    });

    message('Library name updated.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};
  $('libraryForm')?.addEventListener('submit', async e => {
  e.preventDefault();

  if (!isAdmin()) {
    message('Only Super Admin can add libraries.');
    return;
  }

  const form = e.currentTarget;
  const data = formPayload(form);

  try {
    await api('libraries', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    form.reset();
    message('New library added successfully.');
    await refresh();
  } catch (err) {
    message(err.message);
  }
});

window.editAQKBook=async id=>{
  const b=state.books.find(x=>Number(x.id)===Number(id));
  if(!b)return;

  const isAdmin=state.user?.role==='super_admin';

  const dialog=document.createElement('dialog');
  dialog.style.cssText='width:min(520px,94vw);max-height:90vh;overflow:auto;border:1px solid #ccc;border-radius:12px;padding:20px;';

  dialog.innerHTML=`
    <h3>Edit Book / Library Assignment</h3>
    <form id="aqkBookEditForm">
      <label>Book Title</label>
      <input name="title" required style="width:100%;margin:5px 0 12px;padding:9px">

      <label>Author</label>
      <input name="author" style="width:100%;margin:5px 0 12px;padding:9px">

      <label>Price (Rs.)</label>
      <input name="price" type="number" step="0.01" style="width:100%;margin:5px 0 12px;padding:9px">

      <label>Vendor / Publisher</label>
      <input name="vendor" style="width:100%;margin:5px 0 12px;padding:9px">

      <label>Edition</label>
      <input name="edition" style="width:100%;margin:5px 0 12px;padding:9px">

      <label>Tag ID</label>
      <input name="tag_id" style="width:100%;margin:5px 0 12px;padding:9px">

      <hr>
      <h4>Library Assignment</h4>

      <label>Library</label>
      <select name="library_id" style="width:100%;margin:5px 0 12px;padding:9px"></select>

      <label>Category</label>
      <select name="category_id" style="width:100%;margin:5px 0 12px;padding:9px"></select>

      <label>Management Wing</label>
      <select name="wing_id" style="width:100%;margin:5px 0 12px;padding:9px"></select>

      <label>Rack</label>
      <select name="rack_id" style="width:100%;margin:5px 0 12px;padding:9px"></select>

      <div style="display:flex;gap:10px;margin-top:18px">
        <button type="submit" style="padding:10px 18px">Save Changes</button>
        <button type="button" id="aqkBookCancel" style="padding:10px 18px">Cancel</button>
      </div>
    </form>
  `;

  document.body.appendChild(dialog);

  const form=dialog.querySelector('#aqkBookEditForm');
  const librarySelect=form.elements.library_id;
  const categorySelect=form.elements.category_id;
  const wingSelect=form.elements.wing_id;
  const rackSelect=form.elements.rack_id;

  const libraries=isAdmin
    ?state.libraries
    :state.libraries.filter(x=>Number(x.id)===Number(b.library_id));

  const addOptions=(select,items,selectedId)=>{
    select.innerHTML='';
    const first=document.createElement('option');
    first.value='';
    first.textContent='— Select —';
    select.appendChild(first);

    items.forEach(item=>{
      const option=document.createElement('option');
      option.value=item.id;
      option.textContent=item.name||item.title||item.code||('ID '+item.id);
      select.appendChild(option);
    });

    if(selectedId!=null)select.value=String(selectedId);
  };

  addOptions(librarySelect,libraries,b.library_id);
  if(!isAdmin)librarySelect.disabled=true;

  form.elements.title.value=b.title||'';
  form.elements.author.value=b.author||'';
  form.elements.price.value=b.price||0;
  form.elements.vendor.value=b.vendor||'';
  form.elements.edition.value=b.edition||'';
  form.elements.tag_id.value=b.tag_id||'';

  const loadLibraryOptions=(libraryId,keepCurrent)=>{
    const categories=state.categories.filter(x=>Number(x.library_id)===Number(libraryId));
    const wings=state.wings.filter(x=>Number(x.library_id)===Number(libraryId));
    const racks=state.racks.filter(x=>Number(x.library_id)===Number(libraryId));

    addOptions(categorySelect,categories,keepCurrent?b.category_id:null);
    addOptions(wingSelect,wings,keepCurrent?b.wing_id:null);
    addOptions(rackSelect,racks,keepCurrent?b.rack_id:null);
  };

  loadLibraryOptions(b.library_id,true);

  librarySelect.addEventListener('change',()=>{
    loadLibraryOptions(librarySelect.value,false);
  });

  dialog.querySelector('#aqkBookCancel').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});

  form.addEventListener('submit',async event=>{
    event.preventDefault();

    const data={
      title:form.elements.title.value.trim(),
      author:form.elements.author.value.trim()||null,
      price:Number(form.elements.price.value)||0,
      vendor:form.elements.vendor.value.trim()||null,
      edition:form.elements.edition.value.trim()||null,
      tag_id:form.elements.tag_id.value.trim()||null,
      category_id:categorySelect.value||null,
      wing_id:wingSelect.value||null,
      rack_id:rackSelect.value||null
    };

    if(isAdmin){
      if(!librarySelect.value){
        message('Please select a library.');
        return;
      }
      data.library_id=Number(librarySelect.value);
    }else{
      data.library_id=Number(b.library_id);
    }

    if(!data.title){
      message('Book title is required.');
      return;
    }

    try{
      await api(`books/${id}`,{
        method:'PATCH',
        body:JSON.stringify(data)
      });

      dialog.close();
      message('Book record updated successfully.');
      await refresh();
    }catch(e){
      message(e.message);
    }
  });

  dialog.showModal();
};
window.editAQKRack = async function(id) {
  const r = state.racks.find(x => Number(x.id) === Number(id));

  if (!r) {
    message('Rack not found.');
    return;
  }

  const name = prompt('Rack Name:', r.name || '');
  if (name === null) return;

  const code = prompt('Rack Code:', r.code || '');
  if (code === null) return;

  const rack_number = prompt('Rack Number:', r.rack_number || '');
  if (rack_number === null) return;

  const shelf_number = prompt('Shelf Number:', r.shelf_number || '');
  if (shelf_number === null) return;

  const location_code = prompt('Location Code:', r.location_code || '');
  if (location_code === null) return;

  const minimum_stock = prompt('Minimum Stock:', r.minimum_stock || 0);
  if (minimum_stock === null) return;

  if (!name.trim() || !code.trim()) {
    message('Rack Name and Rack Code are required.');
    return;
  }

  try {
    await api(`racks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        code: code.trim(),
        rack_number: rack_number.trim() || null,
        shelf_number: shelf_number.trim() || null,
        location_code: location_code.trim() || null,
        minimum_stock: Number(minimum_stock) || 0
      })
    });

    message('Rack updated successfully.');
    await refresh();

  } catch (err) {
    message(err.message);
  }
};
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
};  
  window.deleteAQKRecord = async (table, id) => {

  if (!isAdmin()) {
    message('Only Super Admin can delete records.');
    return;
  }

  if (!confirm(`Delete this ${table.slice(0, -1)}? This cannot be undone.`)) {
    return;
  }

  try {
    await api(`${table}/${id}`, { method: 'DELETE' });
    message('Record deleted successfully.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};
  // AQK MEMBER VIEW
window.viewAQKMember = id => {
  const m = state.members.find(x => Number(x.id) === Number(id));

  if (!m) {
    message('Member not found.');
    return;
  }

  alert(
    'Member Details\n\n' +
    'Member No: ' + (m.member_no || '') + '\n' +
    'Name: ' + (m.full_name || '') + '\n' +
    'Type: ' + (m.member_type || '') + '\n' +
    'Student / College ID: ' + (m.college_id || '') + '\n' +
    'Class / Department: ' + (m.class_department || '') + '\n' +
    'Father / Guardian: ' + (m.father_name || '') + '\n' +
    'Contact: ' + (m.contact || '') + '\n' +
    'Email: ' + (m.email || '') + '\n' +
    'Expiry Date: ' + (m.expiry_date || '') + '\n' +
    'Address: ' + (m.address || '')
  );
};

// AQK MEMBER EDIT
window.editAQKMember = id => {
  const m = state.members.find(x => Number(x.id) === Number(id));

  if (!m) {
    message('Member not found.');
    return;
  }

  const form = $('memberForm');

  [
    'full_name',
    'member_type',
    'college_id',
    'class_department',
    'father_name',
    'contact',
    'email',
    'expiry_date',
    'library_id',
    'address'
  ].forEach(name => {
    const field = form.elements.namedItem(name);
    if (field) field.value = m[name] ?? '';
  });

  form.dataset.editId = m.id;

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = 'Update Member';

  form.scrollIntoView({ behavior: 'smooth', block: 'center' });

  message('Member details loaded. Edit the fields and click Update Member.');
};
  window.returnAQKLoan=async id=>{const disposition=prompt('Return condition: type returned, damaged, or lost','returned');if(disposition===null)return;if(!['returned','damaged','lost'].includes(disposition.toLowerCase())){message('Use returned, damaged, or lost.');return;}const return_date=new Date().toISOString().slice(0,10);try{const r=await api('return',{method:'POST',body:JSON.stringify({id,disposition:disposition.toLowerCase(),return_date})});message(`Return saved. Fine calculated: Rs. ${Number(r.fine||0).toFixed(2)} (${r.lateDays} late days).`);await refresh();}catch(e){message(e.message);}};
  // AQK ISSUE EDIT
window.editAQKLoan = async id => {
  const loan = state.loans.find(x => Number(x.id) === Number(id));
  if (!loan) return message('Issue record not found.');
  if (loan.status !== 'issued') return message('Only active issues can be edited.');

  const issue_date = prompt('Issue Date (YYYY-MM-DD)', loan.issue_date);
  if (issue_date === null) return;

  const due_date = prompt('Due Date (YYYY-MM-DD)', loan.due_date);
  if (due_date === null) return;

  if (!issue_date || !due_date || due_date < issue_date) {
    return message('Due date must be on or after issue date.');
  }

  try {
    await api(`loans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ issue_date, due_date })
    });
    message('Issue dates updated successfully.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};

// AQK CANCEL ISSUE
window.cancelAQKLoan = async id => {
  if (!isAdmin()) return message('Only Super Admin can cancel an issue.');

  if (!confirm('Cancel this issue? The book copy will become available again.')) return;

  try {
    await api(`loans/${id}/cancel`, { method: 'POST' });
    message('Issue cancelled. Book copy is available again.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};

// AQK EDIT RETURN
// AQK EDIT RETURN
window.editAQKReturn = async id => {
  if (!isAdmin()) return message('Only Super Admin can edit return records.');

  const loan = state.loans.find(x => Number(x.id) === Number(id));

  if (!loan || !['returned', 'lost'].includes(loan.status)) {
    return message('Returned record not found.');
  }

  const return_date = prompt(
    'Return Date (YYYY-MM-DD)',
    loan.return_date || ''
  );

  if (return_date === null) return;

  const disposition = prompt(
    'Condition: returned, damaged, or lost',
    loan.return_disposition || (loan.status === 'lost' ? 'lost' : 'returned')
  );

  if (disposition === null) return;

  try {
    const r = await api(`loans/${id}/return`, {
      method: 'PATCH',
      body: JSON.stringify({
        return_date,
        disposition: disposition.toLowerCase()
      })
    });

    message(`Return updated. New fine: Rs. ${Number(r.fine || 0).toFixed(2)}`);
    await refresh();
  } catch (e) {
    message(e.message);
  }
};

// AQK DELETE ISSUE / RETURN
window.deleteAQKLoan = async id => {
  if (!isAdmin()) {
    return message('Only Super Admin can delete issue records.');
  }

  if (!confirm('Are you sure you want to permanently delete this issue/return record?')) {
    return;
  }

  try {
    await api(`loans/${id}`, { method: 'DELETE' });
    message('Issue/Return record deleted successfully.');
    await refresh();
  } catch (e) {
    message(e.message);
  }
};
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
    message('Please allow pop-ups to print.');
    return;
  }

  const value = v =>
    v !== null && v !== undefined && v !== ''
      ? v
      : '—';

  const money = v =>
    v !== null && v !== undefined && v !== ''
      ? 'Rs. ' + Number(v).toLocaleString('en-PK')
      : '—';

  const details = [
    ['Serial Number', b.ser_no],
    ['Accession Number', b.accession_no],
    ['Entry Date', b.entry_date || b.date],
    ['Book Title', b.title],
    ['Author Name', b.author],
    ['Co-Author Name', b.co_author],
    ['ISBN Number', b.isbn],
    ['Edition', b.edition],
    ['Volume Number', b.volume_number],
    ['Publisher', b.publisher || b.vendor],
    ['Publication Year', b.publication_year],
    ['Academic Year', b.academic_year],
    ['Number of Pages', b.pages],
    ['Language', b.language],
    ['Category', category?.name],
    ['Subcategory', b.subcategory],
    ['Library', library?.name],
    ['Management Wing', wing?.name],
    ['Department / Class', b.department_class],
    ['Rack Number', rack?.name || b.rack_number],
    ['Shelf Number', b.shelf_number],
    ['Unique Tag ID', b.tag_id],
    ['Vendor / Supplier', b.vendor],
    ['Purchase Date', b.purchase_date],
    ['Invoice Number', b.invoice_number],
    ['Purchase Price', money(b.price)],
    ['Discount', money(b.discount)],
    ['Total Quantity / Copies', b.copy_count || copies.length],
    ['Book Condition', b.condition],
    ['Stock Type', b.stock_type],
    ['Donor Information', b.donor_information],
    ['Book Description', b.description]
  ];

  const detailRows = details.map(([name, val]) => `
    <tr>
      <th>${safe(name)}</th>
      <td>${safe(value(val))}</td>
    </tr>
  `).join('');

  const labelRows = copies.length
    ? copies.map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${safe(c.copy_code || '—')}</td>
          <td>${safe(c.library_name || library?.name || '—')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3">No physical copy IDs found.</td></tr>`;

  const generatedDate = new Date().toLocaleDateString('en-GB');

  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AQK Book Entry Register</title>

      <style id="pageStyle">
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
      </style>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          font-family: Georgia, "Times New Roman", serif;
          color: #403326;
          background: #f8f3e8;
          margin: 15px;
        }

        .toolbar {
          text-align: center;
          margin-bottom: 18px;
        }

        button {
          padding: 9px 18px;
          margin: 4px;
          background: #6d5032;
          color: white;
          border: 1px solid #6d5032;
          cursor: pointer;
        }

        .report {
          background: #fffdf7;
          border: 3px double #8b704b;
          padding: 22px;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #8b704b;
          padding-bottom: 13px;
        }

        .emblem {
          width: 55px;
          height: 55px;
          border: 2px solid #8b704b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 27px;
          margin: 0 auto 8px;
        }

        .header h1 {
          font-size: 22px;
          margin: 3px 0;
          letter-spacing: .5px;
        }

        .header p {
          font-size: 12px;
          margin: 4px 0;
        }

        .libraryName {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          margin: 13px 0 5px;
          color: #6d5032;
        }

        .reportTitle {
          text-align: center;
          font-size: 19px;
          font-weight: bold;
          letter-spacing: 1px;
          margin: 8px 0;
          padding: 10px 0;
          border-top: 1px solid #8b704b;
          border-bottom: 1px solid #8b704b;
        }

        .subtitle {
          text-align: center;
          font-size: 11px;
          margin-bottom: 15px;
        }

        .sectionTitle {
          background: #eee4d1;
          border: 1px solid #a58a63;
          padding: 8px;
          font-size: 13px;
          font-weight: bold;
          margin: 16px 0 0;
          color: #594329;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0;
        }

        th, td {
          border: 1px solid #b6a384;
          padding: 7px 9px;
          font-size: 11px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        th {
          width: 32%;
          background: #f4eddf;
          font-weight: bold;
          color: #594329;
        }

        .copyTable th {
          width: auto;
          background: #eee4d1;
        }

        .summary {
          margin-top: 13px;
          padding: 9px;
          border: 1px solid #a58a63;
          background: #f8f1e4;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .footer {
          text-align: center;
          border-top: 2px double #8b704b;
          margin-top: 22px;
          padding-top: 10px;
          font-size: 10px;
          line-height: 1.7;
        }

        .confidential {
          font-weight: bold;
          letter-spacing: 1px;
          color: #70512e;
        }

        @media print {
          body {
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .toolbar {
            display: none;
          }

          .report {
            border: 3px double #8b704b;
          }

          tr {
            break-inside: avoid;
          }
        }
      </style>
    </head>

    <body>

      <div class="toolbar">
        <button onclick="setPage('portrait')">Portrait</button>
        <button onclick="setPage('landscape')">Landscape</button>
        <button onclick="window.print()">Print Book Entry</button>
      </div>

      <div class="report">

        <div class="header">
          <div class="emblem">📖</div>
          <h1>Dr A Q Khan School &amp; College</h1>
          <p>Bahria Town Phase-8</p>
          <p>AQK Library Management System</p>
        </div>

        <div class="libraryName">
          ${safe(library?.name || 'AQK Library')}
        </div>

        <div class="reportTitle">
          BOOK ENTRY - INVENTORY REGISTER
        </div>

        <div class="subtitle">
          Library Book Record · Internal Library Documentation
        </div>

        <div class="sectionTitle">
          BOOK INFORMATION
        </div>

        <table>
          <tbody>
            ${detailRows}
          </tbody>
        </table>

        <div class="sectionTitle">
          PHYSICAL COPY REGISTER
        </div>

        <table class="copyTable">
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Physical Copy ID</th>
              <th>Library</th>
            </tr>
          </thead>
          <tbody>
            ${labelRows}
          </tbody>
        </table>

        <div class="summary">
          <span><b>Total Copies:</b> ${copies.length || Number(b.copy_count || 0)}</span>
          <span><b>Printed Date:</b> ${generatedDate}</span>
        </div>

        <div class="footer">
          <div class="confidential">
            CONFIDENTIAL - FOR INTERNAL LIBRARY RECORDS
          </div>
          Dr A Q Khan School &amp; College · AQK Library Management System
          <br>
          This document is generated for official library inventory records.
        </div>

      </div>

      <script>
        function setPage(mode) {
          document.getElementById('pageStyle').textContent =
            '@page { size: A4 ' + mode + '; margin: 12mm; }';
        }
      <\/script>

    </body>
    </html>
  `);

  w.document.close();
};
// AQK: Print multiple selected books in one print job
window.printAQKMultiple = ids => {
  const selectedBooks = ids
    .map(id => state.books.find(b => Number(b.id) === Number(id)))
    .filter(Boolean);

  if (!selectedBooks.length) {
    message('Please select at least one book.');
    return;
  }

  const w = window.open('', '_blank');

  if (!w) {
    message('Please allow pop-ups to print.');
    return;
  }

  const value = v =>
    v !== null && v !== undefined && v !== '' ? v : '—';

  const money = v =>
    v !== null && v !== undefined && v !== ''
      ? 'Rs. ' + Number(v).toLocaleString('en-PK')
      : '—';

  const pages = selectedBooks.map((b, index) => {
    const copies = state.copies.filter(
      c => Number(c.book_id) === Number(b.id)
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

    const details = [
      ['Serial Number', b.ser_no],
      ['Accession Number', b.accession_no],
      ['Entry Date', b.entry_date || b.date],
      ['Book Title', b.title],
      ['Author Name', b.author],
      ['Co-Author Name', b.co_author],
      ['ISBN Number', b.isbn],
      ['Edition', b.edition],
      ['Volume Number', b.volume_number],
      ['Publisher', b.publisher || b.vendor],
      ['Publication Year', b.publication_year],
      ['Academic Year', b.academic_year],
      ['Number of Pages', b.pages],
      ['Language', b.language],
      ['Category', category?.name],
      ['Subcategory', b.subcategory],
      ['Library', library?.name],
      ['Management Wing', wing?.name],
      ['Department / Class', b.department_class],
      ['Rack Number', rack?.name || b.rack_number],
      ['Shelf Number', b.shelf_number],
      ['Unique Tag ID', b.tag_id],
      ['Vendor / Supplier', b.vendor],
      ['Purchase Date', b.purchase_date],
      ['Invoice Number', b.invoice_number],
      ['Purchase Price', money(b.price)],
      ['Discount', money(b.discount)],
      ['Total Quantity / Copies', b.copy_count || copies.length],
      ['Book Condition', b.condition],
      ['Stock Type', b.stock_type],
      ['Donor Information', b.donor_information],
      ['Book Description', b.description]
    ];

    const detailRows = details.map(([name, val]) => `
      <tr>
        <th>${safe(name)}</th>
        <td>${safe(value(val))}</td>
      </tr>
    `).join('');

    const copyRows = copies.length
      ? copies.map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${safe(c.copy_code || '—')}</td>
            <td>${safe(c.library_name || library?.name || '—')}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3">No physical copy IDs found.</td></tr>';

    return `
      <div class="report">
        <div class="header">
          <div class="emblem">📖</div>
          <h1>Dr A Q Khan School &amp; College</h1>
          <p>Bahria Town Phase-8</p>
          <p>AQK Library Management System</p>
        </div>

        <div class="libraryName">
          ${safe(library?.name || 'AQK Library')}
        </div>

        <div class="reportTitle">
          BOOK ENTRY - INVENTORY REGISTER
        </div>

        <div class="subtitle">
          Book Record ${index + 1} of ${selectedBooks.length}
          · Internal Library Documentation
        </div>

        <div class="sectionTitle">BOOK INFORMATION</div>

        <table>
          <tbody>${detailRows}</tbody>
        </table>

        <div class="sectionTitle">PHYSICAL COPY REGISTER</div>

        <table class="copyTable">
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Physical Copy ID</th>
              <th>Library</th>
            </tr>
          </thead>
          <tbody>${copyRows}</tbody>
        </table>

        <div class="summary">
          <span><b>Total Copies:</b> ${copies.length || Number(b.copy_count || 0)}</span>
          <span><b>Printed Date:</b> ${new Date().toLocaleDateString('en-GB')}</span>
        </div>

        <div class="footer">
          <div class="confidential">
            CONFIDENTIAL - FOR INTERNAL LIBRARY RECORDS
          </div>
          Dr A Q Khan School &amp; College · AQK Library Management System
          <br>
          This document is generated for official library inventory records.
        </div>
      </div>
    `;
  }).join('');

  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AQK Multiple Book Register</title>

      <style id="pageStyle">
        @page { size: A4 portrait; margin: 10mm; }
      </style>

      <style>
        * { box-sizing: border-box; }

        body {
          font-family: Georgia, "Times New Roman", serif;
          color: #403326;
          margin: 15px;
        }

        .toolbar {
          text-align: center;
          margin-bottom: 18px;
        }

        button {
          padding: 9px 18px;
          margin: 4px;
          background: #6d5032;
          color: white;
          border: 1px solid #6d5032;
          cursor: pointer;
        }

        .report {
          background: #fffdf7;
          border: 3px double #8b704b;
          padding: 16px;
          break-after: page;
          page-break-after: always;
        }

        .report:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #8b704b;
          padding-bottom: 10px;
        }

        .emblem {
          width: 48px;
          height: 48px;
          border: 2px solid #8b704b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 6px;
        }

        .header h1 {
          font-size: 20px;
          margin: 3px 0;
        }

        .header p {
          font-size: 11px;
          margin: 3px 0;
        }

        .libraryName {
          text-align: center;
          font-size: 15px;
          font-weight: bold;
          margin: 10px 0 5px;
          color: #6d5032;
        }

        .reportTitle {
          text-align: center;
          font-size: 17px;
          font-weight: bold;
          margin: 7px 0;
          padding: 8px 0;
          border-top: 1px solid #8b704b;
          border-bottom: 1px solid #8b704b;
        }

        .subtitle {
          text-align: center;
          font-size: 10px;
          margin-bottom: 10px;
        }

        .sectionTitle {
          background: #eee4d1;
          border: 1px solid #a58a63;
          padding: 6px;
          font-size: 12px;
          font-weight: bold;
          margin: 10px 0 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border: 1px solid #8f8069;
          padding: 5px 7px;
          font-size: 10px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        th {
          width: 32%;
          background: #f4eddf;
          font-weight: bold;
        }

        .copyTable th { width: auto; }

        .summary {
          margin-top: 9px;
          padding: 7px;
          border: 1px solid #a58a63;
          background: #f8f1e4;
          font-size: 10px;
          display: flex;
          justify-content: space-between;
        }

        .footer {
          text-align: center;
          border-top: 2px double #8b704b;
          margin-top: 14px;
          padding-top: 7px;
          font-size: 9px;
          line-height: 1.6;
        }

        .confidential {
          font-weight: bold;
          letter-spacing: 1px;
        }

        @media print {
          body { margin: 0; }
          .toolbar { display: none; }
          .report { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr { break-inside: avoid; }
        }
      </style>
    </head>

    <body>
      <div class="toolbar">
        <button onclick="setPage('portrait')">Portrait</button>
        <button onclick="setPage('landscape')">Landscape</button>
        <button onclick="window.print()">Print Selected Books</button>
      </div>

      ${pages}

      <script>
        function setPage(mode) {
          document.getElementById('pageStyle').textContent =
            '@page { size: A4 ' + mode + '; margin: 10mm; }';
        }
      <\/script>
    </body>
    </html>
  `);

  w.document.close();
};
  
// AQK: Combined Book Register
window.printAQKCombined = ids => {
  const selectedBooks = ids
    .map(id => state.books.find(b => Number(b.id) === Number(id)))
    .filter(Boolean);

  if (!selectedBooks.length) {
    message('Please select at least one book.');
    return;
  }

  const w = window.open('', '_blank');

  if (!w) {
    message('Please allow pop-ups to print.');
    return;
  }

  const val = v =>
    v !== null && v !== undefined && v !== '' ? v : '—';

  const money = v =>
    v !== null && v !== undefined && v !== ''
      ? 'Rs. ' + Number(v).toLocaleString('en-PK')
      : '—';

  const rows = selectedBooks.map((b, index) => {
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

    const copies = state.copies.filter(
      c => Number(c.book_id) === Number(b.id)
    );

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${safe(val(b.ser_no))}</td>
        <td>${safe(val(b.accession_no))}</td>
        <td>${safe(val(b.title))}</td>
        <td>${safe(val(b.author))}</td>
        <td>${safe(val(category?.name))}</td>
        <td>${safe(val(library?.name))}</td>
        <td>${safe(val(wing?.name))}</td>
        <td>${safe(val(rack?.name || b.rack_number))}</td>
        <td>${safe(val(b.shelf_number))}</td>
        <td>${copies.length || Number(b.copy_count || 0)}</td>
        <td>${safe(money(b.price))}</td>
        <td>${safe(val(b.condition))}</td>
        <td>${safe(val(b.stock_type))}</td>
      </tr>
    `;
  }).join('');

  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AQK Combined Book Register</title>

      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, sans-serif;
          color: #333;
          margin: 15px;
        }

        .toolbar {
          text-align: center;
          margin-bottom: 18px;
        }

        button {
          padding: 9px 18px;
          background: #6d5032;
          color: white;
          border: 0;
          cursor: pointer;
        }

        .header {
          text-align: center;
          border-bottom: 2px solid #8b704b;
          padding-bottom: 10px;
        }

        .header h1 {
          font-size: 21px;
          margin: 4px;
        }

        .header p {
          margin: 4px;
          font-size: 12px;
        }

        .reportTitle {
          text-align: center;
          font-size: 17px;
          font-weight: bold;
          margin: 15px 0 5px;
        }

        .subtitle {
          text-align: center;
          font-size: 11px;
          margin-bottom: 15px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          border: 1px solid #888;
          padding: 6px 5px;
          font-size: 9px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        th {
          background: #eee4d1;
          font-weight: bold;
        }

        .summary {
          margin-top: 12px;
          padding: 8px;
          border: 1px solid #a58a63;
          font-size: 11px;
        }

        .footer {
          text-align: center;
          border-top: 2px solid #8b704b;
          margin-top: 15px;
          padding-top: 8px;
          font-size: 9px;
        }

        @media print {
          body {
            margin: 0;
          }

          .toolbar {
            display: none;
          }

          thead {
            display: table-header-group;
          }

          tr {
            break-inside: avoid;
          }

          th {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>
      <div class="toolbar">
        <button onclick="window.print()">Print Combined Register</button>
      </div>

      <div class="header">
        <h1>Dr A Q Khan School &amp; College</h1>
        <p>Bahria Town Phase-8</p>
        <p>AQK Library Management System</p>
      </div>

      <div class="reportTitle">
        COMBINED BOOK INVENTORY REGISTER
      </div>

      <div class="subtitle">
        Total Selected Books: ${selectedBooks.length}
        · Printed Date: ${new Date().toLocaleDateString('en-GB')}
      </div>

      <table>
        <thead>
          <tr>
            <th>Sr.</th>
            <th>Serial No.</th>
            <th>Accession No.</th>
            <th>Book Title</th>
            <th>Author</th>
            <th>Category</th>
            <th>Library</th>
            <th>Wing</th>
            <th>Rack</th>
            <th>Shelf</th>
            <th>Copies</th>
            <th>Price</th>
            <th>Condition</th>
            <th>Stock Type</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary">
        <b>Total Books:</b> ${selectedBooks.length}
      </div>

      <div class="footer">
        CONFIDENTIAL - FOR INTERNAL LIBRARY RECORDS
        <br>
        Dr A Q Khan School &amp; College · AQK Library Management System
      </div>
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
      // Update Dashboard E-Books count
const ebookStat = document.getElementById('dashboardEbookCount');
if (ebookStat) {
  ebookStat.textContent = state.ebooks.length;
}
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

if (bookForm?.elements?.entry_date) {
  bookForm.elements.entry_date.value = new Date().toISOString().slice(0, 10);
}

const loanForm = $('loanForm');
if (loanForm?.elements?.issue_date) {
  loanForm.elements.issue_date.value = new Date().toISOString().slice(0, 10);
}
if (loanForm?.elements?.due_date) {
  loanForm.elements.due_date.value = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
}

init();
})();
 
