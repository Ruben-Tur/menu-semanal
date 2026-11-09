// Arranque de la app: datos iniciales, rutas por hash y estado de conexión.
import { h, mount, toast } from './dom.js';
import { ensureSeeded } from './store.js';
import { registerServiceWorker, applyUpdate } from './install.js';
import { renderPlan } from './views/plan.js';
import { renderRecipeList, renderRecipeDetail, renderRecipeForm } from './views/recipes.js';
import { renderShopping } from './views/shopping.js';
import { renderData } from './views/data.js';

const view = document.getElementById('view');
const BASE_TITLE = 'menu-semanal';
// El título del HTML (el que ven los buscadores) se mantiene en la vista de inicio.
const HOME_TITLE = document.title;

// Cada ruta: patrón, sección del menú que se marca, título y función que pinta la vista.
const ROUTES = [
  { pattern: /^\/?$|^\/semana$/, nav: 'semana', title: 'Esta semana', render: (v) => renderPlan(v) },
  { pattern: /^\/recetas$/, nav: 'recetas', title: 'Recetario', render: (v) => renderRecipeList(v) },
  { pattern: /^\/recetas\/nueva$/, nav: 'recetas', title: 'Nueva receta', render: (v) => renderRecipeForm(v) },
  { pattern: /^\/recetas\/([\w-]{1,64})\/editar$/, nav: 'recetas', title: 'Editar receta', render: (v, id) => renderRecipeForm(v, id) },
  { pattern: /^\/recetas\/([\w-]{1,64})$/, nav: 'recetas', title: 'Receta', render: (v, id) => renderRecipeDetail(v, id) },
  { pattern: /^\/compra$/, nav: 'compra', title: 'Lista de la compra', render: (v) => renderShopping(v) },
  { pattern: /^\/datos$/, nav: 'datos', title: 'Tus datos', render: (v) => renderData(v) },
];

let firstRender = true;
let renderSeq = 0;

async function route() {
  const seq = ++renderSeq;
  let path = '/';
  try {
    path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  } catch { /* hash mal formado: vamos al inicio */ }
  const match = ROUTES.map((r) => ({ r, m: r.pattern.exec(path) })).find((x) => x.m);

  document.body.dataset.view = match ? match.r.nav : 'otra';
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (match && a.dataset.nav === match.r.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (!match) {
    view.removeAttribute('aria-busy');
    mount(view,
      h('h2', { class: 'view-title', tabindex: '-1', text: 'Esta página no existe' }),
      h('p', { class: 'notice' }, 'Vuelve a ', h('a', { href: '#/semana', text: 'la semana' }), '.'));
    document.title = `Página no encontrada · ${BASE_TITLE}`;
    return;
  }

  // Cada vista se pinta en su propio contenedor y solo se muestra si sigue siendo la
  // última pedida: si se cambia de pestaña rápido, una vista lenta (p. ej. «Tus datos»)
  // ya no puede terminar después y tapar la vista actual.
  const page = document.createElement('div');
  view.setAttribute('aria-busy', 'true');
  try {
    await match.r.render(page, match.m[1]);
  } catch (error) {
    console.error(error);
    mount(page,
      h('h2', { class: 'view-title', tabindex: '-1', text: 'Algo ha fallado' }),
      h('p', { class: 'notice', text: 'No se han podido leer los datos de este dispositivo. Recarga la página para intentarlo de nuevo.' }));
  }
  if (seq !== renderSeq) return;
  view.removeAttribute('aria-busy');
  mount(view, page);

  const heading = view.querySelector('.view-title');
  if (match.r.nav === 'semana') document.title = HOME_TITLE;
  else document.title = `${match.r.title === 'Receta' && heading ? heading.textContent : match.r.title} · ${BASE_TITLE}`;
  // Al cambiar de vista llevamos el foco al título (para teclado y lectores de pantalla).
  if (!firstRender) {
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
  firstRender = false;
}

// Red de seguridad: si falla al guardar algo que no tiene su propio aviso
// (IndexedDB llena, bloqueada…), al menos se le dice al usuario.
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  toast('No se ha podido guardar el cambio. Inténtalo de nuevo.');
});

function watchConnection() {
  const badge = document.getElementById('estado-conexion');
  const update = () => { badge.hidden = navigator.onLine; };
  window.addEventListener('online', () => { update(); toast('Conexión recuperada'); });
  window.addEventListener('offline', () => { update(); toast('Sin conexión: todo sigue funcionando'); });
  update();
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('actualizacion');
  mount(banner,
    h('span', { text: 'Hay una versión nueva de la app.' }),
    h('button', { type: 'button', class: 'btn btn-primary btn-small', text: 'Actualizar', on: { click: () => applyUpdate(worker) } }));
  banner.hidden = false;
}

async function start() {
  document.documentElement.classList.add('js');
  watchConnection();
  try {
    await ensureSeeded();
  } catch (error) {
    console.error(error);
    mount(view,
      h('h2', { class: 'view-title', text: 'No se puede guardar en este navegador' }),
      h('p', { class: 'notice', text: 'La app necesita IndexedDB. Si estás en una ventana privada o con el almacenamiento bloqueado, ábrela en una ventana normal.' }));
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker(showUpdateBanner);
}

start();
