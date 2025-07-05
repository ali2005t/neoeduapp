// js/help.js
// منطق عرض شرح كل صفحة عند الضغط عليها في دليل المساعدة

const helpDetails = {
  'صفحة البداية (Splash)': `
    <div class="help-card">
      <b>صفحة البداية (Splash Screen)</b>
      <ul>
        <li>تظهر عند تشغيل النظام قبل الدخول.</li>
        <li>تحتوي على شعار السنتر واسم السنتر في المنتصف.</li>
        <li>تأثير تحميل دائري لبني، ثم انتقال تلقائي لتسجيل الدخول.</li>
        <li>الخلفية لبني هادئ، الشعار دائري، الاسم بخط عريض.</li>
      </ul>
    </div>
  `,
  'تسجيل الدخول': `
    <div class="help-card">
      <b>صفحة تسجيل الدخول</b>
      <ul>
        <li>نموذج تسجيل دخول عصري في منتصف الشاشة.</li>
        <li>اسم المستخدم، كلمة المرور، تفعيل "تذكرني".</li>
        <li>إشعار عند الخطأ، انتقال تلقائي حسب نوع المستخدم.</li>
        <li>تصميم أبيض، أزرار لبني، حواف مستديرة.</li>
      </ul>
    </div>
  `,
  'لوحة التحكم': `
    <div class="help-card">
      <b>لوحة التحكم (Dashboard)</b>
      <ul>
        <li>إحصائيات عامة: عدد الطلاب، أرباح الشهر، آخر فاتورة، زر إنشاء فاتورة.</li>
        <li>شبكة 2x2، مربعات ملونة، أرقام كبيرة.</li>
        <li>الساعة والتاريخ واسم السنتر في الأعلى.</li>
      </ul>
    </div>
  `,
  'الكاشير': `
    <div class="help-card">
      <b>صفحة الكاشير</b>
      <ul>
        <li>اختيار الفرقة (4 مربعات).</li>
        <li>اختيار نوع الاشتراك (4 مربعات).</li>
        <li>نموذج الفاتورة يختلف حسب النوع.</li>
        <li>معاينة حية للفاتورة.</li>
        <li>زر الوضع التجريبي.</li>
      </ul>
    </div>
  `,
  'الطلاب المشتركين': `
    <div class="help-card">
      <b>صفحة الطلاب المشتركين / الفواتير</b>
      <ul>
        <li>جدول الفواتير مع تفاصيل كاملة.</li>
        <li>نافذة منبثقة لتفاصيل الفاتورة.</li>
        <li>جدول استلام الملازم، حفظ الحالة محليًا.</li>
      </ul>
    </div>
  `,
  'الاشتراكات والأسعار': `
    <div class="help-card">
      <b>صفحة الاشتراكات والأسعار</b>
      <ul>
        <li>إضافة/تعديل الكورسات والملازم وأسعارهم.</li>
        <li>نموذج إضافة في الأعلى، جدول تحته.</li>
        <li>أزرار تعديل وحذف.</li>
      </ul>
    </div>
  `,
  'إدارة المستخدمين': `
    <div class="help-card">
      <b>صفحة إدارة المستخدمين</b>
      <ul>
        <li>إضافة مستخدم جديد (مدير/كاشير).</li>
        <li>جدول المستخدمين الحاليين مع تفعيل/تعطيل.</li>
      </ul>
    </div>
  `,
  'التقارير': `
    <div class="help-card">
      <b>صفحة التقارير</b>
      <ul>
        <li>تقارير الأرباح حسب النوع والفرقة.</li>
        <li>توزيع الطلاب انتظام/انتساب.</li>
        <li>رسوم بيانية تفاعلية.</li>
      </ul>
    </div>
  `,
  'المصروفات': `
    <div class="help-card">
      <b>صفحة المصروفات</b>
      <ul>
        <li>إضافة مصروف جديد مع تصنيف وتاريخ.</li>
        <li>جدول تفاعلي للمصروفات مع بحث وتعديل وحذف.</li>
        <li>ملخص المصروفات، فلترة بالتاريخ، خط زمني.</li>
      </ul>
    </div>
  `,
  'الإعدادات': `
    <div class="help-card">
      <b>صفحة الإعدادات</b>
      <ul>
        <li>تعديل اسم السنتر والشعار وأسماء الفرق.</li>
        <li>تفعيل/تعطيل انتظام/انتساب.</li>
        <li>تفعيل الوضع التجريبي افتراضيًا.</li>
        <li>إعادة ضبط المصنع ونسخة احتياطية.</li>
      </ul>
    </div>
  `
};

document.addEventListener('DOMContentLoaded', function() {
  // القائمة الجانبية الجديدة
  const sidebarList = document.querySelectorAll('#help-sidebar-list li');
  const helpDetailsDiv = document.getElementById('help-details');
  sidebarList.forEach((li, idx) => {
    li.addEventListener('click', function() {
      sidebarList.forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      const key = li.getAttribute('data-section').trim();
      helpDetailsDiv.style.animation = 'none';
      void helpDetailsDiv.offsetWidth; // إعادة تفعيل الأنيميشن
      helpDetailsDiv.innerHTML = helpDetails[key] || '';
      helpDetailsDiv.style.animation = 'fadeIn 0.7s cubic-bezier(.4,1.4,.6,1)';
    });
  });
  // افتراضيًا: عرض شرح أول عنصر
  if (sidebarList.length && helpDetailsDiv.innerHTML.trim() === '') {
    sidebarList[0].classList.add('active');
    helpDetailsDiv.innerHTML = helpDetails[sidebarList[0].getAttribute('data-section').trim()] || '';
  }

  function handleMobileHelpLayout() {
    const sidebar = document.querySelector('.sidebar');
    const tabs = document.querySelector('.mobile-tabs');
    if(window.innerWidth <= 900) {
      if(sidebar) sidebar.style.display = 'none';
      if(tabs) tabs.style.display = 'flex';
    } else {
      if(sidebar) sidebar.style.display = '';
      if(tabs) tabs.style.display = 'none';
    }
  }
  window.addEventListener('resize', handleMobileHelpLayout);
  window.addEventListener('DOMContentLoaded', handleMobileHelpLayout);
});
