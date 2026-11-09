// «Tus datos»: privacidad, copia de seguridad, instalación y borrado.
import { validateBackup } from '../lib/validate.js';
import { formatNumber } from '../lib/units.js';
import { h, icon, mount, confirmDialog, toast } from '../dom.js';
import * as store from '../store.js';
import { installState } from '../install.js';

// Una copia con 500 recetas completas ocupa unos 600 KB; 2 MB deja margen y corta abusos.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const today = () => new Date().toISOString().slice(0, 10);

export async function renderData(view) {
  const [recipes, plan] = await Promise.all([store.listRecipes(), store.getPlan()]);
  const rerender = () => renderData(view);

  const exportBackup = async () => {
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `menu-semanal-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Copia descargada');
  };

  const importStatus = h('div', { class: 'import-status', role: 'status', 'aria-live': 'polite' });
  const fileInput = h('input', {
    id: 'importar', type: 'file', class: 'file-input', accept: '.json,application/json',
    on: { change: (e) => importBackup(e.currentTarget) },
  });

  async function importBackup(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const fail = (title, errors = []) =>
      mount(importStatus, h('div', { class: 'form-errors' },
        h('p', { class: 'form-errors-title', text: title }),
        errors.length > 0 && h('ul', {}, errors.slice(0, 5).map((e) => h('li', { text: e }))),
        errors.length > 5 && h('p', { text: `…y ${errors.length - 5} errores más.` })));

    if (file.size > MAX_IMPORT_BYTES) return fail('El archivo es demasiado grande (máximo 2 MB).');
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return fail('El archivo no es un JSON válido.');
    }
    const result = validateBackup(json);
    if (!result.ok) return fail('No se ha importado nada: la copia tiene errores.', result.errors);

    const { recipes: newRecipes, plan: newPlan } = result.data;
    const ok = await confirmDialog({
      title: '¿Restaurar esta copia?',
      body: [
        `Contiene ${newRecipes.length} recetas y ${newPlan.length} comidas en el menú.`,
        `Sustituirá a lo que tienes ahora (${recipes.length} recetas y ${plan.length} comidas).`,
      ],
      confirmText: 'Restaurar copia',
      danger: true,
    });
    if (!ok) return;
    await store.replaceAll(result.data);
    toast('Copia restaurada');
    await rerender();
  }

  const restoreSamples = async () => {
    await store.restoreSamples();
    toast('Recetas de ejemplo recuperadas');
    await rerender();
  };

  const wipe = async () => {
    const ok = await confirmDialog({
      title: '¿Borrar todos los datos?',
      body: ['Se borran todas las recetas, el menú y la lista de la compra de este dispositivo.', 'Si quieres conservarlos, descarga antes una copia.'],
      confirmText: 'Borrar todo',
      danger: true,
    });
    if (!ok) return;
    await store.replaceAll({ recipes: [], plan: [], checked: [] });
    toast('Datos borrados');
    await rerender();
  };

  // Almacenamiento: cuánto ocupa y si el navegador lo protege de la limpieza automática.
  const storageInfo = h('p', { class: 'muted mono small' });
  const persistBtn = h('button', { type: 'button', class: 'btn btn-ghost', hidden: true }, 'Proteger del borrado automático');
  // Si el navegador no da estos datos (algunos modos privados fallan aquí), la vista se pinta igual.
  const storage = await Promise.all([
    navigator.storage?.estimate?.(),
    navigator.storage?.persisted?.() ?? false,
  ]).catch(() => null);
  if (storage?.[0]) {
    const [{ usage = 0 }, persisted] = storage;
    storageInfo.textContent = `Ocupa ${formatNumber(usage / 1024)} KB · ${persisted ? 'protegido del borrado automático' : 'el navegador podría borrarlo si se queda sin espacio'}`;
    if (!persisted && navigator.storage.persist) {
      persistBtn.hidden = false;
      persistBtn.addEventListener('click', async () => {
        const granted = await navigator.storage.persist();
        toast(granted ? 'Datos protegidos' : 'El navegador no lo ha permitido (prueba tras instalar la app)');
        await rerender();
      });
    }
  }

  const install = installState();

  mount(view,
    h('div', { class: 'view-head' },
      h('div', {},
        h('h2', { class: 'view-title', tabindex: '-1', text: 'Tus datos' }),
        h('p', { class: 'view-sub', text: 'Todo se queda en este dispositivo' }),
      ),
    ),
    h('div', { class: 'data-grid' },
      h('section', { class: 'card', 'aria-labelledby': 'priv-title' },
        h('h3', { class: 'card-title', id: 'priv-title', text: 'Privacidad' }),
        h('p', {}, 'Las recetas, el menú y la lista se guardan en el navegador con IndexedDB. No hay cuentas, ni servidor de datos, ni analítica: nada sale de este dispositivo.'),
        h('p', { class: 'muted mono small', text: `${recipes.length} recetas · ${plan.length} comidas en el menú` }),
        storageInfo,
        persistBtn,
      ),
      h('section', { class: 'card', 'aria-labelledby': 'backup-title' },
        h('h3', { class: 'card-title', id: 'backup-title', text: 'Copia de seguridad' }),
        h('p', {}, 'Descarga un archivo JSON con todo para guardarlo o pasarlo a otro dispositivo, y restáuralo cuando quieras.'),
        h('div', { class: 'card-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', on: { click: exportBackup } }, icon('save'), 'Descargar copia'),
          fileInput,
          h('label', { for: 'importar', class: 'btn btn-ghost file-label' }, icon('upload'), 'Restaurar copia…'),
        ),
        importStatus,
      ),
      h('section', { class: 'card', 'aria-labelledby': 'install-title' },
        h('h3', { class: 'card-title', id: 'install-title', text: 'Instalar la app' }),
        install.installed
          ? h('p', {}, 'Ya la estás usando como app instalada.')
          : h('p', {}, 'Instálala para abrirla desde la pantalla de inicio y usarla sin conexión en el súper. En el móvil, también desde el menú del navegador: «Añadir a pantalla de inicio».'),
        install.canPrompt && h('div', { class: 'card-actions' },
          h('button', {
            type: 'button', class: 'btn btn-primary',
            on: { click: async () => { await install.prompt(); await rerender(); } },
          }, 'Instalar menu-semanal')),
      ),
      h('section', { class: 'card', 'aria-labelledby': 'reset-title' },
        h('h3', { class: 'card-title', id: 'reset-title', text: 'Empezar de cero' }),
        h('p', {}, 'Recupera las recetas de ejemplo (no toca las tuyas) o borra todo lo guardado en este dispositivo.'),
        h('div', { class: 'card-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost', on: { click: restoreSamples } }, 'Recuperar recetas de ejemplo'),
          h('button', { type: 'button', class: 'btn btn-danger', on: { click: wipe } }, icon('trash'), 'Borrar todo'),
        ),
      ),
    ),
  );
}
