
// ═══════════════════════════════════════════════
//  CONSTANTS & DEFAULTS
// ═══════════════════════════════════════════════
const CAT_COLORS=['#185FA5','#1D9E75','#D85A30','#BA7517','#534AB7','#3B6D11','#993C1D','#D4537E','#0F6E56','#963C00','#2a7a8a','#7b3fa0'];
const CAT_EMOJI={
  'Entertainment':'🎬','Fast Food':'🍔','Grocery':'🛒','Home Improvement':'🏠',
  'Travel':'✈️','Fuel':'⛽','Dress':'👗','Rent / Bills':'🏢',
  'Salary':'💼','Freelance':'💻','Business':'📊','Investment':'📈',
  'Medical':'💊','Education':'📚','Gift':'🎁','Other':'📦'
};
// Expense Categories
const DEFAULT_EXPENSE_CATS=[
  'Entertainment',
  'Fast Food',
  'Grocery',
  'Home Improvement',
  'Travel',
  'Fuel',
  'Dress',
  'Rent / Bills',
  'Medical',
  'Education',
  'Gift',
  'Other'
];

// Income Categories
const DEFAULT_INCOME_CATS=[
  'Salary Income',
  'Business Income'
];
const BOOK_EMOJIS=['📒','📓','📔','📕','📗','📘','📙','💼','🏦','🏪','🏠','✈️'];

function catEmoji(n){return CAT_EMOJI[n]||n.charAt(0).toUpperCase();}
function fmt(n){return '₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});}
function fmtSgn(n){return (n>=0?'+':'-')+'₹'+Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function monthKey(d){return d.slice(0,7);}
function monthLabel(m){const[y,mo]=m.split('-');return new Date(+y,+mo-1,1).toLocaleString('default',{month:'short',year:'numeric'});}
function today(){return new Date().toISOString().slice(0,10);}

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let S={
  user:null,
  isGuest:false,

  books:[],
  currentBookId:null,

  transactions:[],

  categories:{},

  currentMonth:today().slice(0,7),
  currentPage:'dashboard'
};

// ═══════════════════════════════════════════════
//  PERSISTENCE (localStorage = device backup)
// ═══════════════════════════════════════════════
function save(){
  try{localStorage.setItem('fp_v2',JSON.stringify(S));}catch(e){}
}
function load(){
  try{
    const raw=localStorage.getItem('fp_v2');
    if(raw){const d=JSON.parse(raw);Object.assign(S,d);}
  }catch(e){}
}

// ═══════════════════════════════════════════════
//  AUTH (local accounts stored in localStorage)
//  In a real app, swap this for Firebase/Supabase
// ═══════════════════════════════════════════════
let authMode='login';
function switchAuthTab(m){
  authMode=m;
  document.getElementById('tabLogin').classList.toggle('active',m==='login');
  document.getElementById('tabReg').classList.toggle('active',m==='register');
  document.getElementById('nameGroup').style.display=m==='register'?'block':'none';
  document.getElementById('authSubmitBtn').textContent=m==='login'?'Sign In':'Create Account';
  document.getElementById('authErr').style.display='none';
}

function getUsers(){
  try{return JSON.parse(localStorage.getItem('fp_users')||'[]');}catch{return [];}
}
function saveUsers(u){localStorage.setItem('fp_users',JSON.stringify(u));}

function handleAuth(){
  const email=document.getElementById('fEmail').value.trim().toLowerCase();
  const pass=document.getElementById('fPassword').value;
  const name=document.getElementById('fName').value.trim();
  const err=document.getElementById('authErr');
  err.style.display='none';
  if(!email||!pass){err.textContent='Please fill in all fields.';err.style.display='block';return;}
  const users=getUsers();
  if(authMode==='register'){
    if(!name){err.textContent='Please enter your name.';err.style.display='block';return;}
    if(users.find(u=>u.email===email)){err.textContent='Email already registered.';err.style.display='block';return;}
    if(pass.length<6){err.textContent='Password must be at least 6 characters.';err.style.display='block';return;}
    const user={id:uid(),email,name,password:btoa(pass),initials:name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()};
    users.push(user);saveUsers(users);
    loginUser(user);
  } else {
    const user=users.find(u=>u.email===email&&u.password===btoa(pass));
    if(!user){err.textContent='Invalid email or password.';err.style.display='block';return;}
    loginUser(user);
  }
}

function handleGoogleAuth(){
  // Simulate Google OAuth — in prod, integrate Firebase Auth
  const email=prompt('Enter your Gmail address:','');
  if(!email||!email.includes('@'))return;
  const users=getUsers();
  let user=users.find(u=>u.email===email.toLowerCase());
  if(!user){
    const name=email.split('@')[0];
    user={id:uid(),email:email.toLowerCase(),name,password:'',initials:name.slice(0,2).toUpperCase(),google:true};
    users.push(user);saveUsers(users);
  }
  loginUser(user);
}

function loginUser(user){
  // Merge any data for this user
  const key='fp_data_'+user.id;
  try{
    const raw=localStorage.getItem(key);
    if(raw){const d=JSON.parse(raw);Object.assign(S,d);}
  }catch{}
  S.user={id:user.id,name:user.name,email:user.email,initials:user.initials||'U'};
  // Ensure default book exists
  if(!S.books||!S.books.length){
    const book={id:uid(),name:'My Book',emoji:'📒',ownerId:user.id,members:[{userId:user.id,email:user.email,name:user.name,role:'owner'}]};
    S.books=[book];
    S.currentBookId=book.id;
S.categories[book.id]={
  expense:[...DEFAULT_EXPENSE_CATS],
  income:[...DEFAULT_INCOME_CATS]
};
    S.transactions=S.transactions||[];
  }
  if(!S.currentBookId)S.currentBookId=S.books[0].id;
  save();
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent=S.user.initials;
  document.getElementById('headerBookName').textContent=currentBook().name;
  document.getElementById('headerBookIcon').textContent=currentBook().emoji;
  renderMonthTabs();showPage('dashboard');
  toast('Welcome back, '+S.user.name.split(' ')[0]+'! 👋');
}


  // Create temporary view-only book
  if(!S.books || !S.books.length){

    const guestBook={
      id:'guest-book',
      name:'Demo Book',
      emoji:'📒',
      ownerId:'guest',
      members:[]
    };

    S.books=[guestBook];
    S.currentBookId=guestBook.id;

 S.categories[guestBook.id]={
  expense:[
    ...DEFAULT_EXPENSE_CATS
  ],
  income:[
    ...DEFAULT_INCOME_CATS
  ]
};

    S.transactions=[];
  }
  document
    .getElementById('authScreen')
    .classList.remove('active');

  document
    .getElementById('mainScreen')
    .classList.add('active');

  document
    .getElementById('userAvatar')
    .textContent='👁';

  document
    .getElementById('headerBookName')
    .textContent='Guest Mode';

  document
    .getElementById('headerBookIcon')
    .textContent='👀';

  renderMonthTabs();
  showPage('dashboard');

  toast('Guest Mode — View Only');
}
  return false;
}
function logout(){

  S.isGuest=false;

  saveUserData();

  S={
    user:null,
    isGuest:false,
    books:[],
    currentBookId:null,
    transactions:[],
    categories:{},
    currentMonth:today().slice(0,7),
    currentPage:'dashboard'
  };

  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
  closeSheetNow();
}
function guestBlocked(){

  if(S.isGuest){
    toast('Please login to continue');
    return true;
  }

  return false;
}
function saveUserData(){
  if(!S.user)return;
  const key='fp_data_'+S.user.id;
  localStorage.setItem(key,JSON.stringify({books:S.books,currentBookId:S.currentBookId,transactions:S.transactions,categories:S.categories,currentMonth:S.currentMonth}));
}

