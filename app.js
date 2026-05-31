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
  const avatarEl = document.getElementById('userAvatar');
  if(avatarEl) avatarEl.textContent = S.user.initials;
  
  const hName = document.getElementById('headerBookName');
  const hIcon = document.getElementById('headerBookIcon');
  if(hName) hName.textContent = currentBook().name;
  if(hIcon) hIcon.textContent = currentBook().emoji;
  
  renderMonthTabs();
  showPage('dashboard');
  toast('Welcome back! 👋');
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
    signInWithEmailAndPassword(auth, email, pass).catch((e
