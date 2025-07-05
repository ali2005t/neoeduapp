import { db } from './firebase.js';
import { collection, getDocs, addDoc, Timestamp, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let selectedGrade = "";
let selectedSubType = "";
let selectedItems = [];

// متغير عالمي لاسم المستلم (يتم تحديثه من فايربيس)
let currentRecipient = '-';

// جلب اسم المستخدم الحالي من فايربيس (Firestore) بناءً على uid من Auth
async function fetchCurrentRecipient() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user && user.uid) {
      console.log('Firebase Auth UID:', user.uid);
      const userRef = doc(db, 'users', user.uid);
      let userDoc = await getDoc(userRef);
      console.log('Firestore userDoc.exists:', userDoc.exists());
      let needUpdate = false;
      let username = '';
      if (!userDoc.exists()) {
        // إذا لم توجد وثيقة، أنشئها تلقائياً باسم افتراضي
        username = user.displayName && user.displayName.trim() ? user.displayName.trim() : '';
        if (!username && user.email) {
          username = user.email.replace(/@.*/, '').trim();
        }
        if (!username) username = 'غير محدد';
        if (username.includes('@')) username = 'غير محدد';
        await setDoc(userRef, { username });
        console.log('Created user doc for:', user.uid, 'with username:', username);
        userDoc = await getDoc(userRef);
      } else {
        // إذا الوثيقة موجودة لكن username غير صالح أو ناقص
        const data = userDoc.data();
        username = data.username || data.name || '';
        if (!username || !username.trim() || username.includes('@')) {
          // تحديث الوثيقة باسم افتراضي
          username = user.displayName && user.displayName.trim() ? user.displayName.trim() : '';
          if (!username && user.email) {
            username = user.email.replace(/@.*/, '').trim();
          }
          if (!username) username = 'غير محدد';
          if (username.includes('@')) username = 'غير محدد';
          await setDoc(userRef, { username }, { merge: true });
          console.log('Updated user doc for:', user.uid, 'with username:', username);
          userDoc = await getDoc(userRef);
        }
      }
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('Firestore userDoc data:', data);
        let username = data.username || data.name;
        // لا تظهر البريد الإلكتروني أو أي نص فيه @ في خانة المستلم
        if (!username || !username.trim() || username.includes('@')) username = 'غير محدد';
        currentRecipient = username;
        console.log('Current recipient:', currentRecipient);
      } else {
        currentRecipient = 'غير محدد';
      }
    } else {
      currentRecipient = 'غير محدد';
    }
  } catch (e) {
    console.error('Error fetching recipient:', e);
    currentRecipient = 'غير محدد';
  }
  updateInvoicePreview();
}

// مراقبة حالة تسجيل الدخول وتحديث اسم المستلم تلقائياً
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user && user.uid) {
    fetchCurrentRecipient();
  } else {
    currentRecipient = 'غير محدد';
    updateInvoicePreview();
  }
});

document.querySelectorAll('.grade-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedGrade = btn.dataset.grade;
    document.getElementById('grade').value = selectedGrade;
    // إظهار قسم الأنواع عند اختيار فرقة
    document.getElementById('subs-section').style.display = 'flex';
    // إعادة تعيين اختيار النوع والعناصر عند تغيير الفرقة
    selectedSubType = '';
    document.getElementById('sub-type').value = '';
    selectedItems = [];
    document.getElementById('items-container').innerHTML = '';
    updateInvoicePreview();
  });
});

document.querySelectorAll('.sub-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    selectedSubType = btn.dataset.type;
    document.getElementById('sub-type').value = selectedSubType;
    const items = await getItemsForSubType(selectedSubType, selectedGrade);
    showSelectableItems(items);
  });
});

// تحويل اسم زر الاشتراك إلى اسم النوع في قاعدة البيانات
function mapSubTypeToDbType(subType) {
  if (subType === "اشتراك كورسات") return "كورسات";
  if (subType === "اشتراك ملازم") return "ملازم";
  return subType; // "محاضرات فردية" أو "ملازم فردية"
}

