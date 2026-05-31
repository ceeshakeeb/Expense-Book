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

const DEFAULT_EXPENSE_CATS=['Entertainment','Fast Food','Grocery','Home Improvement','Travel','Fuel','Dress','Rent / Bills','Medical','Education','Gift','Other'];
const DEFAULT_INCOME_CATS=['Salary Income','Business Income'];
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

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    const userRef = ref(db, 'users/' + firebaseUser.uid);
    try {
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const cloudData = snapshot.val();
        Object.assign(S, cloudData);
        if(!S.transactions) S.transactions = [];
        if(!S.categories) S.categories = {};
      } else {
        setupNewUserSchema(firebaseUser);
      }
      setupUIAfterLogin();
    } catch (e) {
      toast("Error downloading data.");
    }
  } else {
    showAuthScreen();
  }
});

function setupNewUserSchema(firebaseUser) {
  const generatedBookId = uid();
  const userName = firebaseUser.displayName || firebaseUser.email.split('@')[0];
  
  S.user = { id: firebaseUser.uid, name: userName, email: firebaseUser.email, initials: userName.slice(0,2).toUpperCase() };
  S.books = [{
    id: generatedBookId, name: 'My Book', emoji: '📒', ownerId: firebaseUser.uid,
    members: [{ userId: firebaseUser.uid, email: firebaseUser.email, name: userName, role: 'owner' }]
  }];
  S.currentBookId = generatedBookId;
  S.categories = {};
  S.categories[generatedBookId] = { expense: [...DEFAULT_EXPENSE_CATS], income: [...DEFAULT_INCOME_CATS] };
  S.transactions = [];
  save();
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

function save() {
  if (!S.user || S.isGuest) return;
  set(ref(db, 'users/' + S.user.id), S).catch((e) => console.error("Cloud save failed: ", e));
}

// ═══════════════════════════════════════════════
//  AUTHENTICATION
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

  if (!email || !pass) { err.textContent = 'Please fill all fields.'; err.style.display = 'block'; return; }

  if (authMode === 'register') {
    if (!name) { err.textContent = 'Please enter your name.'; err.style.display = 'block'; return; }
    createUserWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        userCredential.user.displayName = name; 
        setupNewUserSchema(userCredential.user);
      })
      .catch((e) => { err.textContent = e.message; err.style.display = 'block'; });
  } else {
    signInWithEmailAndPassword(auth, email, pass).catch((e) => { err.textContent = 'Invalid credentials.'; err.style.display = 'block'; });
  }
}

function handleGoogleAuth() { toast("Please use email registration."); }
function continueAsGuest(){
  S.isGuest=true;
  const guestBook={id:'guest-book',name:'Demo Book',emoji:'📒',ownerId:'guest',members:[]};
  S.books=[guestBook]; S.currentBookId=guestBook.id;
  S.categories[guestBook.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
  S.transactions=[];
  setupUIAfterLogin();
}
function logout(){ S.isGuest=false; signOut(auth).then(() => { S = { user:null, isGuest:false, books:[], currentBookId:null, transactions:[], categories:{}, currentMonth:today().slice(0,7), currentPage:'dashboard' }; }); }
function guestBlocked(){ if(S.isGuest){ toast('Please login to continue'); return true; } return false; }
function toast(msg) { const t = document.getElementById('toast'); if(t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); } }

// ═══════════════════════════════════════════════
//  TRANSACTIONS SYSTEM CODE (The "+" Button)
// ═══════════════════════════════════════════════
function openTxnSheet(txnId = null) {
  const sheetBg = document.getElementById('sheetBg');
  const inner = document.getElementById('sheetInner');
  if (!sheetBg || !inner) return;

  const cats = bookCats(S.currentBookId);
  const existing = txnId ? S.transactions.find(t => t.id === txnId) : null;

  inner.innerHTML = `
    <div class="sheet-title">${existing ? 'Edit Entry' : 'Add New Entry'} <button class="close-btn" onclick="window.closeSheetNow()">×</button></div>
    <div class="form-group">
      <label class="form-label">Type</label>
      <select class="form-input" id="txnType" onchange="window.updateTxnCatDropdown()">
        <option value="expense" ${existing?.type === 'expense' ? 'selected' : ''}>Expense (-)</option>
        <option value="income" ${existing?.type === 'income' ? 'selected' : ''}>Income (+)</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Amount (₹)</label>
      <input class="form-input" id="txnAmount" type="number" placeholder="0.00" value="${existing ? existing.amount : ''}" />
    </div>
    <div class="form-group">
      <label class="form-label">Category</label>
      <select class="form-input" id="txnCategory"></select>
    </div>
    <div class="form-group">
      <label class="form-label">Date</label>
      <input class="form-input" id="txnDate" type="date" value="${existing ? existing.date : today()}" />
    </div>
    <div class="form-group">
      <label class="form-label">Remark / Note</label>
      <input class="form-input" id="txnRemark" type="text" placeholder="What was this for?" value="${existing ? (existing.remark || '') : ''}" />
    </div>
    <button class="btn btn-primary" onclick="window.saveTransaction('${txnId || ''}')">${existing ? 'Save Changes' : 'Save Entry'}</button>
    ${existing ? `<button class="btn btn-danger" style="margin-top:8px" onclick="window.deleteTransaction('${txnId}')">Delete Entry</button>` : ''}
  `;

  sheetBg.classList.add('open');
  updateTxnCatDropdown(existing ? existing.category : null);
}

