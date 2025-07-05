// js/dashboard.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// توجيه لصفحة الكاشير
window.goToCashier = function () {
  window.location.href = "cashier.html";
};

// توجيه الصفحات من القائمة الجانبية
const sidebarItems = document.querySelectorAll(".sidebar ul li");

const pagesMap = {
  "الرئيسية": "dashboard.html",
  "الكاشير": "cashier.html",
  "الاشتراكات": "subscriptions.html",
  "الملازم": "invoices.html",
  "المصروفات": "expenses.html",
  "المستخدمين": "users.html",
  "التقارير": "reports.html",
  "الإعدادات": "settings.html",
  "دليل المساعدة": "help.html",
};

sidebarItems.forEach(item => {
  item.addEventListener("click", () => {
    const page = pagesMap[item.textContent.trim()];
    if (page) {
      window.location.href = page;
    }
  });
});

// عرض الوقت والتاريخ
function updateTime() {
  const now = new Date();
  document.getElementById("time").textContent = now.toLocaleTimeString("ar-EG");
  document.getElementById("full-date").textContent = now.toLocaleDateString("ar-EG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}
setInterval(updateTime, 1000);
updateTime();

// تسجيل الخروج
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "login.html";
    });
  });

  // التحقق من حالة الدخول
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
    } else {
      // جلب اسم المستخدم من قاعدة البيانات
      let username = user.email;
      try {
        const snapshot = await getDocs(collection(db, "users"));
        snapshot.forEach(docSnap => {
          const u = docSnap.data();
          if (u.email === user.email) {
            username = u.username;
          }
        });
      } catch (e) {}
      document.getElementById("center-name").textContent = "مرحباً " + username;
    }
  });
});

// --- إحصائيات الداشبورد ---
async function loadDashboardStats() {
  const today = new Date();
  const todayStr = today.toLocaleDateString('ar-EG');
  const month = today.getMonth();
  const year = today.getFullYear();
  let todayStudents = new Set();
  let monthIncome = 0;
  let lastInvoice = null;
  let lastInvoiceDate = null;

  const snapshot = await getDocs(collection(db, "invoices"));
  snapshot.forEach(docSnap => {
    const inv = docSnap.data();
    // تاريخ الفاتورة
    let d = inv.date;
    if (d && typeof d === 'object' && d.toDate) d = d.toDate();
    else if (d) d = new Date(d);
    else return;
    // أرباح الشهر
    if (d.getMonth() === month && d.getFullYear() === year) {
      monthIncome += (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
    }
    // عدد الطلاب اليوم (فقط الفواتير الجماعية)
    if (
      d.toLocaleDateString('ar-EG') === todayStr &&
      inv.student && inv.student !== '-' && inv.student.trim() !== '' &&
      (inv.subType === 'كورسات' || inv.subType === 'ملازم')
    ) {
      todayStudents.add(inv.student + '_' + (inv.grade||''));
    }
    // آخر فاتورة
    if (!lastInvoiceDate || d > lastInvoiceDate) {
      lastInvoiceDate = d;
      lastInvoice = inv;
    }
  });
  // تحديث DOM
  document.getElementById('today-students').textContent = todayStudents.size;
  document.getElementById('month-income').textContent = monthIncome + ' ج';
  if (lastInvoice) {
    // إذا كانت آخر فاتورة من نوع كورسات فقط
    if (lastInvoice.subType === 'كورسات') {
      document.getElementById('last-bill').textContent = 'كورسات';
    } else {
      document.getElementById('last-bill').textContent = '--';
    }
  } else {
    document.getElementById('last-bill').textContent = '--';
  }
}

window.addEventListener('DOMContentLoaded', loadDashboardStats);