// جلب العناصر من فايربيس حسب النوع والفرقة (يدعم اختيار ملازم فردية أو محاضرات فردية من كل الاشتراكات)
async function getItemsForSubType(subType, grade) {
  if (!subType || !grade) return [];
  const snapshot = await getDocs(collection(db, "subscriptions"));
  const items = [];
  if (subType === "ملازم فردية") {
    // جلب كل الملازم الفردية لهذه الفرقة فقط (يجب أن يكون النوع "ملازم فردية" في صفحة الاشتراكات والأسعار)
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === "ملازم فردية" && data.grade === grade) {
        items.push({ name: data.name, price: data.price });
      }
    });
  } else if (subType === "محاضرات فردية") {
    // جلب كل المحاضرات الفردية لهذه الفرقة فقط
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === "محاضرات فردية" && data.grade === grade) {
        items.push({ name: data.name, price: data.price });
      }
    });
  } else {
    // منطق الاشتراكات العادي
    const dbType = mapSubTypeToDbType(subType);
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === dbType && data.grade === grade) {
        items.push({ name: data.name, price: data.price });
      }
    });
  }
  return items;
}

// تحديث معاينة الفاتورة الحية (عناصر مختارة)
function updateInvoicePreview() {
  const preview = document.getElementById('preview-box');
  if (!preview) return;
  const grade = selectedGrade;
  const studyType = document.getElementById('study-type')?.value || '';
  const subType = selectedSubType;
  const payment = document.getElementById('payment-method')?.value || '';
  const notes = document.getElementById('notes')?.value || '';
  let items = [];
  if (window.selectedItems && Array.isArray(window.selectedItems)) {
    items = window.selectedItems;
  }
  // استخدم اسم المستلم من فايربيس
  let recipient = currentRecipient || '-';
  // معاينة الفاتورة حسب النوع
  let html = `<div class="invoice-preview-modern">
    <h3 class='invoice-preview-title'>معاينة الفاتورة</h3>`;
  if(subType === 'محاضرات فردية' || subType === 'ملازم فردية') {
    html += `
      <div class='invoice-preview-grid'>
        <span>الفرقة:</span><span>${grade || '-'}</span>
        <span>نوع الاشتراك:</span><span>${subType || '-'}</span>
        <span>انتظام/انتساب:</span><span>${studyType || '-'}</span>
      </div>
      <div class='invoice-preview-items-box'>
        <b>العناصر:</b>
        <ul class='invoice-preview-items-list'>
          ${items.length ? items.map(x=>`<li><span class='preview-item-name' style='font-weight:500;'>${x.name}</span> <span class='preview-item-price' style='color:#388e3c;font-weight:bold;'>${x.price} ج</span></li>`).join('') : '<li>لا يوجد عناصر</li>'}
        </ul>
        <div class='invoice-preview-total'><b>المجموع:</b> <span>${items.reduce((sum,x)=>sum+(+x.price||0),0)} ج</span></div>
      </div>
      <div class='invoice-preview-grid'>
        <span>طريقة الدفع:</span><span>${payment || '-'}</span>
        <span>ملاحظات:</span><span>${notes || '-'}</span>
      </div>
      <div class='invoice-preview-recipient'>المستلم: ${recipient}</div>
    </div>`;
  } else {
    html += `
      <div class='invoice-preview-grid'>
        <span>الفرقة:</span><span>${grade || '-'}</span>
        <span>اسم الطالب:</span><span>${document.getElementById('student-name')?.value || '-'}</span>
        <span>رقم الهاتف:</span><span>${document.getElementById('phone')?.value || '-'}</span>
        <span>نوع الاشتراك:</span><span>${subType || '-'}</span>
        <span>انتظام/انتساب:</span><span>${studyType || '-'}</span>
      </div>
      <div class='invoice-preview-items-box'>
        <b>العناصر:</b>
        <ul class='invoice-preview-items-list'>
          ${items.length ? items.map(x=>`<li><span class='preview-item-name' style='font-weight:500;'>${x.name}</span> <span class='preview-item-price' style='color:#388e3c;font-weight:bold;'>${x.price} ج</span></li>`).join('') : '<li>لا يوجد عناصر</li>'}
        </ul>
        <div class='invoice-preview-total'><b>المبلغ المدفوع:</b> <span>${items.reduce((sum,x)=>sum+(+x.price||0),0)} ج</span></div>
      </div>
      <div class='invoice-preview-grid'>
        <span>طريقة الدفع:</span><span>${payment || '-'}</span>
        <span>ملاحظات:</span><span>${notes || '-'}</span>
      </div>
      <div class='invoice-preview-recipient'>المستلم: ${recipient}</div>
    </div>`;
  }
  preview.innerHTML = html;
  // لا تفعيل أي تعديل على اسم أو سعر العنصر في المعاينة
}

