import { db } from './firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc as docFirestore, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
      const userDoc = await getDoc(docFirestore(db, 'users', user.uid));
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

// جلب جميع الفواتير الفردية فقط
async function fetchIndividualInvoices() {
  const invoicesSnap = await getDocs(collection(db, 'invoices'));
  allInvoices = [];
  let i = 1;
  invoicesSnap.forEach(inv => {
    const data = inv.data();
    if(data.subType === 'ملازم فردية' || data.subType === 'محاضرات فردية') {
      allInvoices.push({
        num: i++,
        type: data.subType,
        items: data.items || [],
        total: (data.items||[]).reduce((sum,x)=>sum+(+x.price||0),0),
        date: data.date && data.date.toDate ? data.date.toDate().toLocaleDateString() : (data.date || '-'),
        notes: data.notes || '',
        studyType: data.studyType || '-',
        grade: data.grade || '-',
        recipient: data.recipient || '-', // جلب اسم المستلم من الفاتورة
        docId: inv.id
      });
    }
  });
  filteredInvoices = [...allInvoices];
  fillRecipientFilter();
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('unsubscribed-tbody');
  const emptyDiv = document.getElementById('unsubscribed-empty');
  tbody.innerHTML = '';
  if(filteredInvoices.length === 0) {
    emptyDiv.style.display = '';
    return;
  }
  emptyDiv.style.display = 'none';
  // جلب صلاحيات المستخدم من localStorage
  let userPermissions = [];
  let userType = '';
  try {
    userPermissions = JSON.parse(localStorage.getItem('userPermissions') || '[]');
    userType = localStorage.getItem('userType') || '';
  } catch(e) {}
  // الكاشير لا يستطيع الحذف إطلاقاً
  const canDeleteInvoice = userType !== 'كاشير' && (userPermissions.includes('delete_invoice') || userPermissions.includes('unsubscribed') || userPermissions.includes('invoices'));
  filteredInvoices.forEach((inv, idx) => {
    const itemsText = inv.items.length ? inv.items.map(x=>x.name).join('، ') : '-';
    let recipientCell = `<span class="recipient-cell" style="display:inline-block;padding:4px 12px;border-radius:8px;background:linear-gradient(90deg,#e3f2fd 60%,#bbdefb 100%);color:#1976d2;font-weight:bold;font-size:1em;box-shadow:0 1px 4px #90caf922;">${inv.recipient && inv.recipient !== '-' ? inv.recipient : '<span style=\'color:#b3b3b3\'>غير محدد</span>'}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${inv.num}</td>
      <td>${inv.type}</td>
      <td style="font-size:13px;line-height:1.7;">${itemsText}</td>
      <td>${inv.total} ج</td>
      <td>${inv.date}</td>
      <td>${inv.notes}</td>
      <td>${inv.studyType || '-'}</td>
      <td><button class="edit-btn" data-idx="${idx}" style="background:#1976d2;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">تعديل</button></td>
      <td>${canDeleteInvoice ? `<button class=\"delete-btn\" data-idx=\"${idx}\" style=\"background:#f44336;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;\">حذف</button>` : ''}</td>
      <td><button class="view-btn" data-idx="${idx}" style="background:#009688;color:#fff;padding:6px 14px;border:none;border-radius:6px;cursor:pointer;">قراءة</button></td>
      <td>${recipientCell}</td>
    `;
    tbody.appendChild(tr);
  });
  // Attach event listeners for operation buttons
  tbody.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = () => showInvoiceModal(filteredInvoices[btn.dataset.idx]);
  });
  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      showEditModal(filteredInvoices[btn.dataset.idx]);
    });
  });
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => confirmDeleteInvoice(filteredInvoices[btn.dataset.idx]);
  });
}

// Modal logic
function showInvoiceModal(inv) {
  const modal = document.getElementById('unsubscribed-invoice-modal');
  modal.innerHTML = `
    <div class="modal-bg" style="position:fixed;top:0;right:0;left:0;bottom:0;background:rgba(0,0,0,0.18);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div class="modal-box" style="background:#fff;border-radius:16px;box-shadow:0 6px 32px #90caf988;padding:32px 18px 18px 18px;min-width:320px;max-width:420px;position:relative;">
        <button id="close-modal-btn" style="position:absolute;left:18px;top:18px;background:transparent;border:none;font-size:22px;color:#1976d2;cursor:pointer;">&#10006;</button>
        <h2 style="color:#1976d2;text-align:center;font-weight:bold;margin-bottom:18px;">تفاصيل الفاتورة</h2>
        <div style="margin-bottom:12px;"><b>نوع الفاتورة:</b> ${inv.type}</div>
        <div style="margin-bottom:12px;"><b>العناصر:</b> ${inv.items.map(x=>x.name).join('، ')}</div>
        <div style="margin-bottom:12px;"><b>السعر الإجمالي:</b> ${inv.total} ج</div>
        <div style="margin-bottom:12px;"><b>التاريخ:</b> ${inv.date}</div>
        <div style="margin-bottom:12px;"><b>ملاحظات:</b> ${inv.notes}</div>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  document.getElementById('close-modal-btn').onclick = () => { modal.style.display = 'none'; };
}

async function showEditModal(inv) {
  const modal = document.getElementById('unsubscribed-invoice-modal');
  modal.innerHTML = `
    <div class="modal-bg" style="position:fixed;top:0;right:0;left:0;bottom:0;background:rgba(0,0,0,0.18);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div class="modal-box" style="background:#fff;border-radius:16px;box-shadow:0 6px 32px #90caf988;padding:32px 18px 18px 18px;min-width:320px;max-width:420px;position:relative;">
        <button id="close-modal-btn" style="position:absolute;left:18px;top:18px;background:transparent;border:none;font-size:22px;color:#1976d2;cursor:pointer;">&#10006;</button>
        <h2 style="color:#1976d2;text-align:center;font-weight:bold;margin-bottom:18px;">تعديل الفاتورة</h2>
        <div style="margin-bottom:12px;"><b>ملاحظات:</b><br><textarea id="edit-notes" style="width:100%;border-radius:8px;border:1px solid #b3c6e0;padding:8px;">${inv.notes}</textarea></div>
        <div style="margin-bottom:12px;"><b>التاريخ:</b><br><input id="edit-date" type="date" value="${inv.date && inv.date!== '-' ? (new Date(inv.date.split('/').reverse().join('-')).toISOString().slice(0,10)) : ''}" style="width:100%;border-radius:8px;border:1px solid #b3c6e0;padding:8px;"></div>
        <button id="save-edit-btn" style="background:#1976d2;color:#fff;padding:8px 24px;border:none;border-radius:8px;cursor:pointer;">حفظ</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  document.getElementById('close-modal-btn').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('save-edit-btn').onclick = async () => {
    const notes = document.getElementById('edit-notes').value;
    const dateVal = document.getElementById('edit-date').value;
    if(inv.docId) {
      const docRef = doc(db, 'invoices', inv.docId);
      await updateDoc(docRef, { notes, date: dateVal ? new Date(dateVal) : inv.date });
      modal.style.display = 'none';
      fetchIndividualInvoices();
    } else {
      alert('تعذر العثور على الفاتورة الأصلية');
    }
  };
}

function confirmDeleteInvoice(inv) {
  const modal = document.getElementById('unsubscribed-invoice-modal');
  modal.innerHTML = `
    <div class="modal-bg" style="position:fixed;top:0;right:0;left:0;bottom:0;background:rgba(0,0,0,0.18);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div class="modal-box" style="background:#fff;border-radius:16px;box-shadow:0 6px 32px #90caf988;padding:32px 18px 18px 18px;min-width:320px;max-width:420px;position:relative;">
        <button id="close-modal-btn" style="position:absolute;left:18px;top:18px;background:transparent;border:none;font-size:22px;color:#1976d2;cursor:pointer;">&#10006;</button>
        <h2 style="color:#f44336;text-align:center;font-weight:bold;margin-bottom:18px;">تأكيد الحذف</h2>
        <div style="margin-bottom:18px;">هل أنت متأكد أنك تريد حذف هذه الفاتورة نهائيًا؟</div>
        <button id="delete-confirm-btn" style="background:#f44336;color:#fff;padding:8px 24px;border:none;border-radius:8px;cursor:pointer;">حذف</button>
      </div>
    </div>
  `;
  modal.style.display = 'block';
  document.getElementById('close-modal-btn').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('delete-confirm-btn').onclick = async () => {
    if(inv.docId) {
      await deleteDoc(doc(db, 'invoices', inv.docId));
      modal.style.display = 'none';
      fetchIndividualInvoices();
    } else {
      alert('تعذر العثور على الفاتورة الأصلية');
    }
  };
}

// البحث
function filterInvoices() {
  const typeVal = document.getElementById('filter-type').value;
  const gradeVal = document.getElementById('filter-grade').value;
  const monthVal = document.getElementById('filter-month').value;
  const itemVal = document.getElementById('search-item').value.trim();
  const recipientVal = document.getElementById('filter-recipient').value.trim();
  filteredInvoices = allInvoices.filter(inv => {
    const matchType = !typeVal || inv.type === typeVal;
    const matchGrade = !gradeVal || (inv.grade === gradeVal);
    // monthVal: yyyy-MM
    let matchMonth = true;
    if(monthVal && inv.date && inv.date !== '-') {
      const d = new Date(inv.date);
      const m = d.getMonth()+1, y = d.getFullYear();
      const [yy, mm] = monthVal.split('-');
      matchMonth = (+yy === y && +mm === m);
    }
    const itemMatch = !itemVal || (inv.items && inv.items.some(x => x.name.includes(itemVal)));
    const filterRecipient = recipientVal ? recipientVal : null;
    if (filterRecipient && inv.recipient !== filterRecipient) return false;
    return matchType && matchGrade && matchMonth && itemMatch;
  });
  renderTable();
}

document.getElementById('search-item').addEventListener('input', filterInvoices);
document.getElementById('export-btn').addEventListener('click', () => {
  let csv = 'رقم الفاتورة,نوع الفاتورة,العناصر,السعر الإجمالي,التاريخ,ملاحظات\n';
  filteredInvoices.forEach(inv => {
    csv += `${inv.num},${inv.type},"${inv.items.map(x=>x.name).join('، ')}",${inv.total},${inv.date},${inv.notes}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'فواتير_فردية.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// حفظ فاتورة فردية جديدة
async function saveIndividualInvoice(invoice) {
  // حفظ الفاتورة الفردية في قاعدة البيانات (invoices)
  // invoice: {type, items, total, date, notes, grade, studyType}
  await fetchCurrentRecipient(); // تأكد من جلب اسم المستلم
  await addDoc(collection(db, 'invoices'), {
    subType: invoice.type,
    items: invoice.items,
    notes: invoice.notes || '',
    date: invoice.date ? invoice.date : new Date(),
    grade: invoice.grade || '-',
    studyType: invoice.studyType || '-',
    recipient: currentRecipient || '-', // إضافة اسم المستلم
  });
  // إعادة تحميل الفواتير بعد الحفظ
  await fetchIndividualInvoices();
}

// تحديث تلقائي للفواتير الفردية عند الحفظ من الكاشير
window.addEventListener('storage', (e) => {
  if (e.key === 'invoice_saved') {
    fetchIndividualInvoices();
  }
});

// بدء التنفيذ
fetchIndividualInvoices();

// مثال للاستخدام:
// saveIndividualInvoice({type: 'ملازم فردية', items: [...], notes: '...', date: new Date()});
['filter-type','filter-grade','filter-month','search-item','filter-recipient'].forEach(id => {
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