function updateTxnCatDropdown(selectedCat = null) {
  const type = document.getElementById('txnType').value;
  const catSelect = document.getElementById('txnCategory');
  if (!catSelect) return;
  const cats = bookCats(S.currentBookId, type);
  catSelect.innerHTML = cats.map(c => `<option value="${c}" ${c === selectedCat ? 'selected' : ''}>${catEmoji(c)} ${c}</option>`).join('');
}

function saveTransaction(txnId = '') {
  if (guestBlocked()) return;
  const type = document.getElementById('txnType').value;
  const amount = parseFloat(document.getElementById('txnAmount').value);
  const category = document.getElementById('txnCategory').value;
  const date = document.getElementById('txnDate').value;
  const remark = document.getElementById('txnRemark').value.trim();

  if (isNaN(amount) || amount <= 0) { toast("Please enter a valid amount"); return; }
  if (!category) { toast("Please pick a category"); return; }

  if (txnId) {
    const idx = S.transactions.findIndex(t => t.id === txnId);
    if (idx >= 0) S.transactions[idx] = { id: txnId, bookId: S.currentBookId, type, amount, category, date, remark };
  } else {
    S.transactions.push({ id: uid(), bookId: S.currentBookId, type, amount, category, date, remark });
  }

  save();
  window.closeSheetNow();
  renderPage();
  toast(txnId ? "Entry updated ✓" : "Entry logged ✓");
}

function deleteTransaction(txnId) {
  if (guestBlocked()) return;
  S.transactions = S.transactions.filter(t => t.id !== txnId);
  save();
  window.closeSheetNow();
  renderPage();
  toast("Entry deleted");
}

// ═══════════════════════════════════════════════
//  CATEGORIES ENGINE (3 Dots Menu Fixes)
// ═══════════════════════════════════════════════
function toggleCatMenu(e, c, type) {
  e.stopPropagation();
  closeAllCatMenus();
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.className = 'cat-popup-menu';
  menu.id = 'activeCatMenu';
  menu.style.position = 'fixed';
  menu.style.background = 'white';
  menu.style.border = '1px solid #ccc';
  menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  menu.style.zIndex = '10000';
  menu.style.padding = '4px 0';
  menu.style.borderRadius = '8px';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'cat-popup-item';
  renameBtn.style.display = 'block';
  renameBtn.style.width = '100%';
  renameBtn.style.padding = '8px 16px';
  renameBtn.style.background = 'none';
  renameBtn.style.border = 'none';
  renameBtn.style.textAlign = 'left';
  renameBtn.innerHTML = '✏️ Rename Category';
  renameBtn.onclick = (ev) => { ev.stopPropagation(); renameCategory(c, type); };

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'cat-popup-item delete';
  deleteBtn.style.display = 'block';
  deleteBtn.style.width = '100%';
  deleteBtn.style.padding = '8px 16px';
  deleteBtn.style.background = 'none';
  deleteBtn.style.border = 'none';
  deleteBtn.style.textAlign = 'left';
  deleteBtn.style.color = 'red';
  deleteBtn.innerHTML = '🗑 Delete Category';
  deleteBtn.onclick = (ev) => { ev.stopPropagation(); confirmDeleteCategory(c, type); };

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';

  setTimeout(() => document.addEventListener('click', closeAllCatMenus, { once: true }), 50);
}

function closeAllCatMenus() { const old = document.getElementById('activeCatMenu'); if (old) old.remove(); }

function renameCategory(c, type) {
  closeAllCatMenus();
  const newName = prompt('Rename category', c);
  if (!newName || !newName.trim() || newName.trim() === c) return;
  const clean = newName.trim();

  const cats = S.categories[S.currentBookId][type];
  if (cats.includes(clean)) { toast('Category already exists'); return; }
  
  const index = cats.indexOf(c);
  if (index !== -1) cats[index] = clean;

  S.transactions.forEach(t => { if (t.bookId === S.currentBookId && t.category === c) t.category = clean; });
  save(); renderPage(); toast('Category renamed ✓');
}

function confirmDeleteCategory(c, type) {
  closeAllCatMenus();
  if (guestBlocked()) return;
  if (!confirm(`Are you sure you want to delete "${c}"?`)) return;

  S.categories[S.currentBookId][type] = S.categories[S.currentBookId][type].filter(item => item !== c);
  S.transactions = S.transactions.filter(t => !(t.bookId === S.currentBookId && t.category === c));
  
  save(); renderPage(); toast(c + ' deleted ✓');
}