// ═══════════════════════════════════════════════
//  BOOKS
// ═══════════════════════════════════════════════
function currentBook(){return S.books.find(b=>b.id===S.currentBookId)||S.books[0];}
function bookTxns(bookId,month){return S.transactions.filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){

  if(!S.categories){
    S.categories={};
  }

  if(!S.categories[bookId]){

    S.categories[bookId]={
      expense:[
        ...DEFAULT_EXPENSE_CATS
      ],
      income:[
        ...DEFAULT_INCOME_CATS
      ]
    };
  }

  if(type){
    return (
      S.categories[bookId][type]
      || []
    );
  }

  return [
    ...S.categories[bookId]
      .expense,
    ...S.categories[bookId]
      .income
  ];
}

function openBooksSheet(){
  document.getElementById('sheetBg').classList.add('open');
  renderBooksSheet();
}

function renderBooksSheet(){
  const items=S.books.map(b=>{
    const isOwner=b.ownerId===S.user.id;
    const isShared=b.members.length>1;
    const isCurrent=b.id===S.currentBookId;
    return `<div class="book-item ${isCurrent?'current':''}" onclick="selectBook('${b.id}')">
      <div class="book-item-icon" style="background:${isCurrent?'#185FA520':'var(--surface)'};border:1.5px solid var(--border)">${b.emoji}</div>
      <div class="book-item-body">
        <div class="book-item-name">${b.name}</div>
        <div class="book-item-meta">${b.members.length} member${b.members.length>1?'s':''} · ${isOwner?'Owner':'Member'}</div>
      </div>
      ${isShared?`<span class="book-badge shared-badge">Shared</span>`:''}
      ${isCurrent?`<span class="book-badge">Active</span>`:''}
    </div>`;
  }).join('');

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Your Books
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    ${items}
    <div class="divider"></div>
    <button class="btn btn-primary" onclick="openAddBookSheet()" style="margin-bottom:8px">+ New Book</button>
    <button class="btn btn-outline" onclick="openJoinBookSheet()">Join Shared Book</button>
  `;
}

function selectBook(id){
  S.currentBookId=id;
  const b=currentBook();
  document.getElementById('headerBookName').textContent=b.name;
  document.getElementById('headerBookIcon').textContent=b.emoji;
  saveUserData();
  closeSheetNow();
  renderMonthTabs();showPage('dashboard');
}

function openAddBookSheet(){
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">New Book
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">Book Name</label>
      <input class="form-input" id="newBookName" placeholder="e.g. Business, Family, Travel..." />
    </div>
    <div class="form-group">
      <label class="form-label">Icon</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px" id="emojiPicker">
        ${BOOK_EMOJIS.map((e,i)=>`<div class="cat-chip ${i===0?'selected':''}" style="font-size:20px;padding:8px;justify-content:center" onclick="pickEmoji(this,'${e}')">${e}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary" onclick="createBook()" style="margin-top:8px">Create Book</button>
  `;
  window._newBookEmoji=BOOK_EMOJIS[0];
}

function pickEmoji(el,e){
  document.querySelectorAll('#emojiPicker .cat-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');window._newBookEmoji=e;
}

function createBook(){
  if(guestBlocked()) return;
  const name=document.getElementById('newBookName').value.trim();
  if(!name){toast('Enter a book name');return;}
  const book={id:uid(),name,emoji:window._newBookEmoji||'📒',ownerId:S.user.id,members:[{userId:S.user.id,email:S.user.email,name:S.user.name,role:'owner'}]};
  S.books.push(book);
 S.categories[book.id]={
  expense:[...DEFAULT_EXPENSE_CATS],
  income:[...DEFAULT_INCOME_CATS]
};
  S.currentBookId=book.id;
  document.getElementById('headerBookName').textContent=book.name;
  document.getElementById('headerBookIcon').textContent=book.emoji;
  saveUserData();closeSheetNow();
  renderMonthTabs();showPage('dashboard');
  toast('Book "'+name+'" created ✓');
}

function openJoinBookSheet(){
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Join a Shared Book
      <button class="close-btn" onclick="openBooksSheet()">×</button>
    </div>
    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">Ask the book owner to share their Book ID with you, then enter it below.</p>
    <div class="form-group">
      <label class="form-label">Book ID</label>
      <input class="form-input" id="joinBookId" placeholder="Paste book ID here..." />
    </div>
    <button class="btn btn-primary" onclick="joinBook()">Join Book</button>
  `;
}

