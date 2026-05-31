// Import Firebase core and specified software modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const DEFAULT_EXPENSE_CATS=[
  'Entertainment','Fast Food','Grocery','Home Improvement','Travel','Fuel','Dress','Rent / Bills','Medical','Education','Gift','Other'
];

const DEFAULT_INCOME_CATS=[
  'Salary Income','Business Income'
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
//  FIREBASE INITIALIZATION
// ═══════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyB3Yb3bpHVOts7vlojTznpa-_pslaSbOKU",
  authDomain: "expense-book-7e014.firebaseapp.com",
  databaseURL: "https://expense-book-7e014-default-rtdb.firebaseio.com",
  projectId: "expense-book-7e014",
  storageBucket: "expense-book-7e014.firebasestorage.app",
  messagingSenderId: "764188727542",
  appId: "1:764188727542:web:9d130d81b1bcbda229f4d7",
  measurementId: "G-E6J7SMQZH1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ═══════════════════════════════════════════════
//  STATE MANAGEMENT
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

// Listen globally for authentication session states
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    // User is logged into Firebase backend -> Load cloud profile data
    const userRef = ref(db, 'users/' + firebaseUser.uid);
    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const cloudData = snapshot.val();
        Object.assign(S, cloudData);
      } else {
        // Run fresh schema allocation for brand new profile structures
        setupNewUserSchema(firebaseUser);
      }
      setupUIAfterLogin();
    } catch (e) {
      toast("Error downloading profile data.");
    }
  } else {
    // Session is logged out completely
    showAuthScreen();
  }
});

function setupNewUserSchema(firebaseUser) {
  const generatedBookId = uid();
  const userName = firebaseUser.displayName || firebaseUser.email.split('@')[0];
  
  S.user = {
    id: firebaseUser.uid,
    name: userName,
    email: firebaseUser.email,
    initials: userName.slice(0,2).toUpperCase()
  };
  S.books = [{
    id: generatedBookId,
    name: 'My Book',
    emoji: '📒',
    ownerId: firebaseUser.uid,
    members: [{ userId: firebaseUser.uid, email: firebaseUser.email, name: userName, role: 'owner' }]
  }];
  S.currentBookId = generatedBookId;
  S.categories = {};
  S.categories[generatedBookId] = {
    expense: [...DEFAULT_EXPENSE_CATS],
    income: [...DEFAULT_INCOME_CATS]
  };
  S.transactions = [];
  save(); // Push initial state schema directly to cloud reference
}

function setupUIAfterLogin() {
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent = S.user.initials;
  document.getElementById('headerBookName').textContent = currentBook().name;
  document.getElementById('headerBookIcon').textContent = currentBook().emoji;
  renderMonthTabs();
  showPage('dashboard');
  toast('Welcome back, ' + S.user.name.split(' ')[0] + '! 👋');
}

function showAuthScreen() {
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
}

// ═══════════════════════════════════════════════
//  PERSISTENCE CORRECTION (Saves Directly to Cloud)
// ═══════════════════════════════════════════════
function save() {
  if (!S.user || S.isGuest) return;
  // Write the updated state variable directly to the Firebase Realtime Path
  set(ref(db, 'users/' + S.user.id), S)
    .catch((error) => console.error("Cloud synchronization failed: ", error));
}

function saveUserData() {
  save(); // Point local references to structural unified save execution
}

// ═══════════════════════════════════════════════
//  AUTHENTICATION CONTROLLERS (Firebase Integrated)
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

function handleAuth() {
  const email = document.getElementById('fEmail').value.trim().toLowerCase();
  const pass = document.getElementById('fPassword').value;
  const name = document.getElementById('fName').value.trim();
  const err = document.getElementById('authErr');
  err.style.display = 'none';

  if (!email || !pass) {
    err.textContent = 'Please fill in all fields.';
    err.style.display = 'block';
    return;
  }

  if (authMode === 'register') {
    if (!name) { err.textContent = 'Please enter your name.'; err.style.display = 'block'; return; }
    if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.style.display = 'block'; return; }
    
    createUserWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        // Store name field locally context temporarily before structural sync pipeline takes over
        userCredential.user.displayName = name; 
        setupNewUserSchema(userCredential.user);
      })
      .catch((error) => {
        err.textContent = error.message;
        err.style.display = 'block';
      });
  } else {
    signInWithEmailAndPassword(auth, email, pass)
      .catch((error) => {
        err.textContent = 'Invalid email or password security credentials.';
        err.style.display = 'block';
      });
  }
}

function handleGoogleAuth() {
  toast("Please use Standard Sign In/Registration details for secure storage.");
}

