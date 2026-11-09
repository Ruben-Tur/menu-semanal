// Validación y saneado de recetas y copias de seguridad. Módulo puro.
// Todo lo que entra (formulario o archivo importado) pasa por aquí y sale como
// un objeto nuevo con solo los campos conocidos: nunca se guarda el objeto original.
import { AISLES, DEFAULT_AISLE, LIMITS, SLOT_KEYS, UNIT_IDS } from './catalog.js';
import { cleanLine, cleanMultiline } from './text.js';

export const BACKUP_APP = 'menu-semanal';
export const BACKUP_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Acepta «1,5», «1.5» o un número. Vacío = sin cantidad («al gusto»). */
export function parseQuantity(value) {
  if (value === null || value === undefined) return { ok: true, value: null };
  const text = String(value).trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false };
  // Se redondea antes de comprobar: «0,0001» quedaría en 0 y se guardaría como «al gusto».
  const n = Math.round(Number(text) * 1000) / 1000;
  if (!Number.isFinite(n) || n <= 0 || n > LIMITS.quantityMax) return { ok: false };
  return { ok: true, value: n };
}

function parseInteger(value, min, max) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/**
 * Valida y limpia una receta. Las filas de ingrediente totalmente vacías se
 * descartan (son las que deja el formulario sin rellenar).
 * @returns {{ ok: boolean, recipe?: object, errors: Array<{field: string, message: string}> }}
 */
export function sanitizeRecipe(input) {
  const errors = [];
  if (!isPlainObject(input)) return { ok: false, errors: [{ field: 'receta', message: 'No es una receta válida.' }] };

  const id = typeof input.id === 'string' && ID_PATTERN.test(input.id) ? input.id : null;
  if (!id) errors.push({ field: 'id', message: 'Falta el identificador de la receta.' });

  const name = cleanLine(input.name, LIMITS.recipeName);
  if (!name) errors.push({ field: 'name', message: 'Ponle un nombre a la receta.' });

  const servings = parseInteger(input.servings, LIMITS.servingsMin, LIMITS.servingsMax);
  if (servings === null) {
    errors.push({ field: 'servings', message: `Las raciones van de ${LIMITS.servingsMin} a ${LIMITS.servingsMax}.` });
  }

  let minutes = null;
  if (input.minutes !== null && input.minutes !== undefined && String(input.minutes).trim() !== '') {
    minutes = parseInteger(input.minutes, 1, LIMITS.minutesMax);
    if (minutes === null) errors.push({ field: 'minutes', message: `El tiempo va de 1 a ${LIMITS.minutesMax} minutos.` });
  }

  const notes = cleanMultiline(input.notes, LIMITS.notes);

  const ingredients = [];
  const rawIngredients = Array.isArray(input.ingredients) ? input.ingredients : [];
  if (rawIngredients.length > LIMITS.ingredients * 2) {
    errors.push({ field: 'ingredients', message: 'Demasiados ingredientes.' });
  }
  rawIngredients.slice(0, LIMITS.ingredients * 2).forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      errors.push({ field: `ingredients.${index}`, message: `El ingrediente ${index + 1} no es válido.` });
      return;
    }
    const ingName = cleanLine(raw.name, LIMITS.ingredientName);
    const quantity = parseQuantity(raw.quantity);
    const hasQuantity = quantity.ok && quantity.value !== null;
    if (!ingName && !hasQuantity && quantity.ok) return; // fila vacía
    if (!ingName) {
      errors.push({ field: `ingredients.${index}.name`, message: `Falta el nombre del ingrediente ${index + 1}.` });
    }
    if (!quantity.ok) {
      errors.push({
        field: `ingredients.${index}.quantity`,
        message: `La cantidad de «${ingName || `ingrediente ${index + 1}`}» debe ser un número mayor que 0.`,
      });
    }
    const unit = UNIT_IDS.includes(raw.unit) ? raw.unit : 'ud';
    const aisle = AISLES.includes(raw.aisle) ? raw.aisle : DEFAULT_AISLE;
    ingredients.push({ name: ingName, quantity: quantity.ok ? quantity.value : null, unit, aisle });
  });

  if (ingredients.length === 0) {
    errors.push({ field: 'ingredients', message: 'Añade al menos un ingrediente.' });
  } else if (ingredients.length > LIMITS.ingredients) {
    errors.push({ field: 'ingredients', message: `Como mucho ${LIMITS.ingredients} ingredientes por receta.` });
  }

  const now = Date.now();
  const createdAt = Number.isSafeInteger(input.createdAt) && input.createdAt > 0 ? input.createdAt : now;
  const updatedAt = Number.isSafeInteger(input.updatedAt) && input.updatedAt > 0 ? input.updatedAt : createdAt;

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors, recipe: { id, name, servings, minutes, notes, ingredients, createdAt, updatedAt } };
}

