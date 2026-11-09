// Envoltorio mínimo de IndexedDB con promesas. Todo lo que guarda la app vive aquí,
// en el propio navegador: no hay servidor de datos.

const DB_NAME = 'menu-semanal';
// Al subir la versión, añade la migración en `upgrade()` según `oldVersion`.
const DB_VERSION = 1;

export const STORES = {
  recipes: 'recetas', // { id, name, servings, minutes, notes, ingredients[], createdAt, updatedAt }
  plan: 'menu', // { slot: 'lun-comida', recipeId, servings }
  checked: 'compra', // { key: 'cebolla' } → producto marcado en la lista
  meta: 'ajustes', // { key, value }
};

let dbPromise = null;

/** Convierte una IDBRequest en promesa. */
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore(STORES.recipes, { keyPath: 'id' });
    db.createObjectStore(STORES.plan, { keyPath: 'slot' });
    db.createObjectStore(STORES.checked, { keyPath: 'key' });
    db.createObjectStore(STORES.meta, { keyPath: 'key' });
  }
}

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => upgrade(req.result, event.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña abre una versión nueva de la base de datos (o el navegador
      // cierra la conexión), la soltamos y la siguiente operación abre otra.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      // No se guarda el fallo: el siguiente intento vuelve a abrir la base de datos.
      dbPromise = null;
      reject(req.error);
    };
    // «blocked» no es un error: la apertura sigue en cuanto la otra pestaña cierre su conexión.
    req.onblocked = () => console.warn('IndexedDB: esperando a que otra pestaña cierre la base de datos.');
  });
  return dbPromise;
}

/**
 * Ejecuta `fn` dentro de una transacción y espera a que termine. Si `fn` lanza
 * o una petición falla, la transacción se aborta y no se guarda nada.
 */
export async function transaction(storeNames, mode, fn) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);
  const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]));
  // Un error en una petición siempre termina en «abort», que trae el motivo en tx.error.
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada.'));
  });
  let result;
  try {
    result = await fn(stores, tx);
  } catch (error) {
    done.catch(() => {}); // ya devolvemos `error`: evita un rechazo sin capturar
    try { tx.abort(); } catch { /* ya terminada */ }
    throw error;
  }
  await done;
  return result;
}

export const getAll = (store) => transaction(store, 'readonly', (s) => request(s[store].getAll()));
export const get = (store, key) => transaction(store, 'readonly', (s) => request(s[store].get(key)));
export const put = (store, value) => transaction(store, 'readwrite', (s) => request(s[store].put(value)));
export const remove = (store, key) => transaction(store, 'readwrite', (s) => request(s[store].delete(key)));
export const clear = (store) => transaction(store, 'readwrite', (s) => request(s[store].clear()));
export { request };