function joinBook(){
  if(guestBlocked()) return;
  const id=document.getElementById('joinBookId').value.trim();
  // Scan all user data for this book ID
  const users=getUsers();
  let found=null;let foundOwnerKey=null;
  for(const u of users){
    try{
      const d=JSON.parse(localStorage.getItem('fp_data_'+u.id)||'{}');
      const b=(d.books||[]).find(b=>b.id===id);
      if(b){found=b;foundOwnerKey='fp_data_'+u.id;break;}
    }catch{}
  }
  if(!found){toast('Book not found. Check the ID.');return;}
  if(found.members.find(m=>m.userId===S.user.id)){toast('You are already a member!');return;}
  // Add self to members
  found.members.push({userId:S.user.id,email:S.user.email,name:S.user.name,role:'member'});
  // Update owner's data
  try{
    const d=JSON.parse(localStorage.getItem(foundOwnerKey)||'{}');
    const bi=d.books.findIndex(b=>b.id===id);
    if(bi>=0)d.books[bi]=found;
    localStorage.setItem(foundOwnerKey,JSON.stringify(d));
  }catch{}
  // Add to own books
  S.books.push(found);
 if(!S.categories[found.id]){

  S.categories[found.id]={
    expense:[...DEFAULT_EXPENSE_CATS],
    income:[...DEFAULT_INCOME_CATS]
  };
}
  S.currentBookId=found.id;
  document.getElementById('headerBookName').textContent=found.name;
  document.getElementById('headerBookIcon').textContent=found.emoji;
  saveUserData();closeSheetNow();
  renderMonthTabs();showPage('dashboard');
  toast('Joined "'+found.name+'" ✓');
}

