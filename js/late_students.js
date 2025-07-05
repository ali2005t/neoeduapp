import { db } from "./firebase.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allInvoices = [];
let lateInvoices = [];

async function loadLateStudents() {
  const snapshot = await getDocs(collection(db, "invoices"));
  allInvoices = [];
  snapshot.forEach(docSnap => {
    const inv = docSnap.data();
    inv._id = docSnap.id;
    allInvoices.push(inv);
  });
  renderLateStudentsTable();
}

function renderLateStudentsTable() {
  const lateTableBody = document.querySelector('#late-students-table-box tbody');
  if (!lateTableBody) return;
  lateInvoices = allInvoices.filter(inv => inv.payment === 'تقسيط' && !inv.installment?.paidAll);
  if (!lateInvoices.length) {
    lateTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#b3b3b3;">لا يوجد طلاب لديهم فواتير تقسيط</td></tr>';
    document.getElementById('late-students-summary').innerHTML = '';
    return;
  }
  let total = 0, paid = 0, remain = 0;
  lateTableBody.innerHTML = lateInvoices.map((inv,i) => {
    const t = +inv.installment?.total || +inv.installment?.amount || 0;
    const p = +inv.installment?.paid || +inv.installment?.paidAmount || 0;
    const r = t - p;
    total += t; paid += p; remain += r;
    return `
    <tr data-index="${i}" style="cursor:pointer;">
      <td>${i+1}</td>
      <td>${inv.student||'-'}</td>
      <td>${inv.phone||'-'}</td>
      <td>${inv.subType||'-'}</td>
      <td>${t}</td>
      <td>${p}</td>
      <td>${r}</td>
      <td>
        <select onchange="window.updatePaymentStatus('${inv._id}', this.value)" style="padding:2px 8px;">
          <option value="unpaid" ${r>0?'selected':''}>لم يدفع بعد</option>
          <option value="paid" ${r<=0?'selected':''}>تم الدفع</option>
        </select>
      </td>
    </tr>`;
  }).join('');
  // صف المجموع
  lateTableBody.innerHTML += `<tr style="background:#e3f2fd;font-weight:bold;"><td colspan="4">الإجمالي</td><td>${total}</td><td>${paid}</td><td>${remain}</td><td></td></tr>`;
  // تحديث ملخص المبالغ
  document.getElementById('late-students-summary').innerHTML = `عدد الطلاب: ${lateInvoices.length}`;
  // تفعيل تفاصيل الفاتورة عند الضغط
  Array.from(lateTableBody.querySelectorAll('tr[data-index]')).forEach(row => {
    row.onclick = function() {
      const idx = +this.getAttribute('data-index');
      showInvoiceModal(lateInvoices[idx]);
    };
  });
}

window.updatePaymentStatus = async function(id, val) {
  if (!id) return;
  const invoiceRef = doc(db, "invoices", id);
  if (val === 'paid') {
    await updateDoc(invoiceRef, { 'installment.paid': lateInvoices.find(x=>x._id===id)?.installment?.total || lateInvoices.find(x=>x._id===id)?.installment?.amount || 0, 'installment.paidAll': true });
  } else {
    await updateDoc(invoiceRef, { 'installment.paidAll': false });
  }
  loadLateStudents();
};

function showInvoiceModal(inv) {
  let html = `<div class="modal-bg" id="modal-bg"></div><div class="modal-box" id="modal-box">
    <h3>تفاصيل الفاتورة</h3>
    <div><b>اسم الطالب:</b> ${inv.student||'-'}</div>
    <div><b>رقم الهاتف:</b> ${inv.phone||'-'}</div>
    <div><b>نوع الاشتراك:</b> ${inv.subType||'-'}</div>
    <div><b>إجمالي المبلغ:</b> ${inv.installment?.total || inv.installment?.amount || '-'}</div>
    <div><b>المدفوع:</b> ${inv.installment?.paid || inv.installment?.paidAmount || '-'}</div>
    <div><b>المتبقي:</b> ${(inv.installment?.total || inv.installment?.amount ? ((+inv.installment?.total||+inv.installment?.amount||0) - (+inv.installment?.paid||+inv.installment?.paidAmount||0)) : '-')}</div>
    <div style="margin-top:18px;text-align:center;"><button onclick="window.closeModal()">إغلاق</button></div>
  </div>`;
  let modalDiv = document.createElement('div');
  modalDiv.innerHTML = html;
  document.body.appendChild(modalDiv);
  document.getElementById('modal-bg').onclick = window.closeModal;
}
// زر تصدير إلى Excel
window.exportLateStudentsToExcel = function() {
  if (!lateInvoices.length) return alert('لا يوجد بيانات للتصدير');
  let rows = lateInvoices.map(inv => ({
    'اسم الطالب': inv.student||'-',
    'رقم الهاتف': inv.phone||'-',
    'نوع الاشتراك': inv.subType||'-',
    'إجمالي المبلغ': inv.installment?.total || inv.installment?.amount || '-',
    'المدفوع': inv.installment?.paid || inv.installment?.paidAmount || '-',
    'المتبقي': (inv.installment?.total || inv.installment?.amount ? ((+inv.installment?.total||+inv.installment?.amount||0) - (+inv.installment?.paid||+inv.installment?.paidAmount||0)) : '-')
  }));
  let csv = 'اسم الطالب,رقم الهاتف,نوع الاشتراك,إجمالي المبلغ,المدفوع,المتبقي\n';
  rows.forEach(r => {
    csv += `${r['اسم الطالب']},${r['رقم الهاتف']},${r['نوع الاشتراك']},${r['إجمالي المبلغ']},${r['المدفوع']},${r['المتبقي']}\n`;
  });
  let blob = new Blob([csv], {type: 'text/csv'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'late_students.csv';
  a.click();
};

document.addEventListener("DOMContentLoaded", loadLateStudents);
