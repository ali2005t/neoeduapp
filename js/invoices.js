// js/invoices.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { collection as collection2, getDocs as getDocs2 } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc as doc2, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const tableBody = document.querySelector("#invoices-table tbody");
const modal = document.getElementById("invoice-details-modal");

// متغيرات لتخزين الفواتير الكل والفواتير المصفاة
let allInvoices = [];
let filteredInvoices = [];

// متغير عالمي لاسم المستلم
let currentRecipient = '-';

// جلب اسم المستخدم الحالي من فايربيس (Firestore) بناءً على uid من Auth
async function fetchCurrentRecipient() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && user.uid) {
      // جلب بيانات المستخدم من Firestore (مجموعة users)
      const userDoc = await getDoc(doc2(db, 'users', user.uid));
      if (userDoc.exists()) {
        currentRecipient = userDoc.data().username || userDoc.data().name || user.email || '-';
      } else {
        currentRecipient = user.email || '-';
      }
    } else {
      currentRecipient = '-';
    }
  } catch (e) {
    currentRecipient = '-';
  }
}

// مراقبة حالة تسجيل الدخول وتحديث اسم المستلم تلقائياً
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  fetchCurrentRecipient();
});

// تحميل الفواتير
async function loadInvoices() {
  tableBody.innerHTML = "<tr><td colspan='10'>جاري التحميل...</td></tr>";
  const snapshot = await getDocs(collection(db, "invoices"));
  tableBody.innerHTML = "";
  let i = 1;
  allInvoices = [];
  snapshot.forEach(docSnap => {
    const inv = docSnap.data();
    // استبعاد الفواتير الفردية من صفحة الفواتير الرئيسية
    if(inv.subType === 'ملازم فردية' || inv.subType === 'محاضرات فردية') return;
    allInvoices.push({
      id: docSnap.id,
      num: i++,
      student: inv.student || '-',
      phone: inv.phone || '',
      subType: inv.subType || '-',
      items: inv.items || [],
      payment: inv.payment || '-',
      studyType: inv.studyType || '-',
      grade: inv.grade || '-',
      date: inv.date ? (inv.date.toDate ? inv.date.toDate().toLocaleDateString('ar-EG') : inv.date) : '-',
      status: inv.status || 'تم الحفظ',
      recipient: inv.recipient || '-', // جلب اسم المستلم من الفاتورة
      notes: inv.notes || '-',
    });
  });
  filteredInvoices = [...allInvoices];
  fillRecipientFilter();
  renderInvoicesTable();
}

