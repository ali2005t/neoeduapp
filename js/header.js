import { signOut, getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// تفعيل زر تسجيل الخروج في جميع الصفحات
window.addEventListener("DOMContentLoaded", function() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      const auth = getAuth();
      signOut(auth).then(() => {
        window.location.href = "login.html";
      });
    });
  }
  // تفعيل إخفاء عناصر القائمة الجانبية حسب الصلاحيات
  try {
    const perms = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    if (perms.length && document.querySelector('.sidebar ul')) {
      const allLis = document.querySelectorAll('.sidebar ul li');
      allLis.forEach(li => {
        const link = li.getAttribute('data-link');
        if (link) {
          // استخراج key من اسم الصفحة
          let key = '';
          if (link.includes('dashboard')) key = 'dashboard';
          else if (link.includes('cashier')) key = 'cashier';
          else if (link.includes('invoices')) key = 'invoices';
          else if (link.includes('unsubscribed')) key = 'unsubscribed';
          else if (link.includes('subscriptions')) key = 'subscriptions';
          else if (link.includes('users')) key = 'users';
          else if (link.includes('reports')) key = 'reports';
          else if (link.includes('expenses')) key = 'expenses';
          else if (link.includes('settings')) key = 'settings';
          else if (link.includes('help')) key = 'help';
          if (!perms.includes(key)) li.style.display = 'none';
        }
      });
    }
  } catch(e) {}
});

// تحديث اسم السنتر والشعار في الهيدر من localStorage أو Firebase
async function updateCenterHeader() {
  let name = localStorage.getItem('centerName');
  let logo = localStorage.getItem('centerLogo');
  // جلب من Firebase إذا لم يوجد محلياً
  if (!name || !logo) {
    try {
      const { db } = await import('./firebase.js');
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const snap = await getDoc(doc(db, 'settings', 'main'));
      if (snap.exists()) {
        const data = snap.data();
        if (!name && data.centerName) name = data.centerName;
        if (!logo && data.centerLogo) logo = data.centerLogo;
        if (name) localStorage.setItem('centerName', name);
        if (logo) localStorage.setItem('centerLogo', logo);
      }
    } catch (e) {}
  }
  // تحديث في الهيدر
  const nameEl = document.getElementById('center-name');
  if (nameEl) nameEl.textContent = name || 'اسم السنتر';
  const imgEl = document.querySelector('.header-left img');
  if (imgEl) imgEl.src = logo || 'img/placeholder-logo.png';
  // تحديث في الداشبورد (العنصر ثلاثي الأبعاد)
  const name3d = document.getElementById('center-name-3d');
  if (name3d) name3d.textContent = name || 'اسم السنتر';
  // splash/login
  const splashName = document.querySelector('.center-name');
  if (splashName) splashName.textContent = name || 'اسم السنتر';
  const splashLogo = document.querySelector('.login-logo, .splash-container img');
  if (splashLogo) splashLogo.src = logo || 'img/placeholder-logo.png';
}
window.addEventListener('storage', updateCenterHeader);
window.addEventListener('DOMContentLoaded', updateCenterHeader);
