// ═══════════════════════════════════════════════
//  CONSTANTS & DEFAULTS
// ═══════════════════════════════════════════════
const CAT_COLORS_MAPPING = {
  'Entertainment': '#185FA5', 'Fast Food': '#1D9E75', 'Grocery': '#D85A30', 'Home Improvement': '#BA7517',
  'Travel': '#534AB7', 'Fuel': '#3B6D11', 'Dress': '#993C1D', 'Rent / Bills': '#D4537E',
  'Salary Income': '#0F6E56', 'Business Income': '#2a7a8a', 'Medical': '#b83b5e', 'Education': '#6a2c70', 
  'Gift': '#f08a5d', 'Other': '#95a5a6'
};
const CAT_COLORS_ARRAY = ['#185FA5','#1D9E75','#D85A30','#BA7517','#534AB7','#3B6D11','#993C1D','#D4537E','#0F6E56','#963C00','#2a7a8a','#7b3fa0'];

const CAT_EMOJI = {
  'Entertainment':'🎬','Fast Food':'🍔','Grocery':'🛒','Home Improvement':'🏠',
  'Travel':'✈️','Fuel':'⛽','Dress':'👗','Rent / Bills':'🏢',
  'Salary Income':'💼','Business Income':'📊','Medical':'💊','Education':'📚','Gift':'🎁','Other':'📦'
};

const DEFAULT_EXPENSE_CATS = ['Entertainment','Fast Food','Grocery','Home Improvement','Travel','Fuel','Dress','Rent / Bills','Medical','Education','Gift','Other'];
const DEFAULT_INCOME_CATS = ['Salary Income','Business Income'];
const BOOK_EMOJIS = ['📒','📓','📔','📕','📗','📘','📙','💼','🏦','🏪','🏠','✈️'];

function catEmoji(n){ return CAT_EMOJI[n] || '📦'; }
function catColor(n, index = 0){ return CAT_COLORS_MAPPING[n] || CAT_COLORS_ARRAY[index % CAT_COLORS_ARRAY.length]; }
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
//  PERSISTENCE
// ═══════════════════════════════════════════════
function save(){ try{localStorage.setItem('fp_v2',JSON.stringify(S));}catch(e){} }
function load(){ try{const raw=localStorage.getItem('fp_v2');if(raw){const d=JSON.parse(raw);Object.assign(S,d);}}catch(e){} }

// ═══════════════════════════════════════════════
//  AUTH MANAGEMENT
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

function getUsers(){ try{return JSON.parse(localStorage.getItem('fp_users')||'[]');}catch{return [];} }
function saveUsers(u){localStorage.setItem('fp_users',JSON.stringify(u));}
function hashPassword(v){ let h=0; for(let i=0;i<v.length;i++){ h=((h<<5)-h)+v.charCodeAt(i); h|=0;} return 'h'+Math.abs(h); }

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
    const user={id:uid(),email,name,password:hashPassword(pass),initials:name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()};
    users.push(user);saveUsers(users);
    loginUser(user);
  } else {
    const user=users.find(u=>u.email===email&&u.password===hashPassword(pass));
    if(!user){err.textContent='Invalid email or password.';err.style.display='block';return;}
    loginUser(user);
  }
}