// عرض الفواتير في الجدول
function renderInvoicesTable() {
  tableBody.innerHTML = '';
  if(filteredInvoices.length === 0) {
    tableBody.innerHTML = "<tr><td colspan='12'>لا توجد نتائج مطابقة.</td></tr>";
    return;
  }
  // جلب صلاحيات المستخدم من localStorage
  let userPermissions = [];
  let userType = '';
  try {
    userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    userType = localStorage.getItem('userType') || '';
  } catch(e) {}
  // الكاشير لا يستطيع الحذف إطلاقاً
  const canDeleteInvoice = userType !== 'كاشير' && (userPermissions.includes('delete_invoice') || userPermissions.includes('invoices'));
  filteredInvoices.forEach(inv => {
    const isGroup = inv.student && inv.student !== '-' && inv.subType !== 'محاضرات فردية' && inv.subType !== 'ملازم فردية';
    const phoneCell = isGroup ? (inv.phone || '-') : '-';
    const itemsText = (inv.items && inv.items.length) ? inv.items.map(x => x.name).join('، ') : '-';
    // تحسين مظهر المستلم
    let recipientCell = `<span class="recipient-cell" style="display:inline-block;padding:4px 12px;border-radius:8px;background:linear-gradient(90deg,#e3f2fd 60%,#bbdefb 100%);color:#1976d2;font-weight:bold;font-size:1em;box-shadow:0 1px 4px #90caf922;">${inv.recipient && inv.recipient !== '-' ? inv.recipient : '<span style=\'color:#b3b3b3\'>غير محدد</span>'}</span>`;
    const tr = document.createElement("tr");
    let actions = `<button class='open-invoice-btn' data-id='${inv.id}' style='background:#1976d2;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;'>قراءة</button>`;
    if (canDeleteInvoice) {
      actions += `<button class='delete-invoice-btn' data-id='${inv.id}' style='background:#f44336;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;'>حذف</button>`;
    }
    tr.innerHTML = `
      <td>${inv.num}</td>
      <td>${inv.student}</td>
      <td>${phoneCell}</td>
      <td style='font-size:13px;line-height:1.7;'>${itemsText}</td>
      <td>${inv.subType}</td>
      <td>${inv.grade}</td>
      <td>${(inv.items||[]).reduce((sum,x)=>sum+(x.price||0),0)} ج</td>
      <td>${inv.payment}</td>
      <td>${inv.studyType}</td>
      <td>${inv.date}</td>
      <td>${inv.notes||'-'}</td>
      <td>${recipientCell}</td>
      <td style='display:flex;gap:6px;justify-content:center;align-items:center;'>${actions}</td>
    `;
    tableBody.appendChild(tr);
  });
  // إعادة ربط الأحداث
  document.querySelectorAll('.open-invoice-btn').forEach(btn => {
    btn.onclick = () => {
      showInvoiceModal(btn.getAttribute('data-id'));
      showNotification('تم فتح تفاصيل الفاتورة', 'info');
    };
  });
  document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('هل أنت متأكد من حذف الفاتورة نهائيًا؟')) return;
      try {
        await deleteDoc(doc(db, 'invoices', id));
        window.showNotification('تم حذف الفاتورة بنجاح', 'success');
        loadInvoices();
      } catch (e) {
        window.showNotification('حدث خطأ أثناء حذف الفاتورة: ' + (e.message || e), 'error');
      }
    };
  });
}

// إضافة أحداث التصفية على عناصر التحكم
['filter-invoice-num','filter-type','filter-grade','filter-study-type','search-student','search-phone','filter-recipient'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', filterInvoices);
});

// تعبئة قائمة المستلمين تلقائياً من الفواتير
function fillRecipientFilter() {
  const select = document.getElementById('filter-recipient');
  if (!select) return;
  const recipients = Array.from(new Set(allInvoices.map(inv => inv.recipient).filter(x => x && x !== '-')));
  select.innerHTML = '<option value="">كل المستلمين</option>' + recipients.map(r => `<option value="${r}">${r}</option>`).join('');
}

// تصفية الفواتير بناءً على القيم المختارة في الفلاتر
function filterInvoices() {
  const invoiceNum = document.getElementById('filter-invoice-num').value.trim();
  const subType = document.getElementById('filter-type').value;
  const grade = document.getElementById('filter-grade').value;
  const studyType = document.getElementById('filter-study-type').value;
  const student = document.getElementById('search-student').value.trim();
  const phone = document.getElementById('search-phone').value.trim();
  const recipient = document.getElementById('search-recipient').value.trim(); // إضافة فلتر المستلم
  filteredInvoices = allInvoices.filter(inv => {
    const matchNum = !invoiceNum || (inv.num+'' === invoiceNum);
    const matchSubType = !subType || inv.subType === subType;
    const matchGrade = !grade || inv.grade === grade;
    const matchStudyType = !studyType || inv.studyType === studyType;
    const matchStudent = !student || (inv.student && inv.student.includes(student));
    const matchPhone = !phone || (inv.phone && inv.phone.includes(phone));
    const matchRecipient = !recipient || (inv.recipient && inv.recipient.includes(recipient)); // شرط فلترة المستلم
    return matchNum && matchSubType && matchGrade && matchStudyType && matchStudent && matchPhone && matchRecipient;
  });
  renderInvoicesTable();
}

