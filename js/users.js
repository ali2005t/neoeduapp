import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// صفحات النظام المتاحة للصلاحيات
const allPages = [
  {key:'dashboard',label:'لوحة التحكم',file:'dashboard.html'},
  {key:'cashier',label:'الكاشير',file:'cashier.html'},
  {key:'invoices',label:'الطلاب المشتركين',file:'invoices.html'},
  {key:'unsubscribed',label:'فواتير فردية',file:'unsubscribed_students.html'},
  {key:'subscriptions',label:'الاشتراكات والأسعار',file:'subscriptions.html'},
  {key:'users',label:'إدارة المستخدمين',file:'users.html'},
  {key:'reports',label:'التقارير',file:'reports.html'},
  {key:'expenses',label:'المصروفات',file:'expenses.html'},
  {key:'settings',label:'الإعدادات',file:'settings.html'},
  {key:'help',label:'دليل المساعدة',file:'help.html'}
];

// إضافة مستخدم جديد
const EMAIL_DOMAIN = "@lookcenter.com";

const addUserForm = document.getElementById("add-user-form");
const usernameInput = document.getElementById("username");
const generatedEmailInput = document.getElementById("generated-email");

if (usernameInput && generatedEmailInput) {
  usernameInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    generatedEmailInput.value = username ? (username + EMAIL_DOMAIN) : '';
  });
}

addUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullname = document.getElementById("user-fullname").value;
  const username = usernameInput.value.trim();
  const email = generatedEmailInput.value;
  const password = document.getElementById("user-password").value;
  const type = document.getElementById("user-type").value;
  let permissions = [];
  const permsInputs = document.querySelectorAll('.perm-checkbox');
  if(permsInputs.length) {
    permissions = Array.from(permsInputs).filter(x=>x.checked).map(x=>x.value);
  } else if(type === 'مدير') {
    permissions = allPages.map(p=>p.key);
  } else if(type === 'كاشير') {
    permissions = ['cashier','invoices','unsubscribed'];
  }
  if (!fullname || !username || !password || !type) return window.showNotification("يرجى ملء كل الحقول", 'error');
  try {
    // إنشاء المستخدم في Authentication
    await createUserWithEmailAndPassword(getAuth(), email, password);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      window.showNotification('هذا البريد مستخدم بالفعل في النظام', 'error');
      return;
    } else {
      window.showNotification('حدث خطأ أثناء إنشاء المستخدم: ' + err.message, 'error');
      return;
    }
  }
  await addDoc(collection(db, "users"), {
    fullname,
    username,
    email,
    password,
    type,
    permissions,
    active: true
  });
  window.showNotification("تمت إضافة المستخدم", 'success');
  loadUsers();
});