// تعريف demoBtn مرة واحدة فقط في الأعلى
const demoBtn = document.getElementById('demo-mode-btn');
if (demoBtn) {
  demoBtn.addEventListener('click', () => {
    document.body.classList.toggle('demo-mode');
    demoBtn.classList.toggle('active');
    document.getElementById('preview-box').classList.toggle('demo');
    // عند التفعيل، لا يسمح بالحفظ
    if (document.body.classList.contains('demo-mode')) {
      demoBtn.textContent = 'خروج من الوضع التجريبي';
    } else {
      demoBtn.textContent = 'الوضع التجريبي';
    }
  });
}

// تعريف invoiceForm مرة واحدة فقط في الأعلى
const invoiceForm = document.getElementById('invoice-form');
// تعطيل الحفظ في الوضع التجريبي
invoiceForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  if(!validateForm()) return;
  if(document.body.classList.contains('demo-mode')) {
    showNotification('الوضع التجريبي: لن يتم حفظ الفاتورة فعليًا', 'info', 2500);
    return;
  }
  showConfirmDialog('هل أنت متأكد من حفظ الفاتورة؟', async () => {
    let student = '', phone = '';
    if(selectedSubType !== 'محاضرات فردية' && selectedSubType !== 'ملازم فردية') {
      student = document.getElementById('student-name').value;
      phone = document.getElementById('phone').value;
    }
    const itemsToSave = Array.isArray(window.selectedItems) && window.selectedItems.length > 0 ? [...window.selectedItems] : [];
    const invoice = {
      grade: selectedGrade,
      studyType: document.getElementById('study-type').value,
      subType: mapSubTypeToDbType(selectedSubType), // التوحيد هنا
      items: itemsToSave,
      payment: document.getElementById('payment-method').value,
      notes: document.getElementById('notes').value,
      date: Timestamp.now(),
      recipient: currentRecipient || '-',
      // إضافة بيانات التقسيط إذا كانت موجودة
      installment: {
        total: document.getElementById('installment-total')?.value || '',
        paid: document.getElementById('installment-paid')?.value || '',
        remaining: document.getElementById('installment-remaining')?.value || ''
      }
    };
    if(selectedSubType !== 'محاضرات فردية' && selectedSubType !== 'ملازم فردية') {
      invoice.student = student;
      invoice.phone = phone;
    }
    // --- إضافة ربط الملازم الفردية في اشتراك ملازم ---
    if(selectedSubType === 'اشتراك ملازم') {
      // جلب كل الملازم الفردية المتاحة لهذه الفرقة
      const allSubsSnap = await getDocs(collection(db, "subscriptions"));
      const indivNotes = [];
      allSubsSnap.forEach(doc => {
        const data = doc.data();
        if(data.type === 'ملازم فردية' && data.grade === selectedGrade) {
          indivNotes.push({ name: data.name, price: data.price, delivered: false });
        }
      });
      invoice.indivNotes = indivNotes;
    }
    try {
      await addDoc(collection(db, 'invoices'), invoice);
      localStorage.setItem('invoice_saved', Date.now());
      showNotification('تم حفظ الفاتورة بنجاح', 'success', 2500);
    } catch (err) {
      showNotification('حدث خطأ أثناء الحفظ، تأكد من الاتصال بالإنترنت', 'error', 3500);
      return;
    }
    document.getElementById('invoice-form').reset();
    selectedItems = [];
    window.selectedItems = [];
    document.getElementById('items-container').innerHTML = '';
    updateInvoicePreview();
    resetSelectedItemsBox();
  });
});

