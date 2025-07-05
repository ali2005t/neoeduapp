// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyCPUcUywZQfxPjPiTZB9MdmZfZ9TTgcy2g",
  authDomain: "eduction-center-8585c.firebaseapp.com",
  projectId: "eduction-center-8585c",
  storageBucket: "eduction-center-8585c.appspot.com",
  messagingSenderId: "698707209700",
  appId: "1:698707209700:web:b78592b2117cd102072bf1",
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// التصدير
export const auth = getAuth(app);
export const db = getFirestore(app);