// عرض نافذة تفاصيل الفاتورة
async function showInvoiceModal(id) {
  const snapshot = await getDocs(collection(db, "invoices"));
  let invDoc;
  snapshot.forEach(docSnap => { if (docSnap.id === id) invDoc = docSnap; });
  if (!invDoc) return alert("لم يتم العثور على الفاتورة!");
  const inv = invDoc.data();
  // إصلاح تعريف isNotesSubscription
  const isNotesSubscription = inv.subType && (inv.subType === 'اشتراك ملازم' || inv.subType === 'ملازم');

  // --- جلب ملازم فردية محدثة من الاشتراكات والأسعار إذا كانت الفاتورة اشتراك ملازم أو ملازم ---
  let indivNotesList = [];
  if ((inv.subType === 'اشتراك ملازم' || inv.subType === 'ملازم') && inv.grade) {
    const subsSnap = await getDocs2(collection2(db, "subscriptions"));
    subsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.type === 'ملازم فردية' && data.grade === inv.grade) {
        // إذا كانت الملزمة موجودة في الفاتورة، استخدم حالة الاستلام منها
        let delivered = false;
        if (Array.isArray(inv.indivNotes)) {
          const found = inv.indivNotes.find(n => n.name === data.name);
          if (found) delivered = found.delivered;
        }
        indivNotesList.push({ name: data.name, price: data.price, delivered });
      }
    });
  }
  // مربعات استلام الملازم في اشتراك ملازم
  let notesDeliveryBoxes = '';
  if ((inv.subType === 'اشتراك ملازم' || inv.subType === 'ملازم') && Array.isArray(inv.items) && inv.items.length > 0) {
    notesDeliveryBoxes = `<div style='margin:18px 0 0 0;'><b style='color:#1976d2;'>حالة استلام الملازم:</b><div style='display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;'>` +
      inv.items.map((x,i) =>
        `<div style='background:#e3f2fd;border-radius:10px;padding:10px 18px;min-width:120px;display:flex;align-items:center;gap:8px;'>
          <span style='font-weight:500;'>${x.name}</span>
          <span style='color:#388e3c;font-weight:bold;'>${x.price} ج</span>
          <span style='margin-right:8px;${x.delivered?"color:#43a047;":"color:#e53935;"}'>
            ${x.delivered ? 'تم الاستلام' : 'لم يستلم بعد'}
          </span>
        </div>`
      ).join('') + '</div></div>';
  }
  // --- مربعات استلام الملازم الفردية حسب الفرقة ---
  let indivNotesBoxes = '';
  if ((inv.subType === 'اشتراك ملازم' || inv.subType === 'ملازم') && indivNotesList.length > 0) {
    indivNotesBoxes = `<div style='margin:18px 0 0 0;'>
      <b style='color:#1976d2;'>ملازم فردية حسب الفرقة (محدثة):</b>
      <div class='indiv-notes-list'>
        ${indivNotesList.map((x,i) =>
          `<div class='indiv-note-box'>
            <span class='note-name'>${x.name}</span>
            <span class='note-price'>${x.price} ج</span>
            <input type='checkbox' class='indiv-note-delivered-checkbox' data-idx='${i}' ${x.delivered ? 'checked' : ''} title='تغيير حالة الاستلام'>
            <span class='delivered-status ${x.delivered ? 'delivered' : 'not-delivered'}'>${x.delivered ? 'تم الاستلام' : 'لم يستلم بعد'}</span>
          </div>`
        ).join('')}
      </div>
    </div>`;
  }
  // --- قسم الملازم الفردية المتاحة في الاشتراك مع مربع استلام ---
  let availableIndivNotesSection = '';
  if (inv.subType === 'اشتراك ملازم' && Array.isArray(inv.indivNotes) && inv.indivNotes.length > 0) {
    availableIndivNotesSection = `<div style='margin:18px 0 0 0;'><b style='color:#1976d2;'>الملازم الفردية المتاحة في الاشتراك:</b><div style='display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;'>` +
      inv.indivNotes.map((x,i) =>
        `<div style='background:#fffde7;border-radius:10px;padding:10px 18px;min-width:180px;display:flex;align-items:center;gap:8px;border:1.5px solid #ffd600;'>
          <span style='font-weight:500;'>${x.name}</span>
          <span style='color:#388e3c;font-weight:bold;'>${x.price} ج</span>
          <input type='checkbox' disabled ${x.delivered ? 'checked' : ''} style='width:18px;height:18px;accent-color:#43a047;margin-right:8px;' title='تم الاستلام'>
        </div>`
      ).join('') + '</div></div>';
  }
  // بناء النافذة بتصميم عصري وجذاب
  // إضافة اسم السنتر والعنوان في أعلى الفاتورة عند الطباعة
  // جلب بيانات السنتر من localStorage
  const centerName = localStorage.getItem('centerName') || 'اسم السنتر';
  const centerAddress = localStorage.getItem('centerAddress') || 'العنوان: ...';
  const centerPhone = localStorage.getItem('centerPhone') || '';
  const centerPhones = localStorage.getItem('centerPhones') || '';
  // عرض أرقام السنتر إذا وجدت
  let phoneHtml = '';
  if(centerPhone) {
    phoneHtml += `<div style='font-size:1.05rem;color:#1976d2;margin-bottom:4px;'>أرقام السنتر: <b style='color:#222;'>${centerPhone}</b></div>`;
  }
  if(centerPhones) {
    phoneHtml += `<div style='font-size:1.05rem;color:#1976d2;margin-bottom:4px;'>أرقام السنتر: <b style='color:#222;'>${centerPhones}</b></div>`;
  }
  modal.innerHTML = `
    <div style="background:linear-gradient(120deg,#e3f2fd 60%,#fff 100%);border-radius:18px;box-shadow:0 6px 32px #90caf988,0 2px 8px #e3e3e3cc;padding:32px 18px 18px 18px;max-width:480px;min-width:320px;position:relative;">
      <button id='close-invoice-modal' style='position:absolute;left:18px;top:18px;background:transparent;border:none;font-size:22px;color:#1976d2;cursor:pointer;' title='إغلاق'>&#10006;</button>
      <h2 style='margin-bottom:18px;color:#1976d2;text-align:center;font-weight:bold;'>تفاصيل الفاتورة</h2>
      <div id="printable-invoice">
        <div style='text-align:center;margin-bottom:18px;'>
          <div style='font-size:1.25rem;font-weight:bold;color:#1976d2;'>${centerName}</div>
        </div>
        <div style='margin-bottom:12px;'><b>اسم الطالب:</b> ${inv.student||'-'}</div>
        <div style='margin-bottom:12px;'><b>الفرقة:</b> ${inv.grade||'-'}</div>
        <div style='margin-bottom:12px;'><b>نوع الاشتراك:</b> ${inv.subType||'-'}</div>
        <div style='margin-bottom:12px;'><b>انتظام/انتساب:</b> ${inv.studyType||'-'}</div>
        <div style='margin-bottom:12px;'><b>طريقة الدفع:</b> ${inv.payment||'-'}</div>
        <div style='margin-bottom:12px;'><b>العناصر:</b> ${(inv.items||[]).map(x=>x.name+" ("+x.price+" ج)").join('، ')||'-'}</div>
        ${notesDeliveryBoxes}
        ${availableIndivNotesSection}
        ${indivNotesBoxes}
        <div style='margin-bottom:12px;'><b>المبلغ المدفوع:</b> ${(inv.items||[]).reduce((sum,x)=>sum+(x.price||0),0)} ج</div>
        <div style='margin-bottom:12px;'><b>التاريخ:</b> ${inv.date ? (inv.date.toDate ? inv.date.toDate().toLocaleDateString('ar-EG') : inv.date) : '-'}</div>
        <div style='margin-bottom:12px;'><b>ملاحظات:</b> ${inv.notes||'-'}</div>
        <hr style='margin:18px 0 10px 0;border:0;border-top:1.5px dashed #90caf9;'>
        <div style='text-align:center;margin-top:10px;'>
          <div style='font-size:1.05rem;color:#1976d2;margin-bottom:4px;'>${centerAddress ? 'العنوان: <b style=\'color:#222;\'>' + centerAddress + '</b>' : ''}</div>
          ${phoneHtml}
        </div>
      </div>
      <div style='display:flex;gap:10px;justify-content:center;margin-bottom:8px;margin-top:18px;'>
        <button id='print-invoice-btn' style='background:#388e3c;color:#fff;padding:8px 22px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 2px 8px #388e3c22;'>طباعة</button>
        <button id='save-invoice-edit' style='background:#1976d2;color:#fff;padding:8px 28px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 2px 8px #1976d222;'>حفظ</button>
        <button id='delete-invoice' style='background:#f44336;color:#fff;padding:8px 22px;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 2px 8px #f4433622;'>حذف</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
  modal.style.display = 'block';

  // زر الطباعة
  document.getElementById('print-invoice-btn').onclick = () => {
    const printContents = document.getElementById('printable-invoice').innerHTML;
    const win = window.open('', '', 'width=700,height=900');
    win.document.write(`
      <html><head><title>طباعة الفاتورة</title>
      <style>body{font-family:'Cairo',Arial,sans-serif;direction:rtl;padding:24px;}b{color:#1976d2;}div{margin-bottom:10px;font-size:18px;}</style>
      </head><body>${printContents}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();win.close();}, 400);
  };

  // --- تفعيل تحديث حالة الاستلام ---
  if (isNotesSubscription) {
    modal.querySelectorAll('.item-delivered-checkbox').forEach(cb => {
      cb.addEventListener('change', async function() {
        const idx = +cb.getAttribute('data-idx');
        itemsWithDelivery[idx].delivered = cb.checked;
        // تحديث في قاعدة البيانات
        await updateDoc(doc(db, 'invoices', id), { items: itemsWithDelivery });
        showNotification(cb.checked ? 'تم تسجيل استلام الملزمة' : 'تم إلغاء الاستلام', 'success');
        // تحديث العرض مباشرة
        cb.parentElement.style.fontWeight = cb.checked ? 'bold' : 'normal';
      });
    });
  }
  // تفعيل تحديث حالة الاستلام لملازم indivNotes (المحدثة)
  if ((inv.subType === 'اشتراك ملازم' || inv.subType === 'ملازم') && indivNotesList.length > 0) {
    modal.querySelectorAll('.indiv-note-delivered-checkbox').forEach(cb => {
      cb.disabled = false;
      cb.addEventListener('change', async function() {
        const idx = +cb.getAttribute('data-idx');
        indivNotesList[idx].delivered = cb.checked;
        // احفظ الحالة الجديدة في الفاتورة (indivNotes)
        await updateDoc(doc(db, 'invoices', id), { indivNotes: indivNotesList });
        showNotification(cb.checked ? 'تم تسجيل استلام الملزمة' : 'تم إلغاء الاستلام', 'success');
        // تحديث النص واللون مباشرة
        const statusSpan = cb.parentElement.querySelector('.delivered-status');
        if(statusSpan) {
          statusSpan.textContent = cb.checked ? 'تم الاستلام' : 'لم يستلم بعد';
          statusSpan.className = 'delivered-status ' + (cb.checked ? 'delivered' : 'not-delivered');
        }
      });
    });
  }

  // إغلاق
  document.getElementById('close-invoice-modal').onclick = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  };
  // حفظ التعديلات
  document.getElementById('save-invoice-edit').onclick = async () => {
    const newStudent = document.getElementById('edit-student').value;
    const newGrade = document.getElementById('edit-grade').value;
    const newSubType = document.getElementById('edit-subType').value;
    const newStudyType = document.getElementById('edit-studyType').value;
    const newPayment = document.getElementById('edit-payment').value;
    const newNotes = document.getElementById('edit-notes').value;
    await updateDoc(doc(db, 'invoices', id), {
      student: newStudent,
      grade: newGrade,
      subType: newSubType,
      studyType: newStudyType,
      payment: newPayment,
      notes: newNotes,
      items: items
    });
    showNotification('تم حفظ التعديلات بنجاح', 'success');
    modal.classList.remove('active');
    modal.style.display = 'none';
    loadInvoices();
  };
  // حذف الفاتورة
  document.getElementById('delete-invoice').onclick = async () => {
    if (!confirm('هل أنت متأكد من حذف الفاتورة نهائيًا؟')) return;
    await deleteDoc(doc(db, 'invoices', id));
    showNotification('تم حذف الفاتورة بنجاح', 'success');
    modal.classList.remove('active');
    modal.style.display = 'none';
    loadInvoices();
  };
}