// إظهار/إخفاء حقول الطالب والهاتف حسب نوع الاشتراك
function updateFormFields() {
  const subType = document.getElementById('sub-type')?.value || selectedSubType;
  const studentGroup = document.getElementById('student-group');
  const phoneGroup = document.getElementById('phone-group');
  const studentInput = document.getElementById('student-name');
  const phoneInput = document.getElementById('phone');
  const mainFields = document.getElementById('main-fields');
  const paymentField = document.getElementById('payment-method')?.closest('.form-group,div');
  const notesField = document.getElementById('notes')?.closest('.form-group,div');
  const studyTypeField = document.getElementById('study-type')?.closest('.form-group,div');
  if(subType === 'محاضرات فردية' || subType === 'ملازم فردية') {
    if(studentGroup) studentGroup.style.display = 'none';
    if(phoneGroup) phoneGroup.style.display = 'none';
    if(studentInput) studentInput.removeAttribute('required');
    if(phoneInput) phoneInput.removeAttribute('required');
    if(mainFields) mainFields.style.display = '';
    if(paymentField) paymentField.style.display = '';
    if(notesField) notesField.style.display = '';
    if(studyTypeField) studyTypeField.style.display = '';
  } else {
    if(studentGroup) studentGroup.style.display = '';
    if(phoneGroup) phoneGroup.style.display = '';
    if(studentInput) studentInput.setAttribute('required', 'required');
    if(phoneInput) phoneInput.setAttribute('required', 'required');
    if(mainFields) mainFields.style.display = '';
    if(paymentField) paymentField.style.display = '';
    if(notesField) notesField.style.display = '';
    if(studyTypeField) studyTypeField.style.display = '';
  }
}
document.getElementById('sub-type').addEventListener('input', updateFormFields);

// تحديث العناصر المختارة في نموذج الفاتورة
function updateSelectedItemsBox() {
  const list = document.getElementById('selected-items-list');
  if (!list) return;
  if (selectedItems.length === 0) {
    list.textContent = 'لا يوجد عناصر مختارة.';
  } else {
    list.textContent = selectedItems.map(i => i.name + ' (' + i.price + 'ج)').join('، ');
  }
  // تحديث العناصر المختارة في نموذج المحاكاة
  window.selectedItems = selectedItems;
  updateInvoicePreview();
}

// تحديث المعاينة عند اختيار العناصر
function showSelectableItems(items) {
  const container = document.getElementById('items-container');
  let table = document.getElementById('items-table');
  // إذا لم يوجد الجدول، أنشئه ديناميكياً
  if (!table) {
    table = document.createElement('table');
    table.id = 'items-table';
    table.style.width = '100%';
    table.innerHTML = `
      <thead>
        <tr>
          <th>اسم العنصر</th>
          <th>السعر</th>
          <th>إجراء</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    container.appendChild(table);
  }
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#888;">لا توجد عناصر متاحة لهذا النوع والفرقة.</td></tr>';
    table.style.display = '';
    container.innerHTML = '';
    container.appendChild(table);
    updateInvoicePreview();
    updateSelectedItemsBox();
    return;
  }
  table.style.display = '';
  container.innerHTML = '';
  container.appendChild(table);
  items.forEach(item => {
    const tr = document.createElement('tr');
    const isSelected = selectedItems.find(i => i.name === item.name);
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price} ج</td>
      <td><button class="${isSelected ? 'remove' : ''}">${isSelected ? 'إزالة' : 'إضافة'}</button></td>
    `;
    const btn = tr.querySelector('button');
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = selectedItems.findIndex(i => i.name === item.name);
      if (idx === -1) {
        selectedItems.push({...item});
        btn.textContent = 'إزالة';
        btn.classList.add('remove');
      } else {
        selectedItems.splice(idx, 1);
        btn.textContent = 'إضافة';
        btn.classList.remove('remove');
      }
      updateSelectedItemsBox();
      showSelectableItems(items);
    };
    tbody.appendChild(tr);
  });
  updateSelectedItemsBox();
}