function continueAsGuest(){
  S.isGuest=true;
  if(!S.books || !S.books.length){
    const guestBook={id:'guest-book',name:'Demo Book',emoji:'📒',ownerId:'guest',members:[]};
    S.books=[guestBook];
    S.currentBookId=guestBook.id;
    S.categories[guestBook.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
    S.transactions=[];
  }
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  document.getElementById('userAvatar').textContent='👁';
  document.getElementById('headerBookName').textContent='Guest Mode';
  document.getElementById('headerBookIcon').textContent='👀';
  renderMonthTabs();showPage('dashboard');
  toast('Guest Mode — View Only');
}

function logout(){
  S.isGuest=false;
  signOut(auth).then(() => {
    S = { user:null, isGuest:false, books:[], currentBookId:null, transactions:[], categories:{}, currentMonth:today().slice(0,7), currentPage:'dashboard' };
    closeSheetNow();
  });
}

function guestBlocked(){
  if(S.isGuest){ toast('Please login to continue'); return true; }
  return false;
}

// ═══════════════════════════════════════════════
//  BOOKS SYSTEM MANAGEMENT
// ═══════════════════════════════════════════════
function currentBook(){return S.books.find(b=>b.id===S.currentBookId)||S.books[0];}
function bookTxns(bookId,month){return (S.transactions||[]).filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){
  if(!S.categories){ S.categories={}; }
  if(!S.categories[bookId]){
    S.categories[bookId]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] };
  }
  if(type){ return (S.categories[bookId][type] || []); }
  return [...S.categories[bookId].expense, ...S.categories[bookId].income];
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
  `;
}

function selectBook(id){
  S.currentBookId=id;
  const b=currentBook();
  document.getElementById('headerBookName').textContent=b.name;
  document.getElementById('headerBookIcon').textContent=b.emoji;
  save();
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
  S.categories[book.id]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] };
  S.currentBookId=book.id;
  document.getElementById('headerBookName').textContent=book.name;
  document.getElementById('headerBookIcon').textContent=book.emoji;
  save();closeSheetNow();
  renderMonthTabs();showPage('dashboard');
  toast('Book "'+name+'" created ✓');
}

// ═══════════════════════════════════════════════
//  NAVIGATION RENDERING
// ═══════════════════════════════════════════════
function showPage(page){
  S.currentPage=page;
  ['dashboard','transactions','categories','profile'].forEach(p=>{
    document.getElementById('nav'+p.charAt(0).toUpperCase()+p.slice(1)).classList.toggle('active',p===page);
  });
  const fab = document.getElementById('fabBtn');
  if(fab) fab.style.display=page==='categories'||page==='profile'?'none':'flex';
  renderMonthTabs();renderPage();
}

function renderMonthTabs(){
  const el=document.getElementById('monthScroll');
  if(!el) return;
  if(S.currentPage==='categories'||S.currentPage==='profile'){el.innerHTML='';return;}
  const allMonths=new Set([S.currentMonth]);
  (S.transactions||[]).filter(t=>t.bookId===S.currentBookId).forEach(t=>allMonths.add(monthKey(t.date)));
  const sorted=[...allMonths].sort().reverse().slice(0,12);
  el.innerHTML=sorted.map(m=>`<div class="month-chip ${m===S.currentMonth?'active':''}" onclick="selectMonth('${m}')">${monthLabel(m)}</div>`).join('');
}

function selectMonth(m){S.currentMonth=m;renderMonthTabs();renderPage();}

function renderPage(){
  const el=document.getElementById('pageContent');
  if(!el) return;
  if(S.currentPage==='dashboard')el.innerHTML=renderDashboard();
  else if(S.currentPage==='transactions')el.innerHTML=renderTransactions();
  else if(S.currentPage==='categories')el.innerHTML=renderCategoriesPage();
  else el.innerHTML=renderProfilePage();
}

function renderDashboard(){
  const txns=bookTxns(S.currentBookId,S.currentMonth);
  const totalIncome=txns.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense=txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=totalIncome-totalExpense;
  const cats=bookCats(S.currentBookId);
  const catMap={};

  txns.filter(t=>t.type==='expense').forEach(t=>{ catMap[t.category]=(catMap[t.category]||0)+t.amount; });
  const sorted=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const recent=[...txns].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);

  const recentRows=recent.length ? recent.map(t=>{
      const idx=cats.indexOf(t.category);
      const col=CAT_COLORS[idx>=0?idx%CAT_COLORS.length:0];
      return `
      <div class="txn-item" onclick="openTxnSheet('${t.id}')">
        <div class="txn-icon" style="background:${col}22">${catEmoji(t.category)}</div>
        <div class="txn-body">
          <div class="txn-cat">${t.category}</div>
          <div class="txn-meta">${t.remark||t.date}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
          <div class="txn-date">${t.date}</div>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No transactions yet<br><small>Tap + to add your first entry</small></div></div>`;

  requestAnimationFrame(()=>renderExpenseChart(catMap,totalExpense));

  return `
    <div class="summary-wrap">
      <div class="s-card"><div class="s-label">Income</div><div class="s-val income">${fmt(totalIncome)}</div></div>
      <div class="s-card"><div class="s-label">Expense</div><div class="s-val expense">${fmt(totalExpense)}</div></div>
      <div class="s-card balance-card"><div class="s-label">Balance — ${monthLabel(S.currentMonth)}</div><div class="s-val ${balance>=0?'':'negative'}">${fmtSgn(balance)}</div></div>
    </div>
    ${sorted.length ? `<div class="section"><div class="section-hdr"><div class="section-title">Expense Breakdown</div></div><div style="position:relative;height:280px;display:flex;justify-content:center;align-items:center;"><canvas id="expenseChart"></canvas><div id="chartCenterText" style="position:absolute;text-align:center;pointer-events:none;"><div style="font-size:12px;color:var(--text2)">Total Expense</div><div style="font-size:20px;font-weight:700">${fmt(totalExpense)}</div></div></div></div>`:''}
    <div class="section"><div class="section-hdr"><div class="section-title">Recent entries</div><span class="see-all" onclick="showPage('transactions')">See all</span></div>${recentRows}</div>
  `;
}

let expenseChart=null;
function renderExpenseChart(catMap,totalExpense){
  const canvas=document.getElementById('expenseChart');
  if(!canvas) return;
  if(expenseChart){ expenseChart.destroy(); }
  const labels=Object.keys(catMap);
  const data=Object.values(catMap);

  expenseChart=new Chart(canvas,{
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:CAT_COLORS, borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{ position:'bottom' } } }
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
  const expenseCats=bookCats(S.currentBookId,'expense');
  const incomeCats=bookCats(S.currentBookId,'income');

  const expenseRows=expenseCats.map((c,i)=>`<div class="manage-cat-item"><div class="cat-dot" style="background:${CAT_COLORS[i%CAT_COLORS.length]};width:10px;height:10px"></div><span class="cat-name">${catEmoji(c)} ${c}</span><div class="cat-menu-wrap"><button class="cat-menu-btn" onclick="toggleCatMenu(event,'${c}','expense')">⋮</button></div></div>`).join('');
  const incomeRows=incomeCats.map((c,i)=>`<div class="manage-cat-item"><div class="cat-dot" style="background:${CAT_COLORS[i%CAT_COLORS.length]};width:10px;height:10px"></div><span class="cat-name">${catEmoji(c)} ${c}</span><div class="cat-menu-wrap"><button class="cat-menu-btn" onclick="toggleCatMenu(event,'${c}','income')">⋮</button></div></div>`).join('');

  return `
  <div class="section">
    <div class="section-title">Expense Categories</div>${expenseRows}
    <div class="add-row" style="margin-top:12px"><input class="form-input" id="newExpenseCat" placeholder="Add expense category" /><button class="btn-sq" onclick="addCat('expense')">+</button></div>
    <hr style="margin:22px 0"><div class="section-title">Income Categories</div>${incomeRows}
    <div class="add-row" style="margin-top:12px"><input class="form-input" id="newIncomeCat" placeholder="Add income category" /><button class="btn-sq" onclick="addCat('income')">+</button></div>
  </div>`;
}

function addCat(type){
  if(guestBlocked()) return;
  const inp=document.getElementById(type==='income'?'newIncomeCat':'newExpenseCat');
  const n=inp.value.trim();
  if(!n){toast('Enter category name');return;}
  const id=S.currentBookId;
  if(!S.categories[id]){ S.categories[id]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] };}
  if(S.categories[id][type].includes(n)){toast('Category already exists');return;}
  S.categories[id][type].push(n);
  inp.value='';
  save(); renderPage();
  toast(n+' added ✓');
}

function renderProfilePage(){
  const u=S.user;
  const book=currentBook();
  const totalTxns=(S.transactions||[]).filter(t=>t.bookId===S.currentBookId).length;
  return`<div class="profile-section">
    <div class="profile-card">
      <div class="profile-head"><div class="profile-avatar">${u.initials||'U'}</div><div><div class="profile-name">${u.name}</div><div class="profile-email">${u.email}</div></div></div>
      <div class="info-row"><span class="label">Active Book</span><span class="value">${book.emoji} ${book.name}</span></div>
      <div class="info-row"><span class="label">Total books</span><span class="value">${S.books.length}</span></div>
      <div class="info-row"><span class="label">Entries (this book)</span><span class="value">${totalTxns}</span></div>
      <div class="info-row"><span class="label">Backup</span><span class="value"><span class="sync-status"><span class="sync-dot" style="background:#1d9e75"></span>Cloud Backed Up</span></span></div>
    </div>
    <div class="profile-card">
      <div class="section-title" style="margin-bottom:12px">Book Options</div>
      <button class="btn btn-outline" style="margin-bottom:8px" onclick="openBooksSheet()">📚 Switch / Manage Books</button>
    </div>
    <div class="profile-card"><button class="btn btn-danger" onclick="logout()">Sign Out</button></div>
  </div>`;
}

// Global exposure definitions for programmatic inline HTML event hooks
window.handleAuth = handleAuth;
window.handleGoogleAuth = handleGoogleAuth;
window.switchAuthTab = switchAuthTab;
window.continueAsGuest = continueAsGuest;
window.logout = logout;
window.selectBook = selectBook;
window.createBook = createBook;
window.openAddBookSheet = openAddBookSheet;
window.openBooksSheet = openBooksSheet;
window.pickEmoji = pickEmoji;
window.showPage = showPage;
window.selectMonth = selectMonth;
window.addCat = addCat;
