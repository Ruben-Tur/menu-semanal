// Utilidades de texto. Módulo puro.

// Caracteres de control (salvo saltos de línea y tabuladores, que se tratan aparte).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Limpia un texto de una línea: sin caracteres de control, espacios colapsados y longitud máxima. */
export function cleanLine(value, max) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Igual que `cleanLine`, pero respeta los saltos de línea (para notas y pasos). */
export function cleanMultiline(value, max) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/**
 * Clave para reconocer el mismo ingrediente escrito de formas distintas:
 * «Calabacín», «calabacin » y «CALABACÍN» son el mismo producto.
 */
export function ingredientKey(name) {
  return cleanLine(name, 200)
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // quita las tildes que NFD deja separadas
    .toLowerCase();
}

/** Comparación alfabética en español (ignora mayúsculas y tildes). */
export const compareEs = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' });
