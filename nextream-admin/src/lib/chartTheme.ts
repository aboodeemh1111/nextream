'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export type ChartThemeColors = {
  muted: string;
  border: string;
  foreground: string;
  card: string;
};

const FALLBACK: ChartThemeColors = {
  muted: '#6b7280',
  border: '#e5e7eb',
  foreground: '#111827',
  card: '#ffffff',
};

function readChartThemeColors(): ChartThemeColors {
  if (typeof document === 'undefined') return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  const value = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    muted: value('--muted-foreground', FALLBACK.muted),
    border: value('--border', FALLBACK.border),
    foreground: value('--foreground', FALLBACK.foreground),
    card: value('--card', FALLBACK.card),
  };
}

/** Theme-aware colors for Recharts axis/grid/tooltip. */
export function useChartTheme(): ChartThemeColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartThemeColors>(FALLBACK);

  useEffect(() => {
    setColors(readChartThemeColors());
  }, [resolvedTheme]);

  return colors;
}

export function chartTooltipStyle(colors: ChartThemeColors) {
  return {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    color: colors.foreground,
    fontSize: '12px',
  };
}
