// Catálogos fijos de la app: días, comidas, pasillos y unidades.
// Módulo puro (sin DOM ni IndexedDB) para poder usarlo también en las pruebas.

export const DAYS = [
  { id: 'lun', short: 'Lun', name: 'Lunes' },
  { id: 'mar', short: 'Mar', name: 'Martes' },
  { id: 'mie', short: 'Mié', name: 'Miércoles' },
  { id: 'jue', short: 'Jue', name: 'Jueves' },
  { id: 'vie', short: 'Vie', name: 'Viernes' },
  { id: 'sab', short: 'Sáb', name: 'Sábado' },
  { id: 'dom', short: 'Dom', name: 'Domingo' },
];

export const MEALS = [
  { id: 'comida', name: 'Comida' },
  { id: 'cena', name: 'Cena' },
];

/** Clave de cada hueco del menú: «lun-comida», «mie-cena»… */
export const slotKey = (dayId, mealId) => `${dayId}-${mealId}`;

export const SLOT_KEYS = DAYS.flatMap((d) => MEALS.map((m) => slotKey(d.id, m.id)));

// En el orden en que se suele recorrer un supermercado: así la lista sigue el paseo.
export const AISLES = [
  'Frutería',
  'Carnicería',
  'Pescadería',
  'Charcutería',
  'Lácteos y huevos',
  'Panadería',
  'Despensa',
  'Congelados',
  'Bebidas',
  'Otros',
];

export const DEFAULT_AISLE = 'Otros';

// `dim` agrupa las unidades que se pueden sumar entre sí y `factor` las pasa a la unidad base.
export const UNITS = {
  g: { label: 'g', name: 'gramos', dim: 'masa', factor: 1 },
  kg: { label: 'kg', name: 'kilos', dim: 'masa', factor: 1000 },
  ml: { label: 'ml', name: 'mililitros', dim: 'volumen', factor: 1 },
  l: { label: 'l', name: 'litros', dim: 'volumen', factor: 1000 },
  ud: { label: 'ud.', name: 'unidades', dim: 'unidades', factor: 1 },
  cda: { label: 'cda.', name: 'cucharadas', dim: 'cucharadas', factor: 1 },
  cdta: { label: 'cdta.', name: 'cucharaditas', dim: 'cucharaditas', factor: 1 },
};

export const UNIT_IDS = Object.keys(UNITS);

export const LIMITS = {
  recipeName: 80,
  ingredientName: 60,
  notes: 2000,
  ingredients: 40,
  recipes: 500,
  servingsMin: 1,
  servingsMax: 20,
  minutesMax: 600,
  quantityMax: 100000,
};