// عند اختيار نوع الاشتراك
[...document.querySelectorAll('.sub-btn')].forEach(btn => {
  btn.addEventListener('click', async () => {
    selectedSubType = btn.dataset.type;
    document.getElementById('sub-type').value = selectedSubType;
    updateFormFields();
    const items = await getItemsForSubType(selectedSubType, selectedGrade);
    showSelectableItems(items);
    updateInvoicePreview(); // تأكيد تحديث المعاينة
  });
});

// عند اختيار الفرقة
[...document.querySelectorAll('.grade-btn')].forEach(btn => {
  btn.addEventListener('click', () => {
    selectedGrade = btn.dataset.grade;
    document.getElementById('grade').value = selectedGrade;
    updateInvoicePreview();
    // إعادة تعيين العناصر المختارة عند تغيير الفرقة
    selectedItems = [];
    window.selectedItems = [];
    resetSelectedItemsBox();
    // إعادة تحميل العناصر المتاحة للنوع الحالي (إن وجد)
    if(selectedSubType) {
      getItemsForSubType(selectedSubType, selectedGrade).then(showSelectableItems);
    }
  });
});

// التأكد من صحة البيانات قبل الحفظ
function validateForm() {
  if(!selectedGrade || !selectedSubType) return false;
  if(selectedSubType !== 'محاضرات فردية' && selectedSubType !== 'ملازم فردية') {
    const student = document.getElementById('student-name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const studyType = document.getElementById('study-type').value;
    // اسم الطالب ثلاثي
    if(student.split(' ').filter(Boolean).length < 3) {
      showNotification('يرجى إدخال اسم الطالب ثلاثي على الأقل', 'error', 3500);
      return false;
    }
    // رقم الهاتف 11 رقم
    if(!/^01[0-9]{9}$/.test(phone)) {
      showNotification('يرجى إدخال رقم هاتف صحيح مكون من 11 رقم يبدأ بـ 01', 'error', 3500);
      return false;
    }
    // انتظام/انتساب
    if(!studyType || (studyType !== 'انتظام' && studyType !== 'انتساب')) {
      showNotification('يرجى اختيار انتظام أو انتساب', 'error', 3500);
      return false;
    }
  }
  // التحقق من العناصر المختارة من window.selectedItems دائمًا
  if(!window.selectedItems || !Array.isArray(window.selectedItems) || window.selectedItems.length === 0) {
    showNotification('يرجى اختيار عنصر واحد على الأقل', 'error', 3500);
    return false;
  }
  return true;
}

function showNotification(msg, type = 'info', duration = 2000) {
  let notif = document.getElementById('global-notif');
  if (!notif) {
    notif = document.createElement('div');
    notif.id = 'global-notif';
    notif.style.position = 'fixed';
    notif.style.top = '18px';
    notif.style.left = '50%';
    notif.style.transform = 'translateX(-50%)';
    notif.style.zIndex = '9999';
    notif.style.minWidth = '200px';
    notif.style.maxWidth = '90vw';
    notif.style.padding = '16px 36px';
    notif.style.borderRadius = '12px';
    notif.style.fontSize = '18px';
    notif.style.fontWeight = 'bold';
    notif.style.boxShadow = '0 2px 16px #90caf988';
    notif.style.textAlign = 'center';
    notif.style.transition = 'opacity 0.7s';
    document.body.appendChild(notif);
  }
  notif.textContent = msg;
  notif.style.background = type === 'success' ? '#43a047' : (type === 'error' ? '#e53935' : '#1976d2');
  notif.style.color = '#fff';
  notif.style.opacity = '1';
  notif.style.pointerEvents = 'auto';
  setTimeout(() => {
    notif.style.opacity = '0';
    setTimeout(()=>{if(notif)notif.remove();}, 800);
  }, duration);
}

// نافذة تأكيد مخصصة بدلاً من confirm
function showConfirmDialog(message, onConfirm, onCancel) {
  // إزالة أي نافذة تأكيد سابقة
  const old = document.getElementById('custom-confirm');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'custom-confirm';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.25)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';
  overlay.innerHTML = `
    <div style="background:#fff;padding:32px 28px 22px 28px;border-radius:16px;box-shadow:0 4px 32px #1976d244,0 1px 8px #90caf922;min-width:280px;max-width:90vw;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#1976d2;margin-bottom:18px;">${message}</div>
      <div style="display:flex;gap:18px;justify-content:center;">
        <button id="confirm-yes" style="background:#43a047;color:#fff;padding:10px 32px;border:none;border-radius:8px;font-size:17px;font-weight:bold;cursor:pointer;">تأكيد</button>
        <button id="confirm-no" style="background:#e53935;color:#fff;padding:10px 28px;border:none;border-radius:8px;font-size:17px;font-weight:bold;cursor:pointer;">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('confirm-yes').onclick = () => {
    overlay.remove();
    if(onConfirm) onConfirm();
  };
  document.getElementById('confirm-no').onclick = () => {
    overlay.remove();
    if(onCancel) onCancel();
  };
}

// تحديث المعاينة عند تحميل الصفحة
updateInvoicePreview();
// عند تحميل الصفحة، إخفاء قسم الأنواع
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('subs-section').style.display = 'none';
  fetchCurrentRecipient(); // جلب اسم المستلم من فايربيس
  updateInvoicePreview();
  // مراقبة تغيير اسم المستخدم في localStorage وتحديث المعاينة فوراً
  window.addEventListener('storage', function(e) {
    if(e.key === 'username') updateInvoicePreview();
  });
});

// عند إعادة تعيين النموذج أو تغيير الفرقة، حدث خانة العناصر المختارة
function resetSelectedItemsBox() {
  const list = document.getElementById('selected-items-list');
  if (list) list.textContent = 'لا يوجد عناصر مختارة.';
}

// ربط التحديث الفوري للمعاينة مع كل تغيير في الحقول
['student-name','phone','grade','study-type','sub-type','payment-method','notes'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateInvoicePreview);
    el.addEventListener('change', updateInvoicePreview);
  }
});

// زر الطباعة في الكاشير
const printBtn = document.getElementById('print-btn');
if (printBtn) {
  printBtn.addEventListener('click', function() {
    // بيانات الفاتورة
    const grade = document.getElementById('grade')?.value || '';
    const studyType = document.getElementById('study-type')?.value || '';
    const subType = document.getElementById('sub-type')?.value || '';
    const payment = document.getElementById('payment-method')?.value || '';
    const notes = document.getElementById('notes')?.value || '';
    const student = document.getElementById('student-name')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const items = window.selectedItems || [];
    const total = items.reduce((sum, x) => sum + (+x.price || 0), 0);
    const date = new Date().toLocaleString('ar-EG');
    // نص الإيصال الحراري
    let receipt = '';
    receipt += '*** مركز الدروس ***\n';
    receipt += '-----------------------------\n';
    if(student) receipt += `الاسم: ${student}\n`;
    if(phone) receipt += `الهاتف: ${phone}\n`;
    if(grade) receipt += `الفرقة: ${grade}\n`;
    if(subType) receipt += `النوع: ${subType}\n`;
    if(studyType && studyType !== 'انتظام / انتساب') receipt += `النظام: ${studyType}\n`;
    receipt += '-----------------------------\n';
    receipt += 'العناصر:\n';
    items.forEach(x => {
      receipt += `${x.name}  ${x.price}ج\n`;
    });
    receipt += '-----------------------------\n';
    receipt += `الإجمالي: ${total} ج\n`;
    if(payment) receipt += `الدفع: ${payment}\n`;
    if(notes) receipt += `ملاحظات: ${notes}\n`;
    receipt += `المستلم: ${recipient}\n`;
    receipt += `التاريخ: ${date}\n`;
    receipt += '-----------------------------\n';
    receipt += 'شكراً لزيارتكم\n';
    // نافذة طباعة حرارية (خط أحادي)
    const win = window.open('', '', 'width=350,height=600');
    win.document.write(`
      <html><head><title>إيصال حراري</title>
      <style>
        body { font-family: monospace; font-size: 13px; direction: rtl; padding: 0 8px; }
        pre { margin: 0; white-space: pre; }
      </style>
      </head><body><pre>${receipt}</pre></body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();win.close();}, 400);
  });
}

