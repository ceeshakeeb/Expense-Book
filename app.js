function handleAuth() {
  const emailEl = document.getElementById('fEmail');
  const passEl = document.getElementById('fPassword');
  const nameEl = document.getElementById('fName');
  const err = document.getElementById('authErr');
  
  if (!emailEl || !passEl) {
    alert("Form inputs not found in HTML structure.");
    return;
  }

  const email = emailEl.value.trim().toLowerCase();
  const pass = passEl.value;
  const name = nameEl ? nameEl.value.trim() : '';

  if (err) err.style.display = 'none';

  if (!email || !pass) {
    if (err) { err.textContent = 'Please fill all fields.'; err.style.display = 'block'; }
    else { alert('Please fill all fields.'); }
    return;
  }

  if (authMode === 'register') {
    if (!name) {
      if (err) { err.textContent = 'Please enter your name.'; err.style.display = 'block'; }
      else { alert('Please enter your name.'); }
      return;
    }
    createUserWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        userCredential.user.displayName = name; 
        setupNewUserSchema(userCredential.user);
      })
      .catch((e) => {
        if (err) { err.textContent = e.message; err.style.display = 'block'; }
        else { alert(e.message); }
      });
  } else {
    signInWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        // Successfully logged in - auth observer will handle UI rendering
      })
      .catch((e) => {
        console.error("Login details error:", e);
        if (err) { err.textContent = 'Invalid email or password.'; err.style.display = 'block'; }
        else { alert('Invalid credentials. Check email/password.'); }
      });
  }
}
