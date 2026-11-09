// Operaciones de datos de la app sobre IndexedDB. Todo lo que se guarda pasa
// antes por las funciones de validación de lib/validate.js.
import { STORES, transaction, request, getAll, get, put, remove, clear } from './db.js';
import { sanitizeRecipe, sanitizeSlot, createBackup } from './lib/validate.js';
import { compareEs } from './lib/text.js';
import { SLOT_KEYS } from './lib/catalog.js';
import { SEED_RECIPES, SEED_PLAN } from './seed.js';

const newId = () => crypto.randomUUID();

/**
 * La primera vez que se abre la app carga las recetas y el menú de ejemplo.
 * Se comprueba y se carga en la misma transacción: si se abren dos pestañas a la
 * vez, solo una carga los ejemplos (y no pisa lo que haya creado la otra).
 */
export function ensureSeeded() {
  return transaction([STORES.recipes, STORES.plan, STORES.meta], 'readwrite', async (s) => {
    const seeded = await request(s[STORES.meta].get('seeded'));
    if (seeded) return false;
    for (const raw of SEED_RECIPES) s[STORES.recipes].put(sanitizeRecipe(raw).recipe);
    for (const slot of SEED_PLAN) s[STORES.plan].put(slot);
    s[STORES.meta].put({ key: 'seeded', value: true });
    return true;
  });
}

export async function listRecipes() {
  const recipes = await getAll(STORES.recipes);
  return recipes.sort((a, b) => compareEs(a.name, b.name));
}

export const getRecipe = (id) => get(STORES.recipes, id);

/**
 * Crea o actualiza una receta. Devuelve `{ ok, recipe }` o `{ ok: false, errors }`
 * con los mensajes listos para el formulario.
 */
export async function saveRecipe(input) {
  const existing = input.id ? await getRecipe(input.id) : null;
  const result = sanitizeRecipe({
    ...input,
    id: existing ? existing.id : newId(),
    createdAt: existing?.createdAt,
    updatedAt: Date.now(),
  });
  if (!result.ok) return result;
  await put(STORES.recipes, result.recipe);
  return result;
}

/** Borra la receta y la quita de los huecos del menú en los que estuviera. */
export function deleteRecipe(id) {
  return transaction([STORES.recipes, STORES.plan], 'readwrite', async (s) => {
    const plan = await request(s[STORES.plan].getAll());
    s[STORES.recipes].delete(id);
    for (const slot of plan) if (slot.recipeId === id) s[STORES.plan].delete(slot.slot);
  });
}

const SLOT_ORDER = new Map(SLOT_KEYS.map((key, i) => [key, i]));

/** Huecos del menú en orden de la semana (IndexedDB los devuelve por orden alfabético). */
export async function getPlan() {
  const plan = await getAll(STORES.plan);
  return plan.sort((a, b) => (SLOT_ORDER.get(a.slot) ?? 99) - (SLOT_ORDER.get(b.slot) ?? 99));
}

export async function setSlot(slot, recipeId, servings) {
  const recipe = await getRecipe(recipeId);
  const clean = sanitizeSlot({ slot, recipeId, servings }, new Set(recipe ? [recipe.id] : []));
  if (!clean) throw new Error('Hueco del menú no válido.');
  await put(STORES.plan, clean);
}

export const clearSlot = (slot) => remove(STORES.plan, slot);
export const clearPlan = () => clear(STORES.plan);

export async function getChecked() {
  const rows = await getAll(STORES.checked);
  return new Set(rows.map((r) => r.key));
}

// La misma clave (recortada) al marcar y al desmarcar; si no, una clave larga no se podría desmarcar.
const checkedKey = (key) => String(key).slice(0, 200);

export const setChecked = (key, checked) =>
  checked ? put(STORES.checked, { key: checkedKey(key) }) : remove(STORES.checked, checkedKey(key));

/** Quita las marcas de productos que ya no están en la lista (para que no reaparezcan tachados). */
export function pruneChecked(keys) {
  if (!keys.length) return Promise.resolve();
  return transaction(STORES.checked, 'readwrite', (s) => {
    for (const key of keys) s[STORES.checked].delete(key);
  });
}

export const clearChecked = () => clear(STORES.checked);

export const getHideChecked = async () => (await get(STORES.meta, 'hideChecked'))?.value === true;
export const setHideChecked = (value) => put(STORES.meta, { key: 'hideChecked', value: Boolean(value) });

export async function exportData() {
  const [recipes, plan, checked] = await Promise.all([listRecipes(), getPlan(), getChecked()]);
  return createBackup({ recipes, plan, checked: [...checked] });
}

/** Sustituye todos los datos por los de una copia ya validada, en una sola transacción. */
export function replaceAll({ recipes, plan, checked }) {
  return transaction([STORES.recipes, STORES.plan, STORES.checked, STORES.meta], 'readwrite', (s) => {
    s[STORES.recipes].clear();
    s[STORES.plan].clear();
    s[STORES.checked].clear();
    for (const r of recipes) s[STORES.recipes].put(r);
    for (const p of plan) s[STORES.plan].put(p);
    for (const key of checked) s[STORES.checked].put({ key });
    s[STORES.meta].put({ key: 'seeded', value: true });
  });
}

/** Vuelve a cargar las recetas de ejemplo (sin tocar las del usuario con otro id). */
export function restoreSamples() {
  return transaction([STORES.recipes], 'readwrite', (s) => {
    for (const raw of SEED_RECIPES) s[STORES.recipes].put(sanitizeRecipe(raw).recipe);
  });
}
