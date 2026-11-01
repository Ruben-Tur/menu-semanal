// Instalación como app (PWA) y registro del service worker.

let deferredPrompt = null;
let onUpdateReady = () => {};

window.addEventListener('beforeinstallprompt', (event) => {
  // Guardamos el aviso para lanzarlo desde «Tus datos», cuando el usuario quiera.
  event.preventDefault();
  deferredPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
});

export function installState() {
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return {
    installed,
    canPrompt: !installed && deferredPrompt !== null,
    async prompt() {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      return outcome === 'accepted';
    },
  };
}

/** Registra el service worker y avisa cuando hay una versión nueva esperando. */
export async function registerServiceWorker(onUpdate) {
  onUpdateReady = onUpdate;
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('sw.js', { scope: './' });
    const watch = (worker) => {
      worker?.addEventListener('statechange', () => {
        // Solo es una «actualización» si ya había otro service worker controlando la página.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(worker);
      });
    };
    if (registration.waiting && navigator.serviceWorker.controller) onUpdateReady(registration.waiting);
    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));

    // Cuando el nuevo service worker toma el control, recargamos una sola vez.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !sessionStorage.getItem('menu-semanal:actualizando')) return;
      reloading = true;
      sessionStorage.removeItem('menu-semanal:actualizando');
      location.reload();
    });
    return registration;
  } catch (error) {
    console.warn('No se ha podido registrar el service worker:', error);
    return null;
  }
}

/** Pide al service worker en espera que se active (lo pide el botón «Actualizar»). */
export function applyUpdate(worker) {
  try { sessionStorage.setItem('menu-semanal:actualizando', '1'); } catch { /* sin sessionStorage */ }
  worker.postMessage({ type: 'SKIP_WAITING' });
}
