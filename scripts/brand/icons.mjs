// The app icons the picker in More offers (owner's pick, 2026-11-10): ten designs from the app's own M and
// B, Slate the default, and Sky, the icon until then. Each design has three looks: the icon itself, iOS dark
// (the art on the dark backdrop iOS draws) and iOS tinted (white and grey, which iOS colours with the tint
// the person picked). Each look comes in two parts: the scene behind the letters, and the mark (the letters
// and what moves with them). Android's adaptive icon takes the scene as its background layer and the mark as
// its foreground. 100×100 viewBox, like brand.mjs.
import { letters as outline, THEMES, cloud } from './brand.mjs'

const SLATE = '#0f151b', INK = '#f6f8fc', GOLD = '#ffd98a', DEEP_GOLD = '#a86e00'
const L = outline()

// the pair, moved and scaled around (cx, cy + dy); in one colour M and B read as one shape where they meet,
// so then they get a thin gap
function letters(m, b, { dy = 0, scale = 1, cx = 50, cy = 50 } = {}) {
  const g = m === b ? 1.4 : 0
  return `<g transform="translate(${cx} ${cy + dy}) scale(${scale}) translate(-50 -50)"><path d="${L.m}" fill="${m}" transform="translate(${-g} 0)"/><path d="${L.b}" fill="${b}" transform="translate(${g} 0)"/></g>`
}
const ridge = (back, front) => `<path d="M0 100V80l18-17 16 11h44l10-10 12 8v28z" fill="${back}"/><path d="M0 100V88l22-7 18 8 20-7 20 8 20-5v15z" fill="${front}"/>`
const halfSun = fill => `<path d="M44 74a12 12 0 0 1 24 0z" fill="${fill}"/>`
const puff = fill => `<g fill="${fill}"><circle cx="30" cy="58" r="17"/><circle cx="52" cy="46" r="23"/><circle cx="74" cy="58" r="17"/><rect x="13" y="56" width="74" height="27" rx="13.5"/></g>`
const SNOW = [[12, 14, 1.6], [26, 8, 1.2], [44, 12, 1.4], [63, 7, 1.1], [81, 13, 1.7], [90, 30, 1.2], [8, 34, 1.1], [18, 74, 1.3], [33, 82, 1], [70, 80, 1.2], [86, 72, 1.5], [55, 88, 1.1]]
const snow = fill => SNOW.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('')
const snowLine = fill => `<path d="M0 100V86q25-7 50 0t50-2v16z" fill="${fill}"/>`
const dots = (n, mid) => [30, 40, 50, 60, 70].map(x => `<circle cx="${x}" cy="80" r="3" fill="${x === 50 ? mid : n}"/>`).join('')
const sun = fill => `<circle cx="77" cy="25" r="14" fill="${fill}"/>`
const vgrad = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>`
const GLOW = '<radialGradient id="glow" cx="50%" cy="-10%" r="82%"><stop offset="0" stop-color="#ffe4a6" stop-opacity=".95"/><stop offset=".3" stop-color="#ffd36f" stop-opacity=".42"/><stop offset=".65" stop-color="#ffcc5c" stop-opacity=".1"/><stop offset="1" stop-color="#ffcc5c" stop-opacity="0"/></radialGradient>'
const white = (o = {}) => letters('#fff', '#fff', o)
const sky = THEMES.sky
const skyClouds = (a, b) => `<path d="${cloud(L.box.x1 + 12, L.box.y2 - 2, 44, true)}" fill="${a}"/><path d="${cloud(L.box.x2 - 8, L.box.y1 + 2, 30)}" fill="${b}"/>`

// bg: the icon's background (a colour, or a gradient in defs); each look: [scene, mark]
export const ICONS = [
  { id: 'slate', bg: SLATE,
    icon: ['', letters(INK, GOLD)], dark: ['', letters(INK, GOLD)], tinted: ['', white()] },
  { id: 'glow', bg: SLATE, defs: GLOW,
    icon: ['<rect width="100" height="100" fill="url(#glow)"/>', letters(INK, GOLD)],
    dark: ['<rect width="100" height="100" fill="url(#glow)" opacity=".85"/>', letters(INK, GOLD)], tinted: ['', white()] },
  { id: 'gold', bg: SLATE,
    icon: ['', letters(GOLD, GOLD)], dark: ['', letters(GOLD, GOLD)], tinted: ['', white()] },
  { id: 'light', bg: 'url(#lt)', defs: vgrad('lt', ['#f3f6fb', '#ffffff']),
    icon: ['', letters(SLATE, DEEP_GOLD)], dark: ['', letters(INK, GOLD)], tinted: ['', white()] },
  { id: 'butter', bg: 'url(#bt)', defs: vgrad('bt', ['#ffe7b3', '#ffd98a']),
    icon: ['', letters(SLATE, SLATE)], dark: ['', letters(GOLD, GOLD)], tinted: ['', white()] },
  { id: 'summit', bg: SLATE,
    icon: [ridge('#1e2833', '#2b3744') + halfSun(GOLD), letters(INK, GOLD, { dy: -15, scale: 0.84 })],
    dark: [ridge('#262f39', '#333d48') + halfSun(GOLD), letters(INK, GOLD, { dy: -15, scale: 0.84 })],
    tinted: [ridge('#3a3a3a', '#555') + halfSun('#cfcfcf'), white({ dy: -15, scale: 0.84 })] },
  { id: 'weather', bg: SLATE,
    icon: [sun(GOLD), puff(INK) + letters(SLATE, DEEP_GOLD, { scale: 0.62, cy: 66 })],
    dark: [sun(GOLD), puff('#dfe5ee') + letters(SLATE, DEEP_GOLD, { scale: 0.62, cy: 66 })],
    tinted: [sun('#9a9a9a'), puff('#fff') + letters('#000', '#000', { scale: 0.62, cy: 66 })] },
  { id: 'dots', bg: SLATE,
    icon: ['', letters(INK, GOLD, { dy: -6 }) + dots('rgba(226,234,247,.45)', GOLD)],
    dark: ['', letters(INK, GOLD, { dy: -6 }) + dots('rgba(226,234,247,.45)', GOLD)],
    tinted: ['', white({ dy: -6 }) + dots('#777', '#fff')] },
  { id: 'mono', bg: '#000',
    icon: ['', white()], dark: ['', white()], tinted: ['', white()] },
  { id: 'winter', bg: SLATE,
    icon: [snow('rgba(246,248,252,.85)') + snowLine('#e9eef5'), letters(INK, GOLD, { dy: -5 })],
    dark: [snow('rgba(246,248,252,.7)') + snowLine('#cdd5df'), letters(INK, GOLD, { dy: -5 })],
    tinted: [snow('#bbb') + snowLine('#9a9a9a'), white({ dy: -5 })] },
  // the icon until 2026-11-10, as brand.mjs draws it
  { id: 'sky', bg: 'url(#sk)', defs: vgrad('sk', sky.bg),
    icon: [skyClouds(...sky.clouds), letters(sky.m, sky.b)],
    dark: [skyClouds('rgba(255,255,255,0.14)', 'rgba(255,255,255,0.24)'), letters(sky.m, sky.b)], tinted: ['', white()] },
]
export const DEFAULT_ICON = 'slate'

const svg = (inner, defs = '', size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size ? ` width="${size}" height="${size}"` : ''}><defs>${defs}</defs>${inner}</svg>`
const frame = (inset, inner) => `<g transform="translate(${inset * 100} ${inset * 100}) scale(${1 - inset * 2})">${inner}</g>`

// a whole look: 'icon' on its background, 'dark' on transparent (iOS draws its own), 'tinted' on black;
// inset shrinks the art inside the full background (the website's maskable icon keeps a safe zone)
export function iconArt(icon, look = 'icon', size, inset = 0) {
  const [scene, mark] = icon[look]
  const bg = look === 'icon' ? icon.bg : look === 'tinted' ? '#000' : null
  return svg(`${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}${inset ? frame(inset, scene + mark) : scene + mark}`, icon.defs, size)
}
// the art without its background: the splash puts it on a colour of its own
export const artOnly = (icon, size) => svg(icon.icon[0] + icon.icon[1], icon.defs, size)
// Android adaptive icon: the background layer (background and scene, full bleed) and the foreground (the
// mark alone, inset so the 100 units fill the 72 dp a launcher shows of the 108 dp layer)
export const sceneArt = (icon, size) => svg(`<rect width="100" height="100" fill="${icon.bg}"/>${icon.icon[0]}`, icon.defs, size)
export const markArt = (icon, size) => svg(frame(1 / 6, icon.icon[1]), icon.defs, size)
