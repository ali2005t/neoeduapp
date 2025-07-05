import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// استيراد Chart.js بشكل متوافق مع المتصفح
import 'https://cdn.jsdelivr.net/npm/chart.js';

// --- تعريف متغير allInvoices كمتغير عام في أعلى الملف ---
let allInvoices = [];

function filterInvoiceByDate(inv, period, dateVal, monthVal, yearVal) {
  if (!inv.date) return false;
  let d = inv.date;
  if (typeof d === "object" && d.toDate) d = d.toDate();
  else d = new Date(d);
  if (period === "day" && dateVal) {
    const sel = new Date(dateVal);
    return d.getFullYear() === sel.getFullYear() && d.getMonth() === sel.getMonth() && d.getDate() === sel.getDate();
  }
  if (period === "month" && monthVal) {
    const [y, m] = monthVal.split("-");
    return d.getFullYear() === +y && d.getMonth() + 1 === +m;
  }
  if (period === "year" && yearVal) {
    return d.getFullYear() === +yearVal;
  }
  return true;
}

// دالة تطبيع اسم الفرقة
function normalizeGrade(g) {
  if (!g) return 'الفرقة الأولى';
  g = g.trim();
  if (g === 'أولى' || g === 'الأولى' || g === '1' || g === 'الفرقة الاولي' || g === 'الفرقة الأولى' || g === 'اولي') return 'الفرقة الأولى';
  if (g === 'ثانية' || g === 'الثانية' || g === '2' || g === 'الفرقة الثانية') return 'الفرقة الثانية';
  if (g === 'ثالثة' || g === 'الثالثة' || g === '3' || g === 'الفرقة الثالثة') return 'الفرقة الثالثة';
  if (g === 'رابعة' || g === 'الرابعة' || g === '4' || g === 'الفرقة الرابعة') return 'الفرقة الرابعة';
  return g;
}