// ═══════════════════════════════════════════════
//  BOOKS & PERSISTENCE
// ═══════════════════════════════════════════════
function currentBook(){return S.books.find(b=>b.id===S.currentBookId)||S.books[0];}
function bookTxns(bookId,month){return (S.transactions||[]).filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){
  if(!S.categories[bookId]){ S.categories[bookId]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] }; }
  if(type) return S.categories[bookId][type] || [];
  return [...(S.categories[bookId].expense || []), ...(S.categories[bookId].income || [])];
}

function openBooksSheet(){ document.getElementById('sheetBg').classList.add('open'); renderBooksSheet(); }
function selectBook(id){ S.currentBookId=id; const b=currentBook(); document.getElementById('headerBookName').textContent=b.name; document.getElementById('headerBookIcon').textContent=b.emoji; save(); window.closeSheetNow(); renderMonthTabs(); showPage('dashboard'); }
function openAddBookSheet(){
  document.getElementById('sheetInner').innerHTML = `
    <div class="sheet-title">New Book <button class="close-btn" onclick="window.openBooksSheet()">×</button></div>
    <div class="form-group"><label class="form-label">Book Name</label><input class="form-input" id="newBookName" placeholder="e.g. Business, Personal..." /></div>
    <button class="btn btn-primary" onclick="window.createBook()">Create Book</button>
  `;
}
function createBook(){
  if(guestBlocked()) return;
  const name=document.getElementById('newBookName').value.trim();
  if(!name){toast('Enter a book name');return;}
  const book={id:uid(),name,emoji:'📒',ownerId:S.user.id,members:[{userId:S.user.id,email:S.user.email,name:S.user.name,role:'owner'}]};
  S.books.push(book);
  S.categories[book.id]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] };
  S.currentBookId=book.id;
  document.getElementById('headerBookName').textContent=book.name;
  document.getElementById('headerBookIcon').textContent=book.emoji;
  save(); window.closeSheetNow(); renderMonthTabs(); showPage('dashboard'); toast('Book created ✓');
}

function renderBooksSheet(){
  const items=S.books.map(b=>{
    const isCurrent=b.id===S.currentBookId;
    return `<div class="book-item ${isCurrent?'current':''}" onclick="window.selectBook('${b.id}')">
      <div class="book-item-icon">${b.emoji}</div>
      <div class="book-item-body"><div class="book-item-name">${b.name}</div></div>
      ${isCurrent?`<span class="book-badge">Active</span>`:''}
    </div>`;
  }).join('');
  document.getElementById('sheetInner').innerHTML=`<div class="sheet-title">Your Books<button class="close-btn" onclick="window.closeSheetNow()">×</button></div>${items}<div class="divider"></div><button class="btn btn-primary" onclick="window.openAddBookSheet()">+ New Book</button>`;
}

// ═══════════════════════════════════════════════
//  UI RENDERING ROUTERS
// ═══════════════════════════════════════════════
function showPage(page){
  S.currentPage=page;
  ['navDashboard','navTransactions','navCategories','navProfile'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('active', id.toLowerCase().includes(page));
  });
  const fab = document.getElementById('fabBtn');
  if(fab) fab.style.display=(page==='categories'||page==='profile')?'none':'flex';
  renderMonthTabs(); renderPage();
}

function renderMonthTabs(){
  const el=document.getElementById('monthScroll');
  if(!el) return;
  if(S.currentPage==='categories'||S.currentPage==='profile'){el.innerHTML='';return;}
  const allMonths=new Set([S.currentMonth]);
  (S.transactions||[]).filter(t=>t.bookId===S.currentBookId).forEach(t=>allMonths.add(monthKey(t.date)));
  const sorted=[...allMonths].sort().reverse().slice(0,12);
  el.innerHTML=sorted.map(m=>`<div class="month-chip ${m===S.currentMonth?'active':''}" onclick="window.selectMonth('${m}')">${monthLabel(m)}</div>`).join('');
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

// ═══════════════════════════════════════════════
//  GLOBAL EXPOSURE (Bridges Javascript Modules to HTML layout)
// ═══════════════════════════════════════════════
window.handleAuth = handleAuth;
window.handleGoogleAuth = handleGoogleAuth;
window.switchAuthTab = switchAuthTab;
window.continueAsGuest = continueAsGuest;
window.logout = logout;
window.selectBook = selectBook;
window.createBook = createBook;
window.openAddBookSheet = openAddBookSheet;
window.openBooksSheet = openBooksSheet;
window.showPage = showPage;
window.selectMonth = selectMonth;
window.addCat = addCat;
window.openTxnSheet = openTxnSheet;
window.updateTxnCatDropdown = updateTxnCatDropdown;
window.saveTransaction = saveTransaction;
window.deleteTransaction = deleteTransaction;
window.toggleCatMenu = toggleCatMenu;
