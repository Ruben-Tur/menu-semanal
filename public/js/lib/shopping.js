// Generación de la lista de la compra a partir del menú. Módulo puro:
// recibe datos planos y devuelve datos planos, sin tocar el DOM ni IndexedDB.
import { AISLES, DEFAULT_AISLE, SLOT_KEYS } from './catalog.js';
import { toBase, formatAmount } from './units.js';
import { ingredientKey, compareEs } from './text.js';

// Orden en que se muestran las cantidades cuando un producto mezcla dimensiones.
const DIM_ORDER = ['masa', 'volumen', 'unidades', 'cucharadas', 'cucharaditas'];

/**
 * Convierte los huecos del menú en líneas de ingrediente ya escaladas a las
 * raciones de cada hueco. Ignora huecos vacíos o con recetas que ya no existen.
 *
 * @param {Array<{slot: string, recipeId: string, servings: number}>} plan
 * @param {Map<string, object>} recipesById
 */
export function collectIngredients(plan, recipesById) {
  const order = new Map(SLOT_KEYS.map((key, i) => [key, i]));
  const slots = [...plan]
    .filter((s) => s && recipesById.has(s.recipeId))
    .sort((a, b) => (order.get(a.slot) ?? 99) - (order.get(b.slot) ?? 99));

  const lines = [];
  for (const slot of slots) {
    const recipe = recipesById.get(slot.recipeId);
    const base = recipe.servings > 0 ? recipe.servings : 1;
    const servings = slot.servings > 0 ? slot.servings : base;
    const factor = servings / base;

    for (const ing of recipe.ingredients) {
      const key = ingredientKey(ing.name);
      if (!key) continue;
      const amount = toBase(ing.quantity, ing.unit);
      lines.push({
        key,
        name: ing.name.trim(),
        aisle: AISLES.includes(ing.aisle) ? ing.aisle : DEFAULT_AISLE,
        amount: amount && { dim: amount.dim, value: amount.value * factor },
        recipe: recipe.name,
      });
    }
  }
  return lines;
}

/**
 * Suma las líneas del mismo ingrediente. Las cantidades solo se suman dentro de
 * la misma dimensión (g con kg, ml con l…); si un producto aparece en gramos y
 * en unidades, se conservan las dos cantidades.
 */
export function aggregate(lines) {
  const byKey = new Map();
  for (const line of lines) {
    let item = byKey.get(line.key);
    if (!item) {
      // El primer nombre y pasillo que aparecen son los que se muestran.
      item = { key: line.key, name: line.name, aisle: line.aisle, totals: new Map(), recipes: [] };
      byKey.set(line.key, item);
    }
    if (line.amount) {
      item.totals.set(line.amount.dim, (item.totals.get(line.amount.dim) ?? 0) + line.amount.value);
    }
    if (!item.recipes.includes(line.recipe)) item.recipes.push(line.recipe);
  }

  return [...byKey.values()].map(({ totals, ...item }) => {
    foldSpoonsIntoVolume(totals);
    const amounts = [...totals.entries()]
      .sort(([a], [b]) => DIM_ORDER.indexOf(a) - DIM_ORDER.indexOf(b))
      .map(([dim, value]) => ({ dim, value, text: formatAmount(dim, value) }));
    return {
      ...item,
      amounts,
      quantityText: amounts.length ? amounts.map((a) => a.text).join(' + ') : 'al gusto',
    };
  });
}

// Medidas de cocina habituales: 1 cucharada = 15 ml y 1 cucharadita = 5 ml.
const SPOON_ML = { cucharadas: 15, cucharaditas: 5 };

/**
 * Si un producto ya se compra por volumen (aceite: 250 ml en una receta y
 * 3 cucharadas en otra), las cucharadas se pasan a ml para dar un solo total.
 * Si solo aparece en cucharadas (pimentón, comino…), se dejan como están.
 */
function foldSpoonsIntoVolume(totals) {
  if (!totals.has('volumen')) return;
  for (const [dim, ml] of Object.entries(SPOON_ML)) {
    if (!totals.has(dim)) continue;
    totals.set('volumen', totals.get('volumen') + totals.get(dim) * ml);
    totals.delete(dim);
  }
}

/** Agrupa los productos por pasillo, en el orden del súper y alfabéticamente dentro de cada uno. */
export function groupByAisle(items) {
  const groups = new Map();
  for (const item of items) {
    const aisle = AISLES.includes(item.aisle) ? item.aisle : DEFAULT_AISLE;
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(item);
  }
  return AISLES.filter((aisle) => groups.has(aisle)).map((aisle) => ({
    aisle,
    items: groups.get(aisle).sort((a, b) => compareEs(a.name, b.name)),
  }));
}

/** Todo el proceso: menú + recetas → lista agrupada por pasillos. */
export function buildShoppingList(plan, recipes) {
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const lines = collectIngredients(plan, recipesById);
  const items = aggregate(lines);
  const meals = plan.filter((s) => s && recipesById.has(s.recipeId)).length;
  return { meals, total: items.length, groups: groupByAisle(items) };
}

/** Versión en texto plano para compartir por mensajería o copiar. */
export function shoppingListToText(list, checkedKeys = new Set()) {
  const out = ['Lista de la compra'];
  for (const group of list.groups) {
    const pending = group.items.filter((i) => !checkedKeys.has(i.key));
    if (!pending.length) continue;
    out.push('', group.aisle.toUpperCase());
    for (const item of pending) {
      out.push(item.amounts.length ? `- ${item.name}: ${item.quantityText}` : `- ${item.name}`);
    }
  }
  return out.join('\n');
}