// إشعار بسيط أعلى الصفحة
function showNotification(msg, type = 'info') {
  let notif = document.getElementById('global-notif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'global-notif';
    notif.style.position = 'fixed';
    notif.style.top = '30px';
    notif.style.left = '50%';
    notif.style.transform = 'translateX(-50%)';
    notif.style.zIndex = '9999';
    notif.style.minWidth = '180px';
    notif.style.padding = '14px 32px';
    notif.style.borderRadius = '10px';
    notif.style.fontSize = '17px';
    notif.style.fontWeight = 'bold';
    notif.style.boxShadow = '0 2px 16px #90caf988';
    notif.style.textAlign = 'center';
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  notif.style.background = type === 'success' ? '#43a047' : (type === 'error' ? '#e53935' : '#1976d2');
  notif.style.color = '#fff';
  notif.style.opacity = '1';
  notif.style.pointerEvents = 'auto';
  setTimeout(() => {
    notif.style.transition = 'opacity 0.7s';
    notif.style.opacity = '0';
    setTimeout(()=>{if(notif)notif.remove();}, 800);
  }, 1800);
}

// --- تصدير الفواتير إلى Excel ---
document.getElementById('export-excel-btn').onclick = function() {
  try {
    if (!filteredInvoices.length) {
      showNotification('لا توجد بيانات لتصديرها', 'error');
      return;
    }
    // تجهيز البيانات
    const data = filteredInvoices.map(inv => ({
      'رقم الفاتورة': inv.num,
      'اسم الطالب': inv.student,
      'رقم الهاتف': inv.phone,
      'العناصر': (inv.items||[]).map(x=>x.name+" ("+x.price+" ج)").join('، '),
      'نوع الاشتراك': inv.subType,
      'الفرقة': inv.grade,
      'المبلغ المدفوع': (inv.items||[]).reduce((sum,x)=>sum+(x.price||0),0),
      'نوع الفاتورة': inv.payment,
      'انتظام/انتساب': inv.studyType,
      'التاريخ': inv.date,
      'الملاحظات': inv.notes||'-'
    }));
    // إنشاء ملف Excel
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الفواتير');
    XLSX.writeFile(wb, 'invoices.xlsx');
    showNotification('تم تصدير الفواتير إلى Excel بنجاح', 'success');
  } catch(e) {
    showNotification('حدث خطأ أثناء التصدير: '+e.message, 'error');
  }
};

window.addEventListener("DOMContentLoaded", loadInvoices);

// تحسين إشعار حذف الفاتورة
window.deleteInvoice = async (id) => {
  if (!id) return window.showNotification('لم يتم تحديد الفاتورة للحذف', 'error');
  // إشعار تأكيد قبل الحذف
  const confirmModal = document.createElement('div');
  confirmModal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0003;z-index:4000;display:flex;align-items:center;justify-content:center;';
  confirmModal.innerHTML = `
    <div style="background:#fff;padding:30px 24px;border-radius:14px;min-width:320px;max-width:90vw;box-shadow:0 4px 32px #90caf988;text-align:center;">
      <div style="font-size:1.2em;font-weight:bold;margin-bottom:18px;color:#e53935;">تأكيد حذف الفاتورة</div>
      <div style="margin-bottom:22px;">هل أنت متأكد أنك تريد حذف هذه الفاتورة نهائيًا؟</div>
      <div style="display:flex;gap:16px;justify-content:center;">
        <button id="confirm-delete-invoice" style="background:#e53935;color:#fff;padding:8px 28px;border:none;border-radius:8px;font-size:1em;font-weight:bold;cursor:pointer;">حذف</button>
        <button id="cancel-delete-invoice" style="background:#eee;color:#333;padding:8px 28px;border:none;border-radius:8px;font-size:1em;cursor:pointer;">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
  document.getElementById('cancel-delete-invoice').onclick = () => confirmModal.remove();
  document.getElementById('confirm-delete-invoice').onclick = async () => {
    try {
      await deleteDoc(doc(db, "invoices", id));
      window.showNotification('<span style="font-size:1.15em;font-weight:bold;">تم حذف الفاتورة بنجاح</span>', 'success', 2500);
      loadInvoices();
    } catch (e) {
      window.showNotification('<span style="font-size:1.15em;font-weight:bold;">حدث خطأ أثناء الحذف: ' + (e.message || e) + '</span>', 'error', 3500);
    }
    confirmModal.remove();
  };
};
