/**
 * Company themes. When a CFO signs in, the app takes on their company's logo and colours;
 * IDO users always see the IDO theme. Logos and colours come from each company's public website.
 */
import { C, SERIES } from '../components/charts'

export interface Brand {
  key: string
  appName: string
  logo: string // for light backgrounds
  logoOnDark: string // for the navy sidebar
  invertOnDark?: boolean // no white logo available: invert the dark one
  mark?: string // optional watermark in hero bands
  colors: { primary: string; navy: string; teal: string; sky: string; muted: string; slate: string; mist: string; line: string }
  series: string[]
}

const IDO: Brand = {
  key: 'ido',
  appName: 'IDO Finance Supervisor',
  logo: '/ido-logo.svg',
  logoOnDark: '/ido-logo-white.svg',
  mark: '/favicon.svg',
  colors: { primary: '#0A3D50', navy: '#001C27', teal: '#015677', sky: '#759CAF', muted: '#808E93', slate: '#6F7D82', mist: '#EEF3F5', line: '#DCE5E9' },
  series: ['#015677', '#759CAF', '#D97706', '#0A3D50', '#9DB8C5', '#B45309'],
}

export const BRANDS: Record<string, Brand> = {
  julphar: {
    key: 'julphar',
    appName: 'Julphar Finance',
    logo: '/brands/julphar-logo.png',
    logoOnDark: '/brands/julphar-logo-white.png',
    colors: { primary: '#1B476C', navy: '#132E4D', teal: '#1A88C9', sky: '#54B4D3', muted: '#7F8A94', slate: '#5B6670', mist: '#EEF5FA', line: '#D8E6F0' },
    series: ['#1A88C9', '#54B4D3', '#D97706', '#1B476C', '#9FCBE6', '#B45309'],
  },
  'rak-ports': {
    key: 'rak-ports',
    appName: 'RAK Ports Finance',
    logo: '/brands/rakports-logo-clean.png',
    logoOnDark: '/brands/rakports-logo-white.png',
    colors: { primary: '#1F3459', navy: '#152850', teal: '#2F6A9E', sky: '#8FA9C9', muted: '#7E8796', slate: '#5A6475', mist: '#EEF2F8', line: '#DAE2EE' },
    series: ['#2F6A9E', '#8FA9C9', '#D97706', '#1F3459', '#B9C9DE', '#B45309'],
  },
}

let current: Brand = IDO
export const currentBrand = () => current

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')

/** Applies a company theme (or IDO's when tenantId is null) to CSS variables, chart colours and the tab title. */
export function applyBrand(tenantId: string | null) {
  current = (tenantId && BRANDS[tenantId]) || IDO
  const root = document.documentElement
  for (const [k, v] of Object.entries(current.colors)) root.style.setProperty(`--ido-${k}`, rgb(v))
  Object.assign(C, { primary: current.colors.primary, teal: current.colors.teal, sky: current.colors.sky, line: current.colors.line, muted: current.colors.muted })
  current.series.forEach((c, i) => (SERIES[i] = c))
  document.title = current === IDO ? 'IDO Finance Supervisor' : current.appName
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (icon) icon.href = current === IDO ? '/favicon.svg' : current.logo
}
