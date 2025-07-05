// js/settings.js
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const settingsForm = document.getElementById('settings-form');
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  // حفظ الإعدادات (اسم السنتر والشعار والحقول الجديدة)
  const centerName = document.getElementById('center-name-input').value;
  const contactEmail = document.getElementById('contact-email').value;
  const centerPhone = document.getElementById('center-phone').value;
  const centerPhones = document.getElementById('center-phones').value;
  const centerAddress = document.getElementById('center-address').value;
  const centerNotes = document.getElementById('center-notes').value;
  try {
    await updateDoc(doc(db, 'settings', 'main'), {
      centerName,
      contactEmail,
      centerPhone,
      centerPhones,
      centerAddress,
      centerNotes
    });
    // حفظ في localStorage أيضًا
    localStorage.setItem('centerName', centerName);
    localStorage.setItem('contactEmail', contactEmail);
    localStorage.setItem('centerPhone', centerPhone);
    localStorage.setItem('centerPhones', centerPhones);
    localStorage.setItem('centerAddress', centerAddress);
    localStorage.setItem('centerNotes', centerNotes);
    showNotification('تم حفظ الإعدادات بنجاح', 'success', 2500);
  } catch (err) {
    showNotification('حدث خطأ أثناء حفظ الإعدادات', 'error', 3500);
  }
});

// عند تحميل الصفحة: ملء الحقول بالقيم المحفوظة
window.addEventListener('DOMContentLoaded', function() {
  // تعبئة اسم السنتر وباقي الحقول
  const name = localStorage.getItem('centerName');
  if(name) document.getElementById('center-name-input').value = name;
  const email = localStorage.getItem('contactEmail');
  if(email) document.getElementById('contact-email').value = email;
  const phone = localStorage.getItem('centerPhone');
  if(phone) document.getElementById('center-phone').value = phone;
  const phones = localStorage.getItem('centerPhones');
  if(phones) document.getElementById('center-phones').value = phones;
  const address = localStorage.getItem('centerAddress');
  if(address) document.getElementById('center-address').value = address;
  const notes = localStorage.getItem('centerNotes');
  if(notes) document.getElementById('center-notes').value = notes;
});
