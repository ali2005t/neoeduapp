document.addEventListener("DOMContentLoaded", () => {
  /* إنشاء 30 قصاصة احتفالية عشوائية */
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.animationDelay = Math.random() * 2 + "s";
    confetti.style.background =
      ["#fff176", "#f8bbd0", "#81d4fa", "#ffd54f"][Math.floor(Math.random() * 4)];
    document.body.appendChild(confetti);
  }

  /* الانتقال إلى login.html بعد 3 ثوانٍ مع تلاشي الصفحة */
  setTimeout(() => {
    document.body.style.opacity = "0";
    setTimeout(() => (window.location.href = "login.html"), 400);
  }, 3000);
});
