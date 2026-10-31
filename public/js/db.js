// Envoltorio mínimo de IndexedDB con promesas. Todo lo que guarda la app vive aquí,
// en el propio navegador: no hay servidor de datos.

const DB_NAME = 'menu-semanal';
const DB_VERSION = 1;

export const STORES = {
  recipes: 'recetas', // { id, name, servings, minutes, notes, ingredients[], createdAt, updatedAt }
  plan: 'menu', // { slot: 'lun-comida', recipeId, servings }
  checked: 'compra', // { key: 'cebolla' } → producto marcado en la lista
  meta: 'ajustes', // { key, value }
};

let dbPromise;

/** Convierte una IDBRequest en promesa. */
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.recipes)) db.createObjectStore(STORES.recipes, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.plan)) db.createObjectStore(STORES.plan, { keyPath: 'slot' });
      if (!db.objectStoreNames.contains(STORES.checked)) db.createObjectStore(STORES.checked, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta, { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña abre una versión nueva de la base de datos, cerramos esta conexión.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña.'));
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
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada.'));
  });
  let result;
  try {
    result = await fn(stores, tx);
  } catch (error) {
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