// تحميل المستخدمين
async function loadUsers() {
  const tbody = document.querySelector("#users-table tbody");
  tbody.innerHTML = "";
  const snapshot = await getDocs(collection(db, "users"));
  snapshot.forEach((docSnap) => {
    const user = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.fullname}</td>
      <td>${user.username}</td>
      <td>${user.type}</td>
      <td>${user.active ? 'مفعل' : 'معطل'}</td>
      <td style="display:flex;gap:6px;justify-content:center;">
        <button class="toggle-user" data-id="${docSnap.id}" style="background:${user.active ? '#f44336':'#4caf50'};color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">${user.active ? 'تعطيل' : 'تفعيل'}</button>
        <button class="edit-user" data-id="${docSnap.id}" style="background:#1976d2;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">تعديل</button>
        <button class="change-pass" data-id="${docSnap.id}" style="background:#ffb300;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">كلمة السر</button>
        <button class="delete-user" data-id="${docSnap.id}" style="background:#e53935;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  // تفعيل/تعطيل المستخدم
  document.querySelectorAll('.toggle-user').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const snapshot = await getDocs(collection(db, "users"));
      let userDoc;
      snapshot.forEach(docSnap => { if (docSnap.id === id) userDoc = docSnap; });
      if (!userDoc) return;
      const user = userDoc.data();
      await updateDoc(doc(db, "users", id), { active: !user.active });
      loadUsers();
    };
  });
  // تعديل بيانات المستخدم
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const snapshot = await getDocs(collection(db, "users"));
      let userDoc;
      snapshot.forEach(docSnap => { if (docSnap.id === id) userDoc = docSnap; });
      if (!userDoc) return;
      const user = userDoc.data();
      const modal = document.createElement('div');
      modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0003;z-index:3000;display:flex;align-items:center;justify-content:center;';
      // واجهة اختيار صفحات الصلاحية
      let permsHtml = '<div style="margin-bottom:10px;">';
      allPages.forEach(p => {
        permsHtml += `<label style='margin-left:10px;'><input type='checkbox' class='perm-checkbox' value='${p.key}' ${user.permissions&&user.permissions.includes(p.key)?'checked':''}/> ${p.label}</label>`;
      });
      permsHtml += '</div>';
      modal.innerHTML = `
        <div style="background:#fff;padding:28px 22px;border-radius:12px;min-width:320px;max-width:90vw;box-shadow:0 4px 32px #90caf988;">
          <h3 style='margin-bottom:18px;'>تعديل بيانات المستخدم</h3>
          <input id='edit-fullname' value='${user.fullname}' style='width:100%;margin-bottom:10px;padding:8px;border-radius:6px;border:1px solid #cde4ff;'>
          <input id='edit-username' value='${user.username}' style='width:100%;margin-bottom:10px;padding:8px;border-radius:6px;border:1px solid #cde4ff;'>
          <select id='edit-type' style='width:100%;margin-bottom:10px;padding:8px;border-radius:6px;border:1px solid #cde4ff;'>
            <option value='مدير' ${user.type==='مدير'?'selected':''}>مدير</option>
            <option value='كاشير' ${user.type==='كاشير'?'selected':''}>كاشير</option>
          </select>
          ${permsHtml}
          <div style='display:flex;gap:10px;justify-content:flex-end;'>
            <button id='save-edit-user' style='background:#1976d2;color:#fff;padding:8px 22px;border:none;border-radius:7px;cursor:pointer;'>حفظ</button>
            <button id='cancel-edit-user' style='background:#eee;color:#333;padding:8px 22px;border:none;border-radius:7px;cursor:pointer;'>إلغاء</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('cancel-edit-user').onclick = () => modal.remove();
      document.getElementById('save-edit-user').onclick = async () => {
        const newFullname = document.getElementById('edit-fullname').value;
        const newUsername = document.getElementById('edit-username').value;
        const newType = document.getElementById('edit-type').value;
        const newPerms = Array.from(document.querySelectorAll('.perm-checkbox')).filter(x=>x.checked).map(x=>x.value);
        if (!newFullname || !newUsername || !newType) return window.showNotification('يرجى ملء كل الحقول', 'error');
        await updateDoc(doc(db, "users", id), {
          fullname: newFullname,
          username: newUsername,
          type: newType,
          permissions: newPerms
        });
        window.showNotification('تم حفظ التعديلات بنجاح', 'success');
        modal.remove();
        loadUsers();
      };
    };
  });
  // تغيير كلمة السر
  document.querySelectorAll('.change-pass').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      const modal = document.createElement('div');
      modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0003;z-index:3000;display:flex;align-items:center;justify-content:center;';
      modal.innerHTML = `
        <div style="background:#fff;padding:28px 22px;border-radius:12px;min-width:320px;max-width:90vw;box-shadow:0 4px 32px #90caf988;">
          <h3 style='margin-bottom:18px;'>تغيير كلمة السر</h3>
          <input id='edit-password' type='password' placeholder='كلمة السر الجديدة' style='width:100%;margin-bottom:10px;padding:8px;border-radius:6px;border:1px solid #cde4ff;'>
          <div style='display:flex;gap:10px;justify-content:flex-end;'>
            <button id='save-edit-pass' style='background:#1976d2;color:#fff;padding:8px 22px;border:none;border-radius:7px;cursor:pointer;'>حفظ</button>
            <button id='cancel-edit-pass' style='background:#eee;color:#333;padding:8px 22px;border:none;border-radius:7px;cursor:pointer;'>إلغاء</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      document.getElementById('cancel-edit-pass').onclick = () => modal.remove();
      document.getElementById('save-edit-pass').onclick = async () => {
        const newPass = document.getElementById('edit-password').value;
        if (!newPass) return window.showNotification('يرجى إدخال كلمة السر الجديدة', 'error');
        await updateDoc(doc(db, "users", id), { password: newPass });
        window.showNotification('تم تغيير كلمة السر بنجاح', 'success');
        modal.remove();
        loadUsers();
      };
    };
  });
  // حذف مستخدم
  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.onclick = async () => {
      if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
      const id = btn.getAttribute('data-id');
      // جلب بيانات المستخدم
      const snapshot = await getDocs(collection(db, "users"));
      let userDoc;
      snapshot.forEach(docSnap => { if (docSnap.id === id) userDoc = docSnap; });
      if (!userDoc) return;
      const user = userDoc.data();
      // حذف من Firestore
      await deleteDoc(doc(db, "users", id));
      // حذف من Firebase Authentication (بشرط معرفة كلمة المرور)
      try {
        // تسجيل الدخول كمستخدم الهدف مؤقتاً
        const auth = getAuth();
        await signInWithEmailAndPassword(auth, user.email, user.password);
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (err) {
        // إذا فشل الحذف (مثلاً كلمة المرور غير متوفرة أو صلاحيات)، تجاهل الخطأ
      }
      window.showNotification('تم حذف المستخدم بنجاح', 'success');
      loadUsers();
    };
  });
}

// دالة توليد عناصر القائمة الجانبية حسب الصلاحيات
export function renderSidebar(permissions) {
  const sidebar = document.querySelector('.sidebar ul');
  if (!sidebar) return;
  sidebar.innerHTML = '';
  allPages.forEach(page => {
    if (permissions.includes(page.key)) {
      const li = document.createElement('li');
      li.setAttribute('data-link', page.file);
      li.innerHTML = `<a href="${page.file}">${page.label}</a>`;
      sidebar.appendChild(li);
    }
  });
}

export { allPages };

window.addEventListener("DOMContentLoaded", loadUsers);

// استيراد notifications.js تلقائياً إذا لم يكن موجوداً
if (!window.showNotification) {
  const script = document.createElement('script');
  script.src = 'js/notifications.js';
  document.head.appendChild(script);
}