async function loadReports() {
  // جلب أسماء الفرق من localStorage أو القيم الافتراضية
  let grades = JSON.parse(localStorage.getItem('grades') || '["الفرقة الأولى","الفرقة الثانية","الفرقة الثالثة","الفرقة الرابعة"]');
  // تصحيح أي أخطاء إملائية شائعة في أسماء الفرق
  const allowedGrades = ['الفرقة الأولى','الفرقة الثانية','الفرقة الثالثة','الفرقة الرابعة'];
  grades = grades.map(g => {
    if (g.trim() === 'الفرقة الاياي' || g.trim() === 'الفرقة الاولي' || g.trim() === '' || g.trim() === 'اولي' || g.trim() === 'الأولي' || g.trim() === 'الأولى') return 'الفرقة الأولى';
    if (g.trim() === 'الفرقة الثانية' || g.trim() === 'الثانية') return 'الفرقة الثانية';
    if (g.trim() === 'الفرقة الثالثة' || g.trim() === 'الثالثة') return 'الفرقة الثالثة';
    if (g.trim() === 'الفرقة الرابعة' || g.trim() === 'الرابعة') return 'الفرقة الرابعة';
    return g;
  }).filter(g => allowedGrades.includes(g));
  // ضمان وجود "الفرقة الأولى" دائماً في الجدول
  if (!grades.includes('الفرقة الأولى')) grades.unshift('الفرقة الأولى');

  // جلب تفعيل خيار انتظام/انتساب
  let showStudyType = localStorage.getItem('showStudyType') === '1';

  // أرباح حسب النوع
  const byType = { 'كورسات': 0, 'ملازم': 0, 'محاضرات فردية': 0, 'ملازم فردية': 0 };
  // أرباح حسب الفرقة
  const byGrade = {};
  // توزيع انتظام/انتساب
  const byStudyType = {};
  grades.forEach(g => {
    byGrade[g] = {};
    byStudyType[g] = { 'انتظام': 0, 'انتساب': 0 };
  });
  const period = document.getElementById('filter-period')?.value || 'all';
  const dateVal = document.getElementById('filter-date')?.value;
  const monthVal = document.getElementById('filter-month')?.value;
  const yearVal = document.getElementById('filter-year')?.value;
  // جلب بيانات الفواتير الجماعية والفردية معًا
  const snapshot = await getDocs(collection(db, "invoices"));
  snapshot.forEach(docSnap => {
    const inv = docSnap.data();
    if (!filterInvoiceByDate(inv, period, dateVal, monthVal, yearVal)) return;
    // تطبيع اسم الفرقة
    const grade = normalizeGrade(inv.grade);
    // أرباح حسب النوع (يشمل فقط الأنواع الأربعة المعتمدة)
    if (inv.subType && inv.items && Array.isArray(inv.items)) {
      if (['كورسات','ملازم','محاضرات فردية','ملازم فردية'].includes(inv.subType)) {
        byType[inv.subType] = (byType[inv.subType]||0) + (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
      }
    }
    // أرباح حسب الفرقة (يشمل فقط الفرق الأربع المعتمدة)
    if (['الفرقة الأولى','الفرقة الثانية','الفرقة الثالثة','الفرقة الرابعة'].includes(grade) && inv.subType && ['كورسات','ملازم','محاضرات فردية','ملازم فردية'].includes(inv.subType)) {
      // تأكد من تهيئة القيم الافتراضية
      if (!byGrade[grade]) byGrade[grade] = {};
      if (!byGrade[grade][inv.subType]) byGrade[grade][inv.subType] = 0;
      byGrade[grade][inv.subType] += (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
    }
    // توزيع انتظام/انتساب (فقط إذا كانت الفرقة معتمدة)
    if (
      ['الفرقة الأولى','الفرقة الثانية','الفرقة الثالثة','الفرقة الرابعة'].includes(grade) &&
      inv.student && inv.student !== '-' && inv.student.trim() !== '' &&
      inv.studyType && (inv.studyType === 'انتظام' || inv.studyType === 'انتساب') &&
      byStudyType[grade] && byStudyType[grade][inv.studyType] !== undefined
    ) {
      byStudyType[grade][inv.studyType]++;
    }
  });
  // تحديث مربعات الأرباح
  document.getElementById('profit-courses').textContent = (byType['كورسات']||0) + ' ج';
  document.getElementById('profit-notes').textContent = (byType['ملازم']||0) + ' ج';
  document.getElementById('profit-lectures').textContent = (byType['محاضرات فردية']||0) + ' ج';
  document.getElementById('profit-indiv-notes').textContent = (byType['ملازم فردية']||0) + ' ج';
  // تحديث الجدول الثاني (الأرباح لكل فرقة)
  const gradeTable = document.querySelectorAll('#reports-summary table')[0];
  const gradeRows = gradeTable.querySelectorAll('tbody tr');
  let types = ['كورسات','ملازم','محاضرات فردية','ملازم فردية'];
  grades.forEach((g,gi)=>{
    types.forEach((t,ti)=>{
      if (gradeRows[gi]) gradeRows[gi].children[ti+1].textContent = (byGrade[g][t]||0)+' ج';
    });
    // تحديث اسم الفرقة في الجدول
    if (gradeRows[gi]) gradeRows[gi].children[0].textContent = g;
  });
  // توزيع الطلاب انتظام/انتساب
  setTimeout(() => {
    const studyTable = document.querySelectorAll('#reports-summary table')[1];
    if (studyTable) {
      const studyRows = studyTable.querySelectorAll('tbody tr');
      grades.forEach((g,gi)=>{
        if (studyRows[gi]) {
          studyRows[gi].children[0].textContent = g;
          studyRows[gi].children[1].textContent = byStudyType[g]['انتظام']||0;
          studyRows[gi].children[2].textContent = byStudyType[g]['انتساب']||0;
        }
      });
    }
  }, 0);

  // رسم بياني للأرباح حسب النوع
  const ctx = document.getElementById('reports-chart-canvas');
  if (ctx) {
    if (window.reportsChart) window.reportsChart.destroy();
    window.reportsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['كورسات', 'ملازم', 'محاضرات فردية', 'ملازم فردية'],
        datasets: [{
          label: 'إجمالي الأرباح (جنيه)',
          data: [byType['كورسات'], byType['ملازم'], byType['محاضرات فردية'], byType['ملازم فردية']],
          backgroundColor: ['#1976d2', '#43a047', '#fbc02d', '#8e24aa'],
          borderRadius: 12,
          borderWidth: 2,
          borderColor: '#fff',
          hoverBackgroundColor: ['#0d47a1', '#2e7d32', '#f9a825', '#6a1b9a'],
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(25, 118, 210, 0.15)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'الأرباح حسب النوع', font: { size: 22, weight: 'bold' } },
          tooltip: { enabled: true, backgroundColor: '#fff', titleColor: '#1976d2', bodyColor: '#333', borderColor: '#1976d2', borderWidth: 1 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e3eaf2' }, ticks: { color: '#1976d2', font: { size: 15 } } },
          x: { grid: { display: false }, ticks: { color: '#333', font: { size: 15 } } }
        }
      }
    });
  }

  // رسم بياني دائري لنسبة أرباح كل نوع
  const pieCtx = document.getElementById('reports-pie-canvas');
  if (pieCtx) {
    if (window.reportsPieChart) window.reportsPieChart.destroy();
    window.reportsPieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['كورسات', 'ملازم', 'محاضرات فردية', 'ملازم فردية'],
        datasets: [{
          data: [byType['كورسات'], byType['ملازم'], byType['محاضرات فردية'], byType['ملازم فردية']],
          backgroundColor: ['#1976d2', '#43a047', '#fbc02d', '#8e24aa'],
          borderColor: '#fff',
          borderWidth: 2,
          hoverOffset: 16
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#1976d2', font: { size: 16, weight: 'bold' } } },
          title: { display: true, text: 'نسبة أرباح كل نوع', font: { size: 22, weight: 'bold' } },
          tooltip: { enabled: true, backgroundColor: '#fff', titleColor: '#1976d2', bodyColor: '#333', borderColor: '#1976d2', borderWidth: 1 }
        }
      }
    });
  }

  // رسم بياني خطي لتطور الأرباح عبر الشهور
  const lineCtx = document.getElementById('reports-line-canvas');
  if (lineCtx) {
    if (window.reportsLineChart) window.reportsLineChart.destroy();
    // تجميع الأرباح لكل شهر
    const months = Array.from({length: 12}, (_, i) => i+1);
    const now = new Date();
    const year = now.getFullYear();
    const monthlyTotals = Array(12).fill(0);
    snapshot.forEach(docSnap => {
      const inv = docSnap.data();
      let d = inv.date;
      if (d && d.toDate) d = d.toDate();
      else d = new Date(d);
      if (d.getFullYear() === year) {
        const m = d.getMonth();
        monthlyTotals[m] += (inv.items||[]).reduce((sum,x)=>sum+(x.price||0),0);
      }
    });
    window.reportsLineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
        datasets: [{
          label: 'إجمالي الأرباح (جنيه)',
          data: monthlyTotals,
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.10)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#1976d2',
          pointRadius: 6,
          pointHoverRadius: 10,
          borderWidth: 3,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
          shadowBlur: 8,
          shadowColor: 'rgba(25, 118, 210, 0.10)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'تطور الأرباح عبر شهور السنة الحالية', font: { size: 22, weight: 'bold' } },
          tooltip: { enabled: true, backgroundColor: '#fff', titleColor: '#1976d2', bodyColor: '#333', borderColor: '#1976d2', borderWidth: 1 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e3eaf2' }, ticks: { color: '#1976d2', font: { size: 15 } } },
          x: { grid: { display: false }, ticks: { color: '#333', font: { size: 15 } } }
        }
      }
    });
  }

  // رسم بياني للأرباح حسب الانتساب/الانتظام
  const barCtx = document.getElementById('reports-bar-canvas');
  if (barCtx) {
    if (window.reportsBarChart) window.reportsBarChart.destroy();
    const regular = grades.map(g=>byStudyType[g]['انتظام']);
    const affiliate = grades.map(g=>byStudyType[g]['انتساب']);
    window.reportsBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: grades,
        datasets: [
          { label: 'انتظام', data: regular, backgroundColor: '#1976d2', borderRadius: 10, borderWidth: 2, borderColor: '#fff', hoverBackgroundColor: '#0d47a1' },
          { label: 'انتساب', data: affiliate, backgroundColor: '#fbc02d', borderRadius: 10, borderWidth: 2, borderColor: '#fff', hoverBackgroundColor: '#f9a825' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'عدد الاشتراكات حسب الانتساب/الانتظام', font: { size: 22, weight: 'bold' } },
          legend: { position: 'top', labels: { color: '#1976d2', font: { size: 16, weight: 'bold' } } },
          tooltip: { enabled: true, backgroundColor: '#fff', titleColor: '#1976d2', bodyColor: '#333', borderColor: '#1976d2', borderWidth: 1 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e3eaf2' }, ticks: { color: '#1976d2', font: { size: 15 } } },
          x: { grid: { display: false }, ticks: { color: '#333', font: { size: 15 } } }
        }
      }
    });
  }

  // --- إحصائيات سريعة ---
  let invoiceCount = 0;
  let totalIncome = 0;
  allInvoices = [];
  snapshot.forEach(docSnap => {
    const inv = docSnap.data();
    if (!filterInvoiceByDate(inv, period, dateVal, monthVal, yearVal)) return;
    allInvoices.push(inv);
    invoiceCount++;
    if (inv.items && Array.isArray(inv.items)) {
      totalIncome += (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
    }
  });
  // تحديث الإحصائيات السريعة
  document.querySelector('.quick-stats .stat-box:nth-child(1) div').textContent = invoiceCount;
  document.querySelector('.quick-stats .stat-box:nth-child(2) div').textContent = totalIncome + ' ج';

  // --- تقرير حسب المستلم/الكاشير ---
  // استخراج جميع المستلمين
  const recipients = Array.from(new Set(allInvoices.map(inv => inv.recipient).filter(x => x && x !== '-')));
  const select = document.getElementById('report-recipient-select');
  if (select) {
    select.innerHTML = '<option value="">كل المستلمين</option>' + recipients.map(r => `<option value="${r}">${r}</option>`).join('');
  }
  // عرض جدول الفواتير حسب المستلم
  function renderRecipientTable() {
    const selected = select ? select.value : '';
    const filtered = selected ? allInvoices.filter(inv => inv.recipient === selected) : allInvoices;
    const tbody = document.querySelector('#recipient-report-table-box tbody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#b3b3b3;">لا توجد بيانات</td></tr>';
    } else {
      tbody.innerHTML = filtered.map((inv,i) => `
        <tr>
          <td>${i+1}</td>
          <td>${inv.subType||'-'}</td>
          <td>${(inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0)} ج</td>
          <td>${inv.date && inv.date.toDate ? inv.date.toDate().toLocaleDateString() : (inv.date || '-')}</td>
        </tr>
      `).join('');
    }
    // تمت إزالة صف أرباح اليوم للمستلم نهائياً من الجدول الرئيسي
    // --- أرباح كل مستلم حسب اليوم (جدول منفصل) ---
    (() => {
      const today = new Date();
      const todayStr = today.toLocaleDateString();
      let profitsByRecipient = {};
      allInvoices.forEach(inv => {
        if (!inv.recipient || inv.recipient === '-') return;
        let d = inv.date;
        if (d && d.toDate) d = d.toDate();
        else d = new Date(d);
        if (d.toLocaleDateString() === todayStr) {
          if (!profitsByRecipient[inv.recipient]) profitsByRecipient[inv.recipient] = 0;
          profitsByRecipient[inv.recipient] += (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
        }
      });
      const profitEntries = Object.entries(profitsByRecipient);
      let profitTable = '';
      if (profitEntries.length) {
        profitTable = `
          <div style="margin-top:18px;margin-bottom:8px;font-weight:bold;color:#1976d2;">جدول أرباح اليوم لكل مستلم (${todayStr})</div>
          <table class="report-table" style="width:100%;background:#e3f2fd;border-radius:10px;box-shadow:0 1px 8px #e3f2fd44;margin-bottom:12px;">
            <thead><tr><th>المستلم</th><th>أرباح اليوم</th></tr></thead>
            <tbody>
              ${profitEntries.map(([name, profit]) => `<tr><td>${name}</td><td>${profit} ج</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
      // تعبئة القسم الجديد في الصفحة
      const todayProfitSection = document.getElementById('recipient-today-profit-section');
      if (todayProfitSection) todayProfitSection.innerHTML = profitTable;
    })();
    // --- أرباح كل مستلم لكل يوم (جدول منفصل) ---
    (() => {
      // تجميع أرباح كل مستلم لكل يوم
      let profitsByRecipientDay = {};
      allInvoices.forEach(inv => {
        if (!inv.recipient || inv.recipient === '-') return;
        let d = inv.date;
        if (d && d.toDate) d = d.toDate();
        else d = new Date(d);
        const dayStr = d.toLocaleDateString();
        const key = inv.recipient + '||' + dayStr;
        if (!profitsByRecipientDay[key]) profitsByRecipientDay[key] = { name: inv.recipient, day: dayStr, profit: 0 };
        profitsByRecipientDay[key].profit += (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
      });
      const profitEntries = Object.values(profitsByRecipientDay).sort((a,b)=>{
        // الأحدث أولاً
        if (a.day === b.day) return a.name.localeCompare(b.name);
        return new Date(b.day) - new Date(a.day);
      });
      let profitTable = '';
      if (profitEntries.length) {
        profitTable = `
          <div style="margin-top:18px;margin-bottom:8px;font-weight:bold;color:#1976d2;">جدول أرباح كل مستلم لكل يوم</div>
          <table class="report-table" style="width:100%;background:#e3f2fd;border-radius:10px;box-shadow:0 1px 8px #e3f2fd44;margin-bottom:12px;">
            <thead><tr><th>المستلم</th><th>التاريخ</th><th>إجمالي الأرباح</th></tr></thead>
            <tbody>
              ${profitEntries.map(e => `<tr><td>${e.name}</td><td>${e.day}</td><td>${e.profit} ج</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }
      // إزالة أي جدول أرباح يومي سابق
      const oldTable = tbody.parentElement.parentElement.querySelector('.report-table[style*="background:#e3f2fd"]:not([data-type="today"])');
      if (oldTable) oldTable.parentElement.removeChild(oldTable.previousElementSibling), oldTable.parentElement.removeChild(oldTable);
      // إضافة الجدول بعد جدول الفواتير
      if (profitTable) {
        tbody.parentElement.insertAdjacentHTML('afterend', profitTable);
      }
    })();
  }
  if (select) {
    select.onchange = renderRecipientTable;
    renderRecipientTable();
  }
  // تفعيل تقرير الطلاب المتأخرين في الدفع
  renderLateStudentsTable();

  // --- تعبئة جدول ربح كل مستلم (اليوم فقط) ---
  let profitsByRecipientToday = {};
  const today = new Date();
  const todayStr = today.toLocaleDateString();
  allInvoices.forEach(inv => {
    if (!inv.recipient || inv.recipient === '-') return;
    let d = inv.date;
    if (d && d.toDate) d = d.toDate();
    else d = new Date(d);
    if (d.toLocaleDateString() === todayStr) {
      profitsByRecipientToday[inv.recipient] = (profitsByRecipientToday[inv.recipient] || 0) + (inv.items||[]).reduce((sum,x)=>sum+(+x.price||0),0);
    }
  });
  const profitEntriesToday = Object.entries(profitsByRecipientToday).sort((a,b)=>b[1]-a[1]);
  const profitTbody = document.querySelector('#recipient-total-profit-table tbody');
  if (profitTbody) {
    if (!profitEntriesToday.length) {
      profitTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#b3b3b3;">لا توجد بيانات</td></tr>';
    } else {
      profitTbody.innerHTML = profitEntriesToday.map(([name, profit]) => `<tr><td>${name}</td><td>${profit} ج</td></tr>`).join('');
    }
  }
}

// --- تصدير التقارير إلى Excel ---
document.getElementById('export-excel-btn').onclick = function() {
  try {
    // جمع بيانات الأرباح حسب النوع
    const profitData = [
      {
        'نوع الاشتراك': 'كورسات',
        'الإجمالي': document.getElementById('profit-courses').textContent
      },
      {
        'نوع الاشتراك': 'ملازم',
        'الإجمالي': document.getElementById('profit-notes').textContent
      },
      {
        'نوع الاشتراك': 'محاضرات فردية',
        'الإجمالي': document.getElementById('profit-lectures').textContent
      },
      {
        'نوع الاشتراك': 'ملازم فردية',
        'الإجمالي': document.getElementById('profit-indiv-notes').textContent
      }
    ];
    // جمع بيانات الجدول الأول (الأرباح لكل فرقة)
    const gradeTable = document.querySelectorAll('#reports-summary table')[0];
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    const gradeData = [];
    gradeRows.forEach(row => {
      gradeData.push({
        'الفرقة': row.children[0].textContent,
        'كورسات': row.children[1].textContent,
        'ملازم': row.children[2].textContent,
        'محاضرات فردية': row.children[3].textContent,
        'ملازم فردية': row.children[4].textContent
      });
    });
    // جمع بيانات الجدول الثاني (انتظام/انتساب)
    const studyTable = document.querySelectorAll('#reports-summary table')[1];
    const studyRows = studyTable.querySelectorAll('tbody tr');
    const studyData = [];
    studyRows.forEach(row => {
      studyData.push({
        'الفرقة': row.children[0].textContent,
        'انتظام': row.children[1].textContent,
        'انتساب': row.children[2].textContent
      });
    });
    // إنشاء ملف Excel
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(profitData);
    XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الأرباح');
    const ws2 = XLSX.utils.json_to_sheet(gradeData);
    XLSX.utils.book_append_sheet(wb, ws2, 'الأرباح حسب الفرقة');
    const ws3 = XLSX.utils.json_to_sheet(studyData);
    XLSX.utils.book_append_sheet(wb, ws3, 'انتظام-انتساب');
    XLSX.writeFile(wb, 'reports.xlsx');
    showNotification('تم تصدير التقارير إلى Excel بنجاح', 'success');
  } catch(e) {
    showNotification('حدث خطأ أثناء التصدير: '+e.message, 'error');
  }
};

window.addEventListener("DOMContentLoaded", () => {
  // إظهار حقول التاريخ المناسبة حسب الفلتر
  const periodSel = document.getElementById('filter-period');
  const dateInput = document.getElementById('filter-date');
  const monthInput = document.getElementById('filter-month');
  const yearInput = document.getElementById('filter-year');
  function updateDateInputs() {
    if (!periodSel) return;
    dateInput.style.display = periodSel.value === 'day' ? '' : 'none';
    monthInput.style.display = periodSel.value === 'month' ? '' : 'none';
    yearInput.style.display = periodSel.value === 'year' ? '' : 'none';
  }
  if (periodSel) {
    periodSel.addEventListener('change', () => {
      updateDateInputs();
      loadReports();
    });
  }
  if (dateInput) dateInput.addEventListener('change', loadReports);
  if (monthInput) monthInput.addEventListener('change', loadReports);
  if (yearInput) yearInput.addEventListener('input', loadReports);
  updateDateInputs();
  loadReports();

  // تحديث أسماء الفرق في رؤوس الجداول عند تحميل الصفحة (في حال تغيرت)
  let grades = JSON.parse(localStorage.getItem('grades') || '["الفرقة الأولى","الفرقة الثانية","الفرقة الثالثة","الفرقة الرابعة"]');
  // تحديث رؤوس الجدول الأول
  const gradeTable = document.querySelectorAll('#reports-summary table')[0];
  if (gradeTable) {
    const gradeRows = gradeTable.querySelectorAll('tbody tr');
    grades.forEach((g,gi)=>{
      if (gradeRows[gi]) gradeRows[gi].children[0].textContent = g;
    });
  }
  // تحديث رؤوس الجدول الثاني
  const studyTable = document.querySelectorAll('#reports-summary table')[1];
  if (studyTable) {
    const studyRows = studyTable.querySelectorAll('tbody tr');
    grades.forEach((g,gi)=>{
      if (studyRows[gi]) studyRows[gi].children[0].textContent = g;
    });
  }
});

// --- جدول الطلاب المتأخرين في الدفع ---
function renderLateStudentsTable() {
  // ابحث عن جميع الفواتير التي بها تقسيط وحالة القسط غير مدفوع وتاريخ الاستحقاق أقل من اليوم
  const lateTableBody = document.querySelector('#late-students-table tbody');
  if (!lateTableBody) return;
  const today = new Date();
  // --- تشخيص: طباعة جميع الفواتير التي بها installment ---
  if (typeof allInvoices !== 'undefined') {
    const withInstallment = allInvoices.filter(inv => inv.installment);
    console.log('الفواتير التي بها installment:', withInstallment);
    withInstallment.forEach(inv => {
      console.log('inst.status:', inv.installment.status, 'inst.dueDate:', inv.installment.dueDate, 'inv:', inv);
    });
    if (!withInstallment.length) {
      alert('لا توجد أي فواتير بها بيانات تقسيط (installment) في قاعدة البيانات!');
    }
  }
  // اجمع الفواتير التي بها تقسيط فقط (بدون شرط تاريخ الاستحقاق)
  const lateInvoices = allInvoices.filter(inv => {
    // أي فاتورة payment = "تقسيط" تظهر في الجدول
    return inv.payment === 'تقسيط';
  });
  if (!lateInvoices.length) {
    lateTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#b3b3b3;">لا يوجد طلاب لديهم فواتير تقسيط</td></tr>';
    return;
  }
  lateTableBody.innerHTML = lateInvoices.map((inv,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${inv.student||'-'}</td>
      <td>${inv.phone||'-'}</td>
      <td>${inv.subType||'-'}</td>
      <td>${inv.installment?.total || inv.installment?.amount || '-'}</td>
      <td>${inv.installment?.paid || inv.installment?.paidAmount || '-'}</td>
      <td>${inv.installment?.remaining || (inv.installment?.total || inv.installment?.amount ? ((+inv.installment?.total||+inv.installment?.amount||0) - (+inv.installment?.paid||+inv.installment?.paidAmount||0)) : '-') }</td>
    </tr>
  `).join('');
}