// إخفاء القائمة الجانبية (sidebar) في وضع الهاتف (عرض أقل من أو يساوي 900px) في صفحة الكاشير، وإظهار التابات السفلية فقط.
function handleMobileCashierLayout() {
  const sidebar = document.querySelector('.sidebar');
  const tabs = document.querySelector('.mobile-tabs');
  const invoiceForm = document.getElementById('cashier-invoice-form');
  const simulationBox = document.getElementById('cashier-simulation-box');
  if(window.innerWidth <= 900) {
    if(sidebar) sidebar.style.display = 'none';
    if(tabs) tabs.style.display = 'flex';
    // نقل النموذج والمحاكاة لأسفل الصفحة
    if(invoiceForm && simulationBox) {
      simulationBox.parentElement.appendChild(invoiceForm);
      simulationBox.parentElement.appendChild(simulationBox);
      invoiceForm.style.marginTop = '24px';
      simulationBox.style.marginTop = '18px';
    }
  } else {
    if(sidebar) sidebar.style.display = '';
    if(tabs) tabs.style.display = 'none';
    // يمكن إعادة النموذج والمحاكاة لمكانهما الأصلي إذا لزم الأمر
  }
}
window.addEventListener('resize', handleMobileCashierLayout);
window.addEventListener('DOMContentLoaded', handleMobileCashierLayout);

