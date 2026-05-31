// Import Firebase core and specified software modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider,
  signInWithPopup,
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
const CAT_COLORS={
  'Entertainment':'#185FA5','Fast Food':'#1D9E75','Grocery':'#D85A30','Home Improvement':'#BA7517',
  'Travel':'#534AB7','Fuel':'#3B6D11','Dress':'#993C1D','Rent / Bills':'#D4537E',
  'Salary':'#0F6E56','Freelance':'#963C00','Business':'#2a7a8a','Investment':'#7b3fa0',
  'Salary Income':'#1D9E75','Business Income':'#2a7a8a','Medical':'#💊','Education':'#📚','Gift':'#🎁','Other':'#95a5a6'
};

const CAT_EMOJI={
  'Entertainment':'🎬','Fast Food':'🍔','Grocery':'🛒','Home Improvement':'🏠',
  'Travel':'✈️','Fuel':'⛽','Dress':'👗','Rent / Bills':'🏢',
  'Salary':'💼','Freelance':'💻','Business':'📊','Investment':'📈',
  'Medical':'💊','Education':'📚','Gift':'🎁','Other':'📦',
  'Salary Income':'💼','Business Income':'📊'
};

const DEFAULT_EXPENSE_CATS=['Entertainment','Fast Food','Grocery','Home Improvement','Travel','Fuel','Dress','Rent / Bills','Medical','Education','Gift','Other'];
const DEFAULT_INCOME_CATS=['Salary Income','Business Income'];

function catEmoji(n){return CAT_EMOJI[n]||'📦';}
function catColor(n){return CAT_COLORS[n]||'#7f8c8d';}
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
const googleProvider = new GoogleAuthProvider();

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
      toast("Error downloading profiles.");
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
  
  const avatarEl = document.getElementById('userAvatar');
  if(avatarEl) avatarEl.textContent = S.user.initials;
  
  const hName = document.getElementById('headerBookName');
  const hIcon = document.getElementById('headerBookIcon');
  if(hName && currentBook()) hName.textContent = currentBook().name;
  if(hIcon && currentBook()) hIcon.textContent = currentBook().emoji;
  
  renderMonthTabs();
  showPage('dashboard');
  toast('Access Granted ✓');
}

function showAuthScreen() {
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
}

function save() {
  if (!S.user || S.isGuest) return;
  set(ref(db, 'users/' + S.user.id), S).catch((e) => console.error("Cloud engine sync failure:", e));
}

// ═══════════════════════════════════════════════
//  AUTHENTICATION ENGINE
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
  const emailEl = document.getElementById('fEmail');
  const passEl = document.getElementById('fPassword');
  const nameEl = document.getElementById('fName');
  const err = document.getElementById('authErr');
  
  if (err) err.style.display = 'none';

  const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
  const pass = passEl ? passEl.value : '';
  const name = nameEl ? nameEl.value.trim() : '';

  if (!email || !pass) { showError('Please complete all form fields.'); return; }

  if (authMode === 'register') {
    if (!name) { showError('Please provide your full name.'); return; }
    createUserWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        userCredential.user.displayName = name;
        setupNewUserSchema(userCredential.user);
      })
      .catch((e) => { showError(e.message); });
  } else {
    signInWithEmailAndPassword(auth, email, pass).catch((e) => { showError('Invalid email or password mismatch.'); });
  }
}

function handleGoogleAuth() {
  signInWithPopup(auth, googleProvider).catch((error) => { showError(error.message || "Google Authentication canceled."); });
}

function showError(msg) {
  const err = document.getElementById('authErr');
  if (err) { err.textContent = msg; err.style.display = 'block'; } else { alert(msg); }
}

function continueAsGuest(){
  S.isGuest=true;
  const guestBook={id:'guest-book',name:'Demo Book',emoji:'📒',ownerId:'guest',members:[]};
  S.books=[guestBook]; S.currentBookId=guestBook.id;
  S.categories[guestBook.id]={expense:[...DEFAULT_EXPENSE_CATS],income:[...DEFAULT_INCOME_CATS]};
  S.transactions=[];
  setupUIAfterLogin();
}

function logout(){ 
  S.isGuest=false; 
  signOut(auth).then(() => { 
    S = { user:null, isGuest:false, books:[], currentBookId:null, transactions:[], categories:{}, currentMonth:today().slice(0,7), currentPage:'dashboard' }; 
    showAuthScreen();
  }); 
}

function guestBlocked(){ if(S.isGuest){ toast('Action restricted to verified logins.'); return true; } return false; }
function toast(msg) { const t = document.getElementById('toast'); if(t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); } }

