function showNotification(msg, type = 'info', duration = 2500) {
  let notif = document.getElementById('global-notif');
  if (notif) notif.remove();
  notif = document.createElement('div');
  notif.id = 'global-notif';
  notif.style.position = 'fixed';
  notif.style.top = '24px';
  notif.style.left = '50%';
  notif.style.transform = 'translateX(-50%)';
  notif.style.zIndex = '9999';
  notif.style.minWidth = '200px';
  notif.style.maxWidth = '90vw';
  notif.style.padding = '16px 36px';
  notif.style.borderRadius = '14px';
  notif.style.fontSize = '18px';
  notif.style.fontWeight = 'bold';
  notif.style.boxShadow = '0 2px 16px #90caf988';
  notif.style.textAlign = 'center';
  notif.style.transition = 'opacity 0.7s';
  notif.style.opacity = '1';
  notif.style.pointerEvents = 'auto';
  notif.style.background = type === 'success' ? '#43a047' : (type === 'error' ? '#e53935' : '#1976d2');
  notif.style.color = '#fff';
  notif.textContent = msg.replace(/<[^>]+>/g, ''); // نص فقط
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    setTimeout(()=>{if(notif)notif.remove();}, 800);
  }, duration);
}
window.showNotification = showNotification;