// ═══════════════════════════════════════════════
//  SHARE / INVITE MEMBERS
// ═══════════════════════════════════════════════
function openShareSheet(){
  if(guestBlocked()) return;
  const book=currentBook();
  const isOwner=book.ownerId===S.user.id;
  const members=book.members.map(m=>`
    <div class="member-row">
      <div class="member-avatar">${(m.name||m.email).slice(0,2).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${m.name||'Unknown'}</div>
        <div class="member-email">${m.email}</div>
      </div>
      <span class="member-role ${m.role==='owner'?'role-owner':'role-member'}">${m.role}</span>
      ${isOwner&&m.userId!==S.user.id?`<button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;margin-left:6px" onclick="removeMember('${m.userId}')">×</button>`:''}
    </div>`).join('');

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">Share Book
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px;font-weight:600">BOOK ID (share this)</div>
      <div style="font-size:13px;font-weight:700;color:var(--blue);letter-spacing:1px;word-break:break-all">${book.id}</div>
      <button class="btn btn-outline" style="margin-top:8px;padding:7px" onclick="copyBookId('${book.id}')">Copy ID</button>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:8px">Members</div>
    ${members}
    ${isOwner?`
    <div class="divider"></div>
    <div class="form-group">
      <label class="form-label">Invite by Email</label>
      <div class="add-row">
        <input class="form-input" id="inviteEmail" type="email" placeholder="friend@gmail.com"/>
        <button class="btn-sq" onclick="inviteByEmail()">+</button>
      </div>
    </div>`:''}
  `;
  document.getElementById('sheetBg').classList.add('open');
}

function copyBookId(id){
  try{navigator.clipboard.writeText(id);toast('Book ID copied!');}
  catch{prompt('Copy this Book ID:',id);}
}

function inviteByEmail(){
  const email=document.getElementById('inviteEmail').value.trim().toLowerCase();
  if(!email)return;
  const users=getUsers();
  const invitedUser=users.find(u=>u.email===email);
  if(!invitedUser){toast('User not found. They must register first.');return;}
  const book=currentBook();
  if(book.members.find(m=>m.userId===invitedUser.id)){toast('Already a member!');return;}
  book.members.push({userId:invitedUser.id,email:invitedUser.email,name:invitedUser.name,role:'member'});
  // Also add book to invited user's data
  try{
    const key='fp_data_'+invitedUser.id;
    const d=JSON.parse(localStorage.getItem(key)||'{}');
    if(!d.books)d.books=[];
    if(!d.books.find(b=>b.id===book.id)){
      d.books.push(book);
      if(!d.categories)d.categories={};
      d.categories[book.id]=bookCats(book.id);
    }
    localStorage.setItem(key,JSON.stringify(d));
  }catch{}
  saveUserData();
  toast(invitedUser.name+' added ✓');
  openShareSheet();
}

function removeMember(userId){
  if(guestBlocked()) return;
  const book=currentBook();
  book.members=book.members.filter(m=>m.userId!==userId);
  saveUserData();
  toast('Member removed');
  openShareSheet();
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
function showPage(page){
  S.currentPage=page;
  ['dashboard','transactions','categories','profile'].forEach(p=>{
    document.getElementById('nav'+p.charAt(0).toUpperCase()+p.slice(1)).classList.toggle('active',p===page);
  });
  document.getElementById('fabBtn').style.display=page==='categories'||page==='profile'?'none':'flex';
  renderMonthTabs();renderPage();
}

function renderMonthTabs(){
  const el=document.getElementById('monthScroll');
  if(S.currentPage==='categories'||S.currentPage==='profile'){el.innerHTML='';return;}
  const allMonths=new Set([S.currentMonth]);
  (S.transactions||[]).filter(t=>t.bookId===S.currentBookId).forEach(t=>allMonths.add(monthKey(t.date)));
  const sorted=[...allMonths].sort().reverse().slice(0,12);
  el.innerHTML=sorted.map(m=>`<div class="month-chip ${m===S.currentMonth?'active':''}" onclick="selectMonth('${m}')">${monthLabel(m)}</div>`).join('');
}

function selectMonth(m){S.currentMonth=m;renderMonthTabs();renderPage();}

// ═══════════════════════════════════════════════
//  RENDER PAGES
// ═══════════════════════════════════════════════
function renderPage(){
  const el=document.getElementById('pageContent');
  if(S.currentPage==='dashboard')el.innerHTML=renderDashboard();
  else if(S.currentPage==='transactions')el.innerHTML=renderTransactions();
  else if(S.currentPage==='categories')el.innerHTML=renderCategoriesPage();
  else el.innerHTML=renderProfilePage();
}

function renderDashboard(){
  const txns=bookTxns(S.currentBookId,S.currentMonth);

  const totalIncome=txns
    .filter(t=>t.type==='income')
    .reduce((s,t)=>s+t.amount,0);

  const totalExpense=txns
    .filter(t=>t.type==='expense')
    .reduce((s,t)=>s+t.amount,0);

  const balance=totalIncome-totalExpense;

  const cats=bookCats(
  S.currentBookId,
  _txnType
);
  const catMap={};

  txns
    .filter(t=>t.type==='expense')
    .forEach(t=>{
      catMap[t.category]=(catMap[t.category]||0)+t.amount;
    });

  const sorted=Object.entries(catMap)
    .sort((a,b)=>b[1]-a[1]);

  const recent=[...txns]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,6);

  const recentRows=recent.length
  ? recent.map(t=>{
      const idx=cats.indexOf(t.category);
      const col=CAT_COLORS[idx>=0?idx%CAT_COLORS.length:0];

      return `
      <div class="txn-item" onclick="openTxnSheet('${t.id}')">
        <div class="txn-icon" style="background:${col}22">
          ${catEmoji(t.category)}
        </div>

        <div class="txn-body">
          <div class="txn-cat">${t.category}</div>
          <div class="txn-meta">${t.remark||t.date}</div>
        </div>

        <div class="txn-right">
          <div class="txn-amt ${t.type}">
            ${t.type==='income'?'+':'-'}${fmt(t.amount)}
          </div>
          <div class="txn-date">${t.date}</div>
        </div>
      </div>`;
    }).join('')
  : `
  <div class="empty-state">
    <div class="empty-icon">📋</div>
    <div class="empty-text">
      No transactions yet
      <br>
      <small>Tap + to add your first entry</small>
    </div>
  </div>`;

  setTimeout(()=>{
    renderExpenseChart(catMap,totalExpense);
  },100);

  return `
    <div class="summary-wrap">
      <div class="s-card">
        <div class="s-label">Income</div>
        <div class="s-val income">${fmt(totalIncome)}</div>
      </div>

      <div class="s-card">
        <div class="s-label">Expense</div>
        <div class="s-val expense">${fmt(totalExpense)}</div>
      </div>

      <div class="s-card balance-card">
        <div class="s-label">
          Balance — ${monthLabel(S.currentMonth)}
        </div>

        <div class="s-val ${balance>=0?'':'negative'}">
          ${fmtSgn(balance)}
        </div>
      </div>
    </div>

    ${sorted.length ? `
    <div class="section">
      <div class="section-hdr">
        <div class="section-title">
          Expense Breakdown
        </div>
      </div>

      <div style="
        position:relative;
        height:280px;
        display:flex;
        justify-content:center;
        align-items:center;
      ">
        <canvas id="expenseChart"></canvas>

        <div id="chartCenterText"
          style="
            position:absolute;
            text-align:center;
            pointer-events:none;
          ">
          <div style="
            font-size:12px;
            color:var(--text2)">
            Total Expense
          </div>

          <div style="
            font-size:20px;
            font-weight:700">
            ${fmt(totalExpense)}
          </div>
        </div>
      </div>
    </div>`:''}

    <div class="section">
      <div class="section-hdr">
        <div class="section-title">
          Recent entries
        </div>

        <span class="see-all"
          onclick="showPage('transactions')">
          See all
        </span>
      </div>

      ${recentRows}
    </div>
  `;
}
let expenseChart=null;

function renderExpenseChart(catMap,totalExpense){

  const canvas=document.getElementById('expenseChart');
  if(!canvas) return;

  if(expenseChart){
    expenseChart.destroy();
  }

  const labels=Object.keys(catMap);
  const data=Object.values(catMap);

  expenseChart=new Chart(canvas,{
    type:'doughnut',

    data:{
      labels,
      datasets:[{
        data,
        backgroundColor:CAT_COLORS,
        borderWidth:0
      }]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false,

      cutout:'72%',

      plugins:{
        legend:{
          position:'bottom'
        }
      }
    }
  });
}

function renderTransactions(){
  const txns=bookTxns(S.currentBookId,S.currentMonth).sort((a,b)=>b.date.localeCompare(a.date));
  const cats=bookCats(S.currentBookId);
  if(!txns.length)return`<div class="empty-state" style="margin-top:40px"><div class="empty-icon">📭</div><div class="empty-text">No entries for ${monthLabel(S.currentMonth)}</div></div>`;
  const rows=txns.map(t=>{
    const idx=cats.indexOf(t.category);
    const col=CAT_COLORS[idx>=0?idx%CAT_COLORS.length:0];
    return`<div class="txn-item" onclick="openTxnSheet('${t.id}')">
      <div class="txn-icon" style="background:${col}22">${catEmoji(t.category)}</div>
      <div class="txn-body">
        <div class="txn-cat">${t.category} <span class="badge badge-${t.type}">${t.type}</span></div>
        <div class="txn-meta">${t.remark?'💬 '+t.remark:t.date}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
        <div class="txn-date">${t.date}</div>
      </div>
    </div>`;
  }).join('');
  return`<div class="section">${rows}</div>`;
}
function renderCategoriesPage(){

  const expenseCats=
    bookCats(
      S.currentBookId,
      'expense'
    );

  const incomeCats=
    bookCats(
      S.currentBookId,
      'income'
    );

  const expenseRows=
    expenseCats.map((c,i)=>`
    <div class="manage-cat-item">

      <div class="cat-dot"
      style="
      background:${CAT_COLORS[i%CAT_COLORS.length]};
      width:10px;
      height:10px">
      </div>

      <span class="cat-name">
        ${catEmoji(c)} ${c}
      </span>

      <div class="cat-menu-wrap">

        <button
          class="cat-menu-btn"
          onclick="toggleCatMenu(event,'${c}','expense')">
          ⋮
        </button>

      </div>
    </div>
  `).join('');

  const incomeRows=
    incomeCats.map((c,i)=>`
    <div class="manage-cat-item">

      <div class="cat-dot"
      style="
      background:${CAT_COLORS[i%CAT_COLORS.length]};
      width:10px;
      height:10px">
      </div>

      <span class="cat-name">
        ${catEmoji(c)} ${c}
      </span>

      <div class="cat-menu-wrap">

        <button
          class="cat-menu-btn"
          onclick="toggleCatMenu(event,'${c}','income')">
          ⋮
        </button>

      </div>
    </div>
  `).join('');

  return `
  <div class="section">

    <div class="section-title">
      Expense Categories
    </div>

    ${expenseRows}

    <div class="add-row" style="margin-top:12px">
      <input
        class="form-input"
        id="newExpenseCat"
        placeholder="Add expense category"
      />

      <button
        class="btn-sq"
        onclick="addCat('expense')">
        +
      </button>
    </div>

    <hr style="margin:22px 0">

    <div class="section-title">
      Income Categories
    </div>

    ${incomeRows}

    <div class="add-row" style="margin-top:12px">
      <input
        class="form-input"
        id="newIncomeCat"
        placeholder="Add income category"
      />

      <button
        class="btn-sq"
        onclick="addCat('income')">
        +
      </button>
    </div>

  </div>`;
}
function deleteCat(c,type){

  if(guestBlocked()) return;

  const id=S.currentBookId;

  S.categories[id][type] =
    S.categories[id][type]
      .filter(x=>x!==c);

  saveUserData();
  renderPage();

  toast('Category removed');
}
function addCat(type){

  if(guestBlocked()) return;

  const inp=document.getElementById(
    type==='income'
    ? 'newIncomeCat'
    : 'newExpenseCat'
  );

  const n=inp.value.trim();

  if(!n){
    toast('Enter category name');
    return;
  }

  const id=S.currentBookId;

  if(!S.categories[id]){
    S.categories[id]={
      expense:[...DEFAULT_EXPENSE_CATS],
      income:[...DEFAULT_INCOME_CATS]
    };
  }

  if(S.categories[id][type].includes(n)){
    toast('Category already exists');
    return;
  }

  S.categories[id][type].push(n);

  inp.value='';

  saveUserData();
  renderPage();

  toast(n+' added ✓');
}
function toggleCatMenu(e,c,type){

  e.stopPropagation();

  closeAllCatMenus();

  const btn=e.currentTarget;
  const rect=btn.getBoundingClientRect();

  const menu=document.createElement('div');
  menu.className='cat-popup-menu';
  menu.id='activeCatMenu';

  const renameBtn=document.createElement('button');
  renameBtn.className='cat-popup-item';
  renameBtn.innerHTML='✏️ Rename Category';

  renameBtn.addEventListener('click',function(ev){
    ev.stopPropagation();
    renameCategory(c,type);
  });

  const deleteBtn=document.createElement('button');
  deleteBtn.className='cat-popup-item delete';
  deleteBtn.innerHTML='🗑 Delete Category';

  deleteBtn.addEventListener('click',function(ev){
    ev.stopPropagation();
    confirmDeleteCategory(c,type);
  });

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  menu.style.top=
    (rect.bottom+6)+'px';

  const left=Math.min(
    rect.left,
    window.innerWidth-180
  );

  menu.style.left=
    left+'px';

  setTimeout(()=>{
    document.addEventListener(
      'click',
      closeAllCatMenus,
      {once:true}
    );
  },50);
}
function closeAllCatMenus(){

  const old=
    document.getElementById(
      'activeCatMenu'
    );

  if(old) old.remove();
}

function confirmDeleteCategory(c,type){

  closeAllCatMenus();

  const hasTransactions=
    S.transactions.some(t=>
      t.bookId===
      S.currentBookId &&
      t.category===c
    );

  let msg=
`Type "${c}" to confirm deletion`;

  if(hasTransactions){

    msg=
`⚠ Category contains transactions.

Type "${c}" to delete permanently`;
  }

  const entered=
    prompt(msg);

  if(
    entered===null
  ) return;

  if(
    entered.trim()!==c
  ){
    toast(
      'Category name mismatch'
    );
    return;
  }

  const bookId=
    S.currentBookId;

  if(
    !S.categories[bookId] ||
    !S.categories[bookId][type]
  ){
    toast('Category error');
    return;
  }

  S.categories[bookId][type]=
    S.categories[bookId][type]
      .filter(
        item=>item!==c
      );

  saveUserData();
  renderPage();

  toast(
    c+' deleted ✓'
  );
}

function renameCategory(c,type){

  closeAllCatMenus();

  const newName=prompt(
    'Rename category',
    c
  );

  if(
    !newName ||
    !newName.trim()
  ) return;

  const cleanName=
    newName.trim();

  if(cleanName===c)
    return;

  const bookId=
    S.currentBookId;

  if(
    !S.categories[bookId] ||
    !S.categories[bookId][type]
  ){
    toast('Category error');
    return;
  }

  const cats=
    S.categories[bookId][type];

  if(
    cats.includes(cleanName)
  ){
    toast(
      'Category already exists'
    );
    return;
  }

  const index=
    cats.indexOf(c);

  if(index===-1){
    toast('Category not found');
    return;
  }

  cats[index]=cleanName;

  // update old transactions
  S.transactions.forEach(t=>{

    if(
      t.bookId===bookId &&
      t.category===c
    ){
      t.category=
        cleanName;
    }
  });

  saveUserData();
  renderPage();

  toast(
    'Category renamed ✓'
  );
}
function renderProfilePage(){
  const u=S.user;
  const book=currentBook();
  const totalTxns=S.transactions.filter(t=>t.bookId===S.currentBookId).length;
  return`<div class="profile-section">
    <div class="profile-card">
      <div class="profile-head">
        <div class="profile-avatar">${u.initials||'U'}</div>
        <div>
          <div class="profile-name">${u.name}</div>
          <div class="profile-email">${u.email}</div>
        </div>
      </div>
      <div class="info-row"><span class="label">Active Book</span><span class="value">${book.emoji} ${book.name}</span></div>
      <div class="info-row"><span class="label">Total books</span><span class="value">${S.books.length}</span></div>
      <div class="info-row"><span class="label">Entries (this book)</span><span class="value">${totalTxns}</span></div>
      <div class="info-row"><span class="label">Backup</span><span class="value"><span class="sync-status"><span class="sync-dot"></span>Saved locally</span></span></div>
    </div>
    <div class="profile-card">
  <div class="section-title" style="margin-bottom:12px">Book Options</div>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="openShareSheet()">
    👥 Share / Invite Members
  </button>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="openBooksSheet()">
    📚 Switch / Manage Books
  </button>

  <button class="btn btn-outline" style="margin-bottom:8px" onclick="exportCSV()">
    📤 Export as CSV
  </button>

  <button class="btn btn-primary" onclick="exportPDF()">
    📄 Export as PDF
  </button>
</div>
    <div class="profile-card">
      <button class="btn btn-danger" onclick="confirmLogout()">Sign Out</button>
    </div>
  </div>`;
}

function confirmLogout(){
  if(confirm('Sign out of Fiberplane?'))logout();
}

// ═══════════════════════════════════════════════
//  TRANSACTION SHEET
// ═══════════════════════════════════════════════
let _txnType='expense';
let _selCat='';

function openTxnSheet(txnId){
  if(!requireLogin()) return;
  const ex=txnId?S.transactions.find(t=>t.id===txnId):null;
  _txnType=ex?ex.type:'expense';
  _selCat=ex?ex.category:'';
  const cats=bookCats(S.currentBookId);

  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">${ex?'Edit Entry':'Add Entry'}
      <button class="close-btn" onclick="closeSheetNow()">×</button>
    </div>
    <div class="type-toggle">
      <button class="type-btn ${_txnType==='income'?'active-income':''}" id="btnI" onclick="setTxnType('income')">↑ Income</button>
      <button class="type-btn ${_txnType==='expense'?'active-expense':''}" id="btnE" onclick="setTxnType('expense')">↓ Expense</button>
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹)</label>
      <input class="form-input" id="fAmt" type="number" inputmode="decimal" placeholder="0.00" value="${ex?ex.amount:''}" min="0" step="0.01"/>
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <div class="cat-grid" id="catGrid"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input class="form-input" id="fDate" type="date" value="${ex?ex.date:today()}"/>
    </div>
    <div class="form-group">
      <label class="form-label">Remark <span style="color:var(--text3)">(optional)</span></label>
      <input class="form-input" id="fRemark" type="text" placeholder="Add a note..." value="${ex?ex.remark||'':''}"/>
    </div>
    ${ex?`<button class="btn btn-danger" onclick="deleteTxn('${ex.id}')" style="margin-bottom:8px">Delete Entry</button>`:''}
    <button class="btn btn-primary" onclick="saveTxn('${txnId||''}')">Save Entry</button>
  `;
  renderCatGrid();
  document.getElementById('sheetBg').classList.add('open');
  setTimeout(()=>{try{document.getElementById('fAmt').focus();}catch{}},300);
}

function renderCatGrid(){

  const grid=document.getElementById('catGrid');
  if(!grid) return;

  const cats=bookCats(
    S.currentBookId,
    _txnType
  );

  grid.innerHTML=cats.map(c=>`
    <div class="cat-chip
      ${_selCat===c?'selected':''}"
      onclick="selCat('${c}')">

      ${catEmoji(c)} ${c}
    </div>
  `).join('');
}
function selCat(c){_selCat=c;renderCatGrid();}
function setTxnType(t){

  _txnType=t;

  _selCat='';

  document.getElementById('btnI').className=
    'type-btn'+
    (t==='income'
    ?' active-income'
    :'');

  document.getElementById('btnE').className=
    'type-btn'+
    (t==='expense'
    ?' active-expense'
    :'');

  renderCatGrid();
}

function saveTxn(id){
  if(guestBlocked()) return;
  const amt=parseFloat(document.getElementById('fAmt').value);
  const date=document.getElementById('fDate').value;
  const remark=document.getElementById('fRemark').value.trim();
  if(!amt||amt<=0){toast('Enter a valid amount');return;}
  if(!_selCat){toast('Pick a category');return;}
  if(!date){toast('Pick a date');return;}
  if(id){
    const t=S.transactions.find(t=>t.id===id);
    if(t){Object.assign(t,{amount:amt,type:_txnType,category:_selCat,date,remark});}
  }else{
    S.transactions.push({id:uid(),bookId:S.currentBookId,type:_txnType,amount:amt,category:_selCat,date,remark,createdBy:S.user.id});
    const m=monthKey(date);
    if(m!==S.currentMonth){S.currentMonth=m;}
  }
  saveUserData();closeSheetNow();
  toast(id?'Entry updated ✓':'Entry saved ✓');
}

function deleteTxn(id){

  if(guestBlocked()) return;

  if(!confirm('Delete this entry?'))
    return;

  S.transactions=
    S.transactions.filter(
      t=>t.id!==id
    );

  saveUserData();
  closeSheetNow();

  toast('Entry deleted');
}

// ═══════════════════════════════════════════════
//  EXPORT CSV
// ═══════════════════════════════════════════════
function exportCSV(){
  const txns=S.transactions.filter(t=>t.bookId===S.currentBookId).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[['Date','Type','Category','Amount','Remark'],...txns.map(t=>[t.date,t.type,t.category,t.amount,t.remark||''])];
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='fiberplane_'+currentBook().name+'.csv';a.click();
  toast('CSV exported ✓');
}
function exportPDF(){

  const txns=S.transactions
    .filter(t=>t.bookId===S.currentBookId)
    .sort((a,b)=>a.date.localeCompare(b.date));

  if(!txns.length){
    toast('No transactions found');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc=new jsPDF();

  const book=currentBook();

  const totalIncome=txns
    .filter(t=>t.type==='income')
    .reduce((s,t)=>s+t.amount,0);

  const totalExpense=txns
    .filter(t=>t.type==='expense')
    .reduce((s,t)=>s+t.amount,0);

  const balance=totalIncome-totalExpense;

  doc.setFontSize(18);
  doc.text('Fiberplane Expense Report',14,15);

  doc.setFontSize(11);
  doc.text(`Book: ${book.name}`,14,25);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`,14,32);

  const money = n => {
  return 'Rs. ' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

doc.text(`Income: ${money(totalIncome)}`, 14, 42);
doc.text(`Expense: ${money(totalExpense)}`, 14, 49);
doc.text(
  `Balance: ${(balance < 0 ? '-' : '')}${money(Math.abs(balance))}`,
  14,
  56
);
  const rows=txns.map(t=>[
    t.date,
    t.type,
    t.category,
 'Rs. ' + Number(t.amount).toLocaleString('en-IN'),
    t.remark || '-'
  ]);

  doc.autoTable({
    startY:65,
    head:[[
      'Date',
      'Type',
      'Category',
      'Amount',
      'Remark'
    ]],
    body:rows,
    styles:{
      fontSize:9
    }
  });

  doc.save(`fiberplane-${book.name}.pdf`);

  toast('PDF exported');
}

// ═══════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════
function closeSheet(e){if(e.target===e.currentTarget)closeSheetNow();}
function closeSheetNow(){
  document.getElementById('sheetBg').classList.remove('open');
  renderMonthTabs();renderPage();
}

// ═══════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════
let _toastTimer;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════
load();
if(S.user){
  // Resume session
  const users=getUsers();
  const u=users.find(u=>u.id===S.user.id);
  if(u)loginUser(u);
}