// ═══════════════════════════════════════════════
//  TRANSACTIONS SYSTEM CODE
// ═══════════════════════════════════════════════
function openTxnSheet(txnId = null) {
  const sheetBg = document.getElementById('sheetBg');
  const inner = document.getElementById('sheetInner');
  if (!sheetBg || !inner) return;

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
  if (window.closeSheetNow) window.closeSheetNow();
  else document.getElementById('sheetBg').classList.remove('open');
  renderPage();
  toast(txnId ? "Entry updated ✓" : "Entry logged ✓");
}

function deleteTransaction(txnId) {
  if (guestBlocked()) return;
  S.transactions = S.transactions.filter(t => t.id !== txnId);
  save();
  if (window.closeSheetNow) window.closeSheetNow();
  else document.getElementById('sheetBg').classList.remove('open');
  renderPage();
  toast("Entry deleted");
}

// ═══════════════════════════════════════════════
//  CATEGORIES SYSTEM CODE
// ═══════════════════════════════════════════════
function addCat(type) {
  if (guestBlocked()) return;
  const name = prompt('Enter new category name:');
  if (!name || !name.trim()) return;
  const clean = name.trim();
  
  if (!S.categories[S.currentBookId]) {
    S.categories[S.currentBookId] = { expense: [...DEFAULT_EXPENSE_CATS], income: [...DEFAULT_INCOME_CATS] };
  }
  
  if (S.categories[S.currentBookId][type].includes(clean)) {
    toast('Category already exists!');
    return;
  }
  
  S.categories[S.currentBookId][type].push(clean);
  save();
  renderPage();
  toast('Category added ✓');
}

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
  renameBtn.style.display = 'block';
  renameBtn.style.width = '100%';
  renameBtn.style.padding = '8px 16px';
  renameBtn.style.background = 'none';
  renameBtn.style.border = 'none';
  renameBtn.style.textAlign = 'left';
  renameBtn.innerHTML = '✏️ Rename';
  renameBtn.onclick = (ev) => { ev.stopPropagation(); renameCategory(c, type); };

  const deleteBtn = document.createElement('button');
  deleteBtn.style.display = 'block';
  deleteBtn.style.width = '100%';
  deleteBtn.style.padding = '8px 16px';
  deleteBtn.style.background = 'none';
  deleteBtn.style.border = 'none';
  deleteBtn.style.textAlign = 'left';
  deleteBtn.style.color = 'red';
  deleteBtn.innerHTML = '🗑 Delete';
  deleteBtn.onclick = (ev) => { ev.stopPropagation(); confirmDeleteCategory(c, type); };

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 140) + 'px';

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
  if (!confirm(`Delete "${c}"?`)) return;

  S.categories[S.currentBookId][type] = S.categories[S.currentBookId][type].filter(item => item !== c);
  S.transactions = S.transactions.filter(t => !(t.bookId === S.currentBookId && t.category === c));
  
  save(); renderPage(); toast('Category deleted ✓');
}

// ═══════════════════════════════════════════════
//  BOOKS ENGINE
// ═══════════════════════════════════════════════
function currentBook(){return S.books?.find(b=>b.id===S.currentBookId)||S.books?.[0]||{name:'My Book',emoji:'📒'};}
function bookTxns(bookId,month){return (S.transactions||[]).filter(t=>t.bookId===bookId&&t.date.startsWith(month));}
function bookCats(bookId,type){
  if(!S.categories[bookId]){ S.categories[bookId]={ expense:[...DEFAULT_EXPENSE_CATS], income:[...DEFAULT_INCOME_CATS] }; }
  if(type) return S.categories[bookId][type] || [];
  return [...(S.categories[bookId].expense || []), ...(S.categories[bookId].income || [])];
}

