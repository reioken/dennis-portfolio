/** Include static imports, dynamic imports and Vite's lazy dependency tables.
 * A conservative superset is intentional: these are reachable bytes, not initial transfer.
 */
export function relativeJsAssets(source) {
  return [...new Set([...source.matchAll(/["'`](\.\/?[^"'`\s]+\.js)["'`]/g)].map((match) => match[1]))];
}
