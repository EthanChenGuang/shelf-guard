/** PRD Minimalist Light palette — mirrors @theme tokens in src/index.css (D-13, DSGN-01). */
export const SG_COLORS = {
  white: '#ffffff',
  surface: '#f8fafc',
  primary: '#0f172a',
  secondary: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  camera: '#0f172a',
  scan: '#38bdf8',
} as const;

export type SgColorKey = keyof typeof SG_COLORS;