function handleGoogleAuth(){
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
  const key='fp_data_'+user.id;
  try{const raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw);Object.assign(S,d);}}catch{}
  S.user={id:user.id,name:user.name,email:user.email,initials:user.initials||'U'};
  if(!S.books||!S.books.length){
    const book={id:uid(),name:'My Book',emoji:'📒',ownerId:user.id,members:[{userId:user.id,email:user.email,name:user.name,role:'owner'}]};
    S.books=[book]; S.currentBookId=book.id;
    S.categories[book.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
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
}

function continueAsGuest(){
  S.isGuest=true;
  if(!S.books || !S.books.length){
    const guestBook={id:'guest-book',name:'Demo Book',emoji:'📒',ownerId:'guest',members:[]};
    S.books=[guestBook]; S.currentBookId=guestBook.id;
    S.categories[guestBook.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
    S.transactions=[];
  }
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent='👁';
  document.getElementById('headerBookName').textContent='Guest Mode';
  document.getElementById('headerBookIcon').textContent='👀';
  renderMonthTabs();showPage('dashboard');
}

function logout(){
  S.isGuest=false;
  saveUserData();
  S={user:null,isGuest:false,books:[],currentBookId:null,transactions:[],categories:{},currentMonth:today().slice(0,7),currentPage:'dashboard'};
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
}
function guestBlocked(){ if(S.isGuest){ toast('Please login to continue'); return true; } return false; }
function saveUserData(){ if(!S.user)return; localStorage.setItem('fp_data_'+S.user.id,JSON.stringify({books:S.books,currentBookId:S.currentBookId,transactions:S.transactions,categories:S.categories,currentMonth:S.currentMonth}));}

// ═══════════════════════════════════════════════
//  BOOKS MANAGEMENT ENGINE
// ═══════════════════════════════════════════════
function currentBook(){return S.books.find(b=>b.id===S.currentBookId)||S.books[0]||{name:'My Book',emoji:'📒'};}
function bookTxns(bookId,month){return S.transactions.filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){
  if(!S.categories) S.categories={};
  if(!S.categories[bookId]) S.categories[bookId]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
  if(type) return S.categories[bookId][type] || [];
  return [...S.categories[bookId].expense, ...S.categories[bookId].income];
}

function openBooksSheet(){ document.getElementById('sheetBg').classList.add('open'); renderBooksSheet(); }
function closeSheetNow(){ document.getElementById('sheetBg').classList.remove('open'); }

function renderBooksSheet(){
  const items=S.books.map(b=>{
    const isOwner=b.ownerId===S.user?.id;
    const isShared=b.members.length>1;
    const isCurrent=b.id===S.currentBookId;
    return `<div class="book-item ${isCurrent?'current':''}" onclick="selectBook('${b.id}')">
      <div class="book-item-icon">${b.emoji}</div>
      <div class="book-item-body">
        <div class="book-item-name">${b.name}</div>
        <div class="book-item-meta">${b.members.length} members · ${isOwner?'Owner':'Member'}</div>
      </div>
      ${isShared?`<span class="book-badge shared-badge">Shared</span>`:''}
      ${isCurrent?`<span class="book-badge">Active</span>`:''}
    </div>`;
  }).join('');
  document.getElementById('sheetInner').innerHTML=`<div class="sheet-title">Your Books<button class="close-btn" onclick="closeSheetNow()">×</button></div>${items}<div class="divider"></div><button class="btn btn-primary" onclick="openAddBookSheet()">+ New Book</button>`;
}

function selectBook(id){
  S.currentBookId=id; const b=currentBook();
  document.getElementById('headerBookName').textContent=b.name;
  document.getElementById('headerBookIcon').textContent=b.emoji;
  saveUserData(); closeSheetNow(); renderMonthTabs(); showPage('dashboard');
}

function openAddBookSheet(){
  document.getElementById('sheetInner').innerHTML=`
    <div class="sheet-title">New Book <button class="close-btn" onclick="openBooksSheet()">×</button></div>
    <div class="form-group"><label class="form-label">Book Name</label><input class="form-input" id="newBookName" placeholder="e.g. Business..." /></div>
    <div class="form-group">
      <label class="form-label">Icon</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px" id="emojiPicker">
        ${BOOK_EMOJIS.map((e,i)=>`<div class="cat-chip ${i===0?'selected':''}" onclick="pickEmoji(this,'${e}')">${e}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary" onclick="createBook()">Create Book</button>
  `;
  window._newBookEmoji=BOOK_EMOJIS[0];
}

function pickEmoji(el,e){ document.querySelectorAll('#emojiPicker .cat-chip').forEach(c=>c.classList.remove('selected')); el.classList.add('selected'); window._newBookEmoji=e; }

function createBook(){
  if(guestBlocked()) return;
  const name=document.getElementById('newBookName').value.trim();
  if(!name){toast('Enter a book name');return;}
  const book={id:uid(),name,emoji:window._newBookEmoji||'📒',ownerId:S.user.id,members:[{userId:S.user.id,email:S.user.email,name:S.user.name,role:'owner'}]};
  S.books.push(book);
  S.categories[book.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
  S.currentBookId=book.id;
  document.getElementById('headerBookName').textContent=book.name;
  document.getElementById('headerBookIcon').textContent=book.emoji;
  saveUserData(); closeSheetNow(); renderMonthTabs(); showPage('dashboard');
}

// ═══════════════════════════════════════════════
//  NAVIGATION & RENDER CONTROLLER
// ═══════════════════════════════════════════════
function showPage(page){
  S.currentPage=page;
  ['dashboard','transactions','categories','profile'].forEach(p=>{
    const el = document.getElementById('nav'+p.charAt(0).toUpperCase()+p.slice(1));
    if(el) el.classList.toggle('active', p===page);
  });
  document.getElementById('fabBtn').style.display=page==='categories'||page==='profile'?'none':'flex';
  renderMonthTabs(); renderPage();
}

function renderMonthTabs(){
  const el=document.getElementById('monthScroll');
  if(!el || S.currentPage==='categories'||S.currentPage==='profile'){ if(el) el.innerHTML=''; return; }
  const allMonths=new Set([S.currentMonth]);
  (S.transactions||[]).filter(t=>t.bookId===S.currentBookId).forEach(t=>allMonths.add(monthKey(t.date)));
  const sorted=[...allMonths].sort().reverse().slice(0,12);
  el.innerHTML=sorted.map(m=>`<div class="month-chip ${m===S.currentMonth?'active':''}" onclick="selectMonth('${m}')">${monthLabel(m)}</div>`).join('');
}

function selectMonth(m){S.currentMonth=m;renderMonthTabs();renderPage();}

function renderPage(){
  const el=document.getElementById('pageContent');
  if(!el) return;
  if(S.currentPage==='dashboard') el.innerHTML=renderDashboard();
  else if(S.currentPage==='transactions') el.innerHTML=renderTransactions();
  else if(S.currentPage==='categories') el.innerHTML=renderCategoriesPage();
  else el.innerHTML=renderProfilePage();
}

// ═══════════════════════════════════════════════
//  DASHBOARD & CHART VIEW SYSTEM
// ═══════════════════════════════════════════════
function renderDashboard(){
  const txns=bookTxns(S.currentBookId,S.currentMonth);
  const totalIncome=txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=totalIncome-totalExpense;

  const cats=bookCats(S.currentBookId,'expense');
  const catMap={};
  txns.filter(t=>t.type==='expense').forEach(t=>{ catMap[t.category]=(catMap[t.category]||0)+t.amount; });
  const sorted=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const recent=[...txns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);

  const recentRows=recent.length ? recent.map(t=>{
    const idx=cats.indexOf(t.category);
    const col=catColor(t.category, idx);
    return `
    <div class="txn-item" onclick="openTxnSheet('${t.id}')">
      <div class="txn-icon" style="background:${col}22; color:${col}">${catEmoji(t.category)}</div>
      <div class="txn-body">
        <div class="txn-cat">${t.category}</div>
        <div class="txn-meta">${t.remark||t.date}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="empty-text">No transactions yet</div></div>`;

  // Safely defer layout calculation until content renders safely on parent container
  setTimeout(() => { if(sorted.length) renderExpenseChart(catMap); }, 50);

  return `
    <div class="summary-wrap">
      <div class="s-card"><div class="s-label">Income</div><div class="s-val income">${fmt(totalIncome)}</div></div>
      <div class="s-card"><div class="s-label">Expense</div><div class="s-val expense">${fmt(totalExpense)}</div></div>
      <div class="s-card balance-card">
        <div class="s-label">Balance — ${monthLabel(S.currentMonth)}</div>
        <div class="s-val ${balance>=0?'':'negative'}">${fmtSgn(balance)}</div>
      </div>
    </div>
    ${sorted.length ? `
    <div class="section">
      <div class="section-title">Expense Breakdown</div>
      <div style="position:relative; height:240px; margin:auto; max-width:300px;">
        <canvas id="expenseChart"></canvas>
      </div>
    </div>`:''}
    <div class="section">
      <div class="section-hdr"><div class="section-title">Recent Entries</div></div>
      ${recentRows}
    </div>`;
}

let expenseChartInstance=null;
function renderExpenseChart(catMap){
  const canvas=document.getElementById('expenseChart');
  if(!canvas) return;
  if(expenseChartInstance){ expenseChartInstance.destroy(); }

  const labels=Object.keys(catMap);
  const data=Object.values(catMap);
  const colors=labels.map((l, i) => catColor(l, i));

  expenseChartInstance=new Chart(canvas,{
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:1 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{ legend:{ position:'bottom' } } }
  });
}

function renderTransactions(){
  const txns=bookTxns(S.currentBookId,S.currentMonth).sort((a,b)=>b.date.localeCompare(a.date));
  const cats=bookCats(S.currentBookId,'expense');
  if(!txns.length) return `<div class="empty-state">No entries for ${monthLabel(S.currentMonth)}</div>`;
  return `<div class="section">${txns.map(t=>{
    const idx=cats.indexOf(t.category);
    const col=catColor(t.category, idx);
    return `<div class="txn-item" onclick="openTxnSheet('${t.id}')">
      <div class="txn-icon" style="background:${col}22">${catEmoji(t.category)}</div>
      <div class="txn-body">
        <div class="txn-cat">${t.category} <span class="badge ${t.type}">${t.type}</span></div>
        <div class="txn-meta">${t.remark || t.date}</div>
      </div>
      <div class="txn-right"><div class="txn-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div></div>
    </div>`;
  }).join('')}</div>`;
}

function renderCategoriesPage(){
  const expenseCats=bookCats(S.currentBookId,'expense');
  const incomeCats=bookCats(S.currentBookId,'income');

  const genRows = (arr, type) => arr.map((c,i)=> `
    <div class="manage-cat-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
      <span class="cat-name">${catEmoji(c)} ${c}</span>
      <button class="cat-menu-btn" onclick="toggleCatMenu(event,'${c}','${type}')">⋮</button>
    </div>`).join('');

  return `<div class="section">
    <div class="section-title">Expense Categories</div>${genRows(expenseCats, 'expense')}
    <div class="add-row" style="display:flex; gap:8px; margin-top:12px;"><input class="form-input" id="newExpenseCat" placeholder="Add expense..." /><button class="btn-sq" onclick="addCat('expense')">+</button></div>
    <hr style="margin:22px 0; border:none; border-top:1px solid #eee;">
    <div class="section-title">Income Categories</div>${genRows(incomeCats, 'income')}
    <div class="add-row" style="display:flex; gap:8px; margin-top:12px;"><input class="form-input" id="newIncomeCat" placeholder="Add income..." /><button class="btn-sq" onclick="addCat('income')">+</button></div>
  </div>`;
}

function addCat(type){
  if(guestBlocked()) return;
  const inp=document.getElementById(type==='income'?'newIncomeCat':'newExpenseCat');
  const n=inp?.value.trim(); if(!n){ return; }
  const id=S.currentBookId;
  if(S.categories[id][type].includes(n)){ return; }
  S.categories[id][type].push(n);
  inp.value=''; saveUserData(); renderPage();
}

function toggleCatMenu(e,c,type){
  e.stopPropagation(); closeAllCatMenus();
  const btn=e.currentTarget; const rect=btn.getBoundingClientRect();
  const menu=document.createElement('div');
  menu.id='activeCatMenu'; menu.style.position='fixed'; menu.style.top=(rect.bottom+6)+'px'; menu.style.left=Math.min(rect.left, window.innerWidth-150)+'px';
  menu.style.background='white'; menu.style.border='1px solid #ccc'; menu.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'; menu.style.borderRadius='4px';

  const delBtn=document.createElement('button'); delBtn.style.padding='8px 12px'; delBtn.style.background='none'; delBtn.style.border='none'; delBtn.style.color='red'; delBtn.innerHTML='🗑 Delete';
  delBtn.onclick=()=> { confirmDeleteCategory(c,type); };
  menu.appendChild(delBtn); document.body.appendChild(menu);
  setTimeout(()=>{ document.addEventListener('click', closeAllCatMenus, {once:true}); },50);
}
function closeAllCatMenus(){ const old=document.getElementById('activeCatMenu'); if(old) old.remove(); }

function confirmDeleteCategory(c,type){
  closeAllCatMenus(); if(guestBlocked()) return;
  if(!confirm(`Are you sure you want to delete "${c}"?`)) return;
  const id=S.currentBookId;
  S.categories[id][type]=S.categories[id][type].filter(x=>x!==c);
  saveUserData(); renderPage();
}

function renderProfilePage(){
  const u=S.user || {name:'Guest', initials:'G', email:'-'};
  return `<div class="profile-section" style="padding:15px; text-align:center;">
    <div class="profile-avatar" style="width:60px; height:60px; background:#185FA5; color:white; border-radius:50%; margin:auto; line-height:60px; font-weight:bold;">${u.initials}</div>
    <h3>${u.name}</h3><p>${u.email}</p>
    <button class="btn btn-danger" onclick="logout()" style="margin-top:20px;">Logout Securely</button>
  </div>`;
}

// Global initialization call on load
window.onload = function() { load(); };
