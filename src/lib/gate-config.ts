/**
 * Production defaults: site is public, editor off.
 * Enable editor locally with PUBLIC_EDITOR=1 and PUBLIC_EDITOR_PASSWORD in .env
 * (never commit a real password — empty password disables unlock).
 */
const editorFlag = import.meta.env.PUBLIC_EDITOR === '1';
const editorPassword = String(import.meta.env.PUBLIC_EDITOR_PASSWORD ?? '');

export const GATE = {
  lockSite: false,
  editor: editorFlag && editorPassword.length > 0,
  password: editorPassword,
  authKey: 'db-gate-auth',
  contentKey: 'db-gate-content',
} as const;

export function isGateEnabled() {
  return GATE.lockSite === true;
}

export function isEditorEnabled() {
  return GATE.editor === true;
}
