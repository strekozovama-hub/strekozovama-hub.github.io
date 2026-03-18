// Mobile Portfolio — Marina Strekozova

// Clock
function updateTime() {
  const el = document.getElementById('topbar-time');
  if (!el) return;
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  el.textContent = `${h}:${m}`;
}
updateTime();
setInterval(updateTime, 10000);

// Toast
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

// "Coming soon" projects
document.querySelectorAll('.project--soon').forEach(el => {
  el.addEventListener('click', () => {
    const msg = el.dataset.message || 'Coming soon 🤍';
    showToast(msg);
  });
});