/** Comprueba un hueco del menú. `recipeIds` es el conjunto de recetas existentes. */
export function sanitizeSlot(input, recipeIds) {
  if (!isPlainObject(input)) return null;
  if (!SLOT_KEYS.includes(input.slot)) return null;
  if (typeof input.recipeId !== 'string' || !recipeIds.has(input.recipeId)) return null;
  const servings = parseInteger(input.servings, LIMITS.servingsMin, LIMITS.servingsMax);
  if (servings === null) return null;
  return { slot: input.slot, recipeId: input.recipeId, servings };
}

/** Crea el objeto de copia de seguridad que se descarga como JSON. */
export function createBackup({ recipes, plan, checked }, exportedAt = new Date().toISOString()) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, recipes, plan, checked };
}

/**
 * Valida una copia de seguridad importada. Si hay cualquier error se rechaza
 * entera: es mejor no importar nada que importar media copia.
 * @returns {{ ok: boolean, data?: {recipes, plan, checked}, errors: string[] }}
 */
export function validateBackup(input) {
  const errors = [];
  if (!isPlainObject(input) || input.app !== BACKUP_APP) {
    return { ok: false, errors: ['El archivo no es una copia de seguridad de menu-semanal.'] };
  }
  if (input.version !== BACKUP_VERSION) {
    return { ok: false, errors: [`Versión de copia no compatible (${String(input.version).slice(0, 10)}).`] };
  }
  if (!Array.isArray(input.recipes)) return { ok: false, errors: ['Faltan las recetas.'] };
  if (input.recipes.length > LIMITS.recipes) {
    return { ok: false, errors: [`La copia tiene más de ${LIMITS.recipes} recetas.`] };
  }

  const recipes = [];
  const ids = new Set();
  input.recipes.forEach((raw, index) => {
    const result = sanitizeRecipe(raw);
    const label = `Receta ${index + 1}${result.recipe ? ` («${result.recipe.name}»)` : ''}`;
    if (!result.ok) {
      errors.push(`${label}: ${result.errors[0].message}`);
      return;
    }
    if (ids.has(result.recipe.id)) {
      errors.push(`${label}: identificador repetido.`);
      return;
    }
    ids.add(result.recipe.id);
    recipes.push(result.recipe);
  });

  const plan = [];
  const rawPlan = input.plan ?? [];
  if (!Array.isArray(rawPlan) || rawPlan.length > SLOT_KEYS.length) {
    errors.push('El menú semanal no es válido.');
  } else {
    const used = new Set();
    rawPlan.forEach((raw, index) => {
      const slot = sanitizeSlot(raw, ids);
      if (!slot || used.has(slot.slot)) {
        errors.push(`El hueco ${index + 1} del menú no es válido.`);
        return;
      }
      used.add(slot.slot);
      plan.push(slot);
    });
  }

  const rawChecked = input.checked ?? [];
  const checked = Array.isArray(rawChecked)
    ? [...new Set(rawChecked.filter((k) => typeof k === 'string' && k.length > 0 && k.length <= 200))].slice(0, 2000)
    : [];

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors, data: { recipes, plan, checked } };
}