// تحديث المتبقي تلقائياً عند إدخال الإجمالي أو المدفوع
const totalInput = document.getElementById('installment-total');
const paidInput = document.getElementById('installment-paid');
const remainingInput = document.getElementById('installment-remaining');
function updateInstallmentRemaining() {
  const total = +totalInput.value || 0;
  const paid = +paidInput.value || 0;
  const remaining = Math.max(total - paid, 0);
  remainingInput.value = remaining;
}
if (totalInput && paidInput && remainingInput) {
  totalInput.addEventListener('input', updateInstallmentRemaining);
  paidInput.addEventListener('input', updateInstallmentRemaining);
}

// إظهار/إخفاء حقول التقسيط عند اختيار طريقة الدفع
const paymentMethod = document.getElementById('payment-method');
const installmentFields = document.getElementById('installment-fields');
if (paymentMethod && installmentFields) {
  paymentMethod.addEventListener('change', function() {
    if (this.value === 'تقسيط') {
      installmentFields.style.display = '';
    } else {
      installmentFields.style.display = 'none';
      // إعادة تعيين الحقول عند الإخفاء
      installmentFields.querySelectorAll('input,select').forEach(el => {
        if (el.type === 'number' || el.type === 'date') el.value = '';
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
      });
    }
  });
}
