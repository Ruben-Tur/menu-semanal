// Normalización y formato de cantidades. Módulo puro.
import { UNITS } from './catalog.js';

const EPSILON = 1e-9;
const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export const formatNumber = (n) => numberFormat.format(n);

/**
 * Pasa una cantidad a la unidad base de su dimensión (g, ml, unidades…).
 * Devuelve `null` si no hay cantidad («al gusto») o la unidad no existe.
 */
export function toBase(quantity, unit) {
  const def = UNITS[unit];
  if (!def || quantity === null || quantity === undefined || quantity === '') return null;
  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { dim: def.dim, value: n * def.factor };
}

/**
 * Redondea un total para la compra. Las unidades se redondean hacia arriba
 * (no se compra media cebolla); el resto, a un valor razonable.
 */
export function roundForShopping(dim, value) {
  switch (dim) {
    case 'unidades':
      return Math.max(1, Math.ceil(value - EPSILON));
    case 'cucharadas':
    case 'cucharaditas':
      return Math.max(0.5, Math.round(value * 2) / 2);
    case 'masa':
    case 'volumen':
      // Por encima de 1 kg/l se redondea a 10 g/ml para no mostrar «1,237 kg» (sale «1,24 kg»).
      if (value >= 1000) return Math.round(value / 10) * 10;
      return Math.max(1, Math.round(value));
    default:
      return value;
  }
}

/** Texto legible de una cantidad ya en unidad base: «600 g», «1,5 kg», «3 ud.». */
export function formatAmount(dim, value) {
  const v = roundForShopping(dim, value);
  switch (dim) {
    case 'masa':
      return v >= 1000 ? `${formatNumber(v / 1000)} kg` : `${formatNumber(v)} g`;
    case 'volumen':
      return v >= 1000 ? `${formatNumber(v / 1000)} l` : `${formatNumber(v)} ml`;
    case 'unidades':
      return `${formatNumber(v)} ud.`;
    case 'cucharadas':
      return `${formatNumber(v)} cda.`;
    case 'cucharaditas':
      return `${formatNumber(v)} cdta.`;
    default:
      return formatNumber(v);
  }
}

/** Cantidad tal y como está escrita en la receta: «2 cda.», «al gusto». */
export function formatIngredientQuantity(quantity, unit) {
  const base = toBase(quantity, unit);
  if (!base) return 'al gusto';
  return `${formatNumber(Number(quantity))} ${UNITS[unit].label}`;
}
