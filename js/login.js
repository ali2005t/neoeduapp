import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const form = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");
const usernameInput = document.getElementById("username");
const generatedEmailInput = document.getElementById("generated-email");

if (usernameInput && generatedEmailInput) {
  usernameInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    generatedEmailInput.value = username ? (username + "@lookcenter.com") : '';
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let email = generatedEmailInput.value;
  if (!email) {
    // fallback: لو المستخدم لم يكتب اسم المستخدم
    const username = usernameInput.value.trim();
    email = username + "@lookcenter.com";
  }
  const password = document.getElementById("password").value;
  const rememberMe = document.getElementById("remember-me").checked;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }
    // جلب صلاحيات المستخدم من Firestore
    const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const db = getFirestore();
    const usersSnap = await getDocs(collection(db, "users"));
    let userDoc = null;
    usersSnap.forEach(docSnap => {
      const u = docSnap.data();
      if (u.email === email) userDoc = u;
    });
    if (userDoc && userDoc.permissions && Array.isArray(userDoc.permissions)) {
      localStorage.setItem('userPermissions', JSON.stringify(userDoc.permissions));
      // توجيه المستخدم لأول صفحة مسموحة
      const pageMap = {
        'dashboard': 'dashboard.html',
        'cashier': 'cashier.html',
        'invoices': 'invoices.html',
        'unsubscribed': 'unsubscribed_students.html',
        'subscriptions': 'subscriptions.html',
        'users': 'users.html',
        'reports': 'reports.html',
        'expenses': 'expenses.html',
        'settings': 'settings.html',
        'help': 'help.html'
      };
      for (let i = 0; i < userDoc.permissions.length; i++) {
        const key = userDoc.permissions[i];
        if (pageMap[key]) {
          window.location.href = pageMap[key];
          return;
        }
      }
    }
    // fallback: إذا لم توجد صلاحيات
    window.location.href = "dashboard.html";
  } catch (error) {
    errorMessage.textContent = "البريد أو كلمة المرور غير صحيحة.";
    errorMessage.style.display = "block";
  }
});

// تعبئة البريد إذا كان محفوظًا
window.addEventListener("DOMContentLoaded", () => {
  const remembered = localStorage.getItem("rememberedEmail");
  if (remembered) {
    if (usernameInput && generatedEmailInput) {
      const username = remembered.replace(/@lookcenter.com$/, "");
      usernameInput.value = username;
      generatedEmailInput.value = remembered;
    }
    document.getElementById("remember-me").checked = true;
  }
});

// زر إظهار/إخفاء كلمة المرور داخل الحقل
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');

if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', function (e) {
    e.preventDefault();
    const icon = this.querySelector('i');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
    passwordInput.focus();
  });
}