function openBooksSheet(){ document.getElementById('sheetBg').classList.add('open'); renderBooksSheet(); }
function selectBook(id){ S.currentBookId=id; const b=currentBook(); document.getElementById('headerBookName').textContent=b.name; document.getElementById('headerBookIcon').textContent=b.emoji; save(); if(window.closeSheetNow) window.closeSheetNow(); else document.getElementById('sheetBg').classList.remove('open'); renderMonthTabs(); showPage('dashboard'); }
function openAddBookSheet() {
  document.getElementById('sheetInner').innerHTML = `
    <div class="sheet-title">New Book <button class="close-btn" onclick="window.openBooksSheet()">×</button></div>
    <div class="form-group"><label class="form-label">Book Name</label><input class="form-input" id="newBookName" placeholder="Business, Home..." /></div>
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
  save(); if(window.closeSheetNow) window.closeSheetNow(); else document.getElementById('sheetBg').classList.remove('open'); renderMonthTabs(); showPage('dashboard'); toast('Book created ✓');
}

function renderBooksSheet(){
  const items=(S.books || []).map(b=>{
    const isCurrent=b.id===S.currentBookId;
    return `<div class="book-item ${isCurrent?'current':''}" onclick="window.selectBook('${b.id}')" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
      <div style="margin-right:10px;">${b.emoji}</div>
      <div style="flex-grow:1;">${b.name}</div>
      ${isCurrent?'<span style="font-size:12px; color:#185FA5; font-weight:bold;">Active</span>':''}
    </div>`;
  }).join('');
  document.getElementById('sheetInner').innerHTML=`<div class="sheet-title">Your Books<button class="close-btn" onclick="window.closeSheetNow()">×</button></div>${items}<div style="margin-top:15px;"></div><button class="btn btn-primary" onclick="window.openAddBookSheet()">+ New Book</button>`;
}

// ═══════════════════════════════════════════════
//  UI PAGES GENERATOR (WITH PIE CHART & CAT CARDS)
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
  if(S.currentPage=='dashboard') el.innerHTML=renderDashboard();
  else if(S.currentPage=='transactions') el.innerHTML=renderTransactions();
  else if(S.currentPage=='categories') el.innerHTML=renderCategoriesPage();
  else el.innerHTML=renderProfilePage();
}

function renderDashboard() {
  const txns = bookTxns(S.currentBookId, S.currentMonth);
  let inc = 0, exp = 0;
  
  // Calculate Category-wise summaries
  const catSums = {};
  txns.forEach(t => { 
    if(t.type==='income') {
      inc+=t.amount; 
    } else {
      exp+=t.amount;
      catSums[t.category] = (catSums[t.category] || 0) + t.amount;
    }
  });
  const bal = inc - exp;

  // Generate CSS Conic Gradient string for Pie Chart slices
  let chartGradientString = '#f2f2f2 0 100%';
  let accumulatedPercent = 0;
  const sortedCats = Object.entries(catSums).sort((a,b) => b[1] - a[1]);

  if (exp > 0 && sortedCats.length > 0) {
    const pieces = sortedCats.map(([cat, val]) => {
      const start = accumulatedPercent;
      const percent = (val / exp) * 100;
      accumulatedPercent += percent;
      return `${catColor(cat)} ${start.toFixed(1)}% ${accumulatedPercent.toFixed(1)}%`;
    });
    chartGradientString = pieces.join(', ');
  }

  // Generate Category-Wise Breakdown Elements
  const categoryCardsHTML = sortedCats.map(([cat, val]) => {
    const pct = exp > 0 ? ((val / exp) * 100).toFixed(0) : 0;
    return `
      <div style="display:flex; align-items:center; background:white; padding:12px; margin-bottom:8px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="font-size:20px; width:36px; height:36px; background:${catColor(cat)}22; border-radius:50%; text-align:center; line-height:36px; margin-right:12px;">${catEmoji(cat)}</div>
        <div style="flex-grow:1;">
          <div style="display:flex; justify-content:space-between; font-weight:600; font-size:14px; color:#2c3e50;">
            <span>${cat}</span>
            <span>${fmt(val)}</span>
          </div>
          <div style="background:#eee; height:6px; border-radius:3px; margin-top:6px; overflow:hidden;">
            <div style="background:${catColor(cat)}; width:${pct}%; height:100%; border-radius:3px;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="padding:15px;">
      <div style="background:#185FA5; color:white; padding:20px; border-radius:12px; margin-bottom:15px; text-align:center; box-shadow: 0 4px 12px rgba(24,95,165,0.25);">
        <div style="font-size:14px; opacity:0.8;">Net Balance</div>
        <div style="font-size:28px; font-weight:bold; margin-top:5px;">${fmtSgn(bal)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:15px; border-top:1px solid rgba(255,255,255,0.2); padding-top:10px;">
          <div><div>Income</div><div style="font-weight:bold; color:#a2ffd2;">${fmt(inc)}</div></div>
          <div><div>Expenses</div><div style="font-weight:bold; color:#ffb3a2;">${fmt(exp)}</div></div>
        </div>
      </div>

      ${exp > 0 ? `
      <div style="background:white; padding:15px; border-radius:12px; margin-bottom:20px; display:flex; flex-direction:column; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
        <h4 style="margin:0 0 12px 0; color:#555; align-self:flex-start;">Expense Structure</h4>
        <div style="width:140px; height:140px; border-radius:50%; background:conic-gradient(${chartGradientString}); margin-bottom:15px; box-shadow:inset 0 0 10px rgba(0,0,0,0.1);"></div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
          ${sortedCats.slice(0,4).map(([cat, val]) => `
            <div style="display:flex; align-items:center; font-size:11px; color:#555;">
              <span style="width:8px; height:8px; background:${catColor(cat)}; border-radius:50%; margin-right:4px; display:inline-block;"></span>
              ${cat} (${((val/exp)*100).toFixed(0)}%)
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${sortedCats.length > 0 ? `<h3 style="margin-bottom:10px; font-size:16px; color:#2c3e50;">Category Wise Analysis</h3>${categoryCardsHTML}<div style="margin-top:20px;"></div>` : ''}

      <h3 style="font-size:16px; color:#2c3e50; margin-bottom:10px;">Recent Entries</h3>
      ${txns.length === 0 ? '<div style="color:#777; text-align:center; padding:20px; background:white; border-radius:12px;">No entries this month. Click + to add!</div>' : 
        txns.slice(0,5).map(t => `
          <div onclick="window.openTxnSheet('${t.id}')" style="display:flex; align-items:center; padding:12px; background:white; margin-bottom:8px; border-radius:8px; border-left:4px solid ${t.type==='income'?'#1D9E75':'#D85A30'}; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size:20px; margin-right:12px;">${catEmoji(t.category)}</div>
            <div style="flex-grow:1;"><strong>${t.category}</strong><br><small style="color:#777;">${t.remark || t.date}</small></div>
            <div style="font-weight:bold; color:${t.type==='income'?'#1D9E75':'#D85A30'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
          </div>
        `).join('')}
    </div>
  `;
}

function renderTransactions() {
  const txns = bookTxns(S.currentBookId, S.currentMonth);
  return `
    <div style="padding:15px;">
      <h3>All Month Entries</h3>
      ${txns.length === 0 ? '<p style="color:#777;">No entries saved yet.</p>' : txns.map(t => `
        <div onclick="window.openTxnSheet('${t.id}')" style="display:flex; align-items:center; padding:12px; background:white; margin-bottom:8px; border-radius:8px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-size:20px; margin-right:12px;">${catEmoji(t.category)}</div>
          <div style="flex-grow:1;"><strong>${t.category}</strong><br><small style="color:#777;">${t.remark || ''} (${t.date})</small></div>
          <div style="font-weight:bold; color:${t.type==='income'?'#1D9E75':'#D85A30'}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCategoriesPage() {
  const cats = S.categories[S.currentBookId] || { expense: [...DEFAULT_EXPENSE_CATS], income: [...DEFAULT_INCOME_CATS] };
  return `
    <div style="padding:15px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Expense Categories</h3>
        <button class="btn" style="padding:4px 8px; font-size:12px;" onclick="window.addCat('expense')">+ Add</button>
      </div>
      ${cats.expense.map(c => `
        <div style="display:flex; justify-content:space-between; padding:10px; background:white; margin-bottom:6px; border-radius:6px; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div>${catEmoji(c)} ${c}</div>
          <button style="background:none; border:none; font-size:16px; cursor:pointer; padding:0 8px;" onclick="window.toggleCatMenu(event, '${c}', 'expense')">⋮</button>
        </div>
      `).join('')}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <h3>Income Categories</h3>
        <button class="btn" style="padding:4px 8px; font-size:12px;" onclick="window.addCat('income')">+ Add</button>
      </div>
      ${cats.income.map(c => `
        <div style="display:flex; justify-content:space-between; padding:10px; background:white; margin-bottom:6px; border-radius:6px; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div>${catEmoji(c)} ${c}</div>
          <button style="background:none; border:none; font-size:16px; cursor:pointer; padding:0 8px;" onclick="window.toggleCatMenu(event, '${c}', 'income')">⋮</button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderProfilePage() {
  return `
    <div style="padding:15px; text-align:center;">
      <div style="width:70px; height:70px; background:#185FA5; color:white; font-size:24px; font-weight:bold; line-height:70px; border-radius:50%; margin:20px auto;">${S.user?.initials || 'G'}</div>
      <h3>${S.user?.name || 'Guest User'}</h3>
      <p style="color:#777; font-size:14px; margin-top:-5px;">${S.user?.email || 'Offline Sandbox Mode'}</p>
      <div style="margin-top:30px;"></div>
      <button class="btn btn-danger" style="width:100%; max-width:200px;" onclick="window.logout()">Logout Securely</button>
    </div>
  `;
}

// Ensure globally bound functions exist across windows
window.closeSheetNow = function() { document.getElementById('sheetBg').classList.remove('open'); };

// ═══════════════════════════════════════════════
//  GLOBAL WINDOW EXPOSURE
// ═══════════════════════════════════════════════
window.handle
