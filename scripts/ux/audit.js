// Runs in the page. Measures what a review would otherwise judge by eye: controls and their sizes and names,
// text sizes, contrast, cut-off text, colours in use, wording. Returns plain data.
function AUDIT(opts) {
  const out = { path: location.pathname + location.search, title: document.title, lang: document.documentElement.lang, w: innerWidth, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight }
  const cv = document.createElement('canvas'); cv.width = cv.height = 1
  const cx = cv.getContext('2d', { willReadFrequently: true })
  const memo = new Map()
  const rgba = c => { if (memo.has(c)) return memo.get(c); cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2], d[3] / 255]; memo.set(c, v); return v }
  const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3])).concat(1)
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
  const page = (() => { for (const n of [document.body, document.documentElement]) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.99) return c } return opts.dark ? [15, 21, 27, 1] : [255, 255, 255, 1] })()
  // the colour behind an element: its ancestors' backgrounds, laid over each other; picture: a gradient or image lies in between
  const behind = el => {
    const layers = []; let picture = false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage !== 'none' && n !== document.body && n !== document.documentElement) picture = true
      const c = rgba(cs.backgroundColor)
      if (c[3] > 0) { layers.push(c); if (c[3] > 0.99) break }
    }
    let c = layers.length && layers.at(-1)[3] > 0.99 ? layers.pop() : page
    for (const l of layers.reverse()) c = over(l, c)
    return { c, picture }
  }
  const opacityOf = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o }
  const seen = el => el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && (() => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 })()
  const words = el => (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
  const tag = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')
  const add = (map, key, make, sample) => { const e = map.get(key) ?? make(); e.n++; if (sample && e.samples.length < 3 && !e.samples.includes(sample)) e.samples.push(sample); map.set(key, e) }

  // --- text: sizes, contrast, cut off
  const small = new Map(), contrast = new Map(), sizes = new Map(), cut = []
  const done = new Set()
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const el = t.parentElement
    if (!t.nodeValue.trim() || !el || done.has(el) || el.closest('script,style,noscript,svg title,[aria-hidden="true"] svg')) continue
    done.add(el)
    if (!seen(el)) continue
    const cs = getComputedStyle(el), px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700
    const text = t.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 60)
    sizes.set(px, (sizes.get(px) ?? 0) + 1)
    if (px < 12.95) add(small, px, () => ({ px, n: 0, samples: [] }), text)
    const b = behind(el), fg0 = rgba(cs.color), o = opacityOf(el)
    const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * o], b.c)
    const r = ratio(fg, b.c), need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5
    const off = el.closest('[disabled],[aria-disabled="true"]')
    if (r < need && !off) add(contrast, `${hex(fg)}|${hex(b.c)}|${px}|${bold}`, () => ({ ratio: Math.round(r * 100) / 100, need, fg: hex(fg), bg: hex(b.c), px, bold, picture: b.picture, n: 0, samples: [], where: tag(el) }), text)
    const clipX = /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1
    const clipY = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && cs.webkitLineClamp !== 'none'
    if ((clipX || clipY) && cut.length < 40) cut.push({ text: words(el).slice(0, 80), shown: Math.round(el.clientWidth), full: Math.round(el.scrollWidth), lines: clipY || undefined, where: tag(el) })
  }
  out.small = [...small.values()].sort((a, b) => a.px - b.px)
  out.contrast = [...contrast.values()].sort((a, b) => a.ratio - b.ratio)
  out.sizes = [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([px, n]) => `${px}px x${n}`)
  out.cut = cut

  // --- controls: size, name, icon only
  const controls = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=checkbox],[role=switch],[role=radio],[role=option],[tabindex]:not([tabindex="-1"])')].filter(seen)
  const groups = new Map()
  for (const el of controls) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    const text = words(el).slice(0, 40)
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || (el.labels?.[0] && words(el.labels[0])) || el.getAttribute('placeholder') || ''
    const inline = cs.display === 'inline' && el.tagName === 'A' && words(el.parentElement).length > text.length + 12
    const key = `${tag(el)}|${Math.round(r.width)}x${Math.round(r.height)}|${text ? 'text' : 'icon'}`
    const g = groups.get(key) ?? { el, n: 0, w: Math.round(r.width), h: Math.round(r.height), text, label, inline, icon: !text && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName), where: tag(el), names: [] }
    g.n++; if (g.names.length < 3) g.names.push(text || label || '(none)')
    groups.set(key, g)
  }
  // the room a finger really has: probe outward from the box while the point still hits the control
  const reach = el => {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const r = el.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el) && t.closest('a,button,label') === t) }
    if (!hit(mx, my)) return null
    const far = (dx, dy, x0, y0) => { let d = 0; while (d < 24 && hit(x0 + dx * (d + 2), y0 + dy * (d + 2))) d += 2; return d }
    return { w: Math.round(r.width + far(-1, 0, r.left, my) + far(1, 0, r.right - 1, my)), h: Math.round(r.height + far(0, -1, mx, r.top) + far(0, 1, mx, r.bottom - 1)) }
  }
  out.controls = controls.length
  out.tap = []; out.icons = []
  const floor = opts.phone ? 44 : 24
  for (const g of groups.values()) {
    if (g.icon) out.icons.push({ label: g.label || '(no label)', w: g.w, h: g.h, n: g.n, where: g.where })
    if (g.inline || Math.min(g.w, g.h) >= floor) continue
    const real = out.tap.length < 60 ? reach(g.el) : null
    const w = real?.w ?? g.w, h = real?.h ?? g.h
    if (Math.min(w, h) < floor) out.tap.push({ box: `${g.w}x${g.h}`, reach: real ? `${w}x${h}` : 'covered', min: Math.min(w, h), n: g.n, names: g.names, where: g.where })
  }
  out.tap.sort((a, b) => a.min - b.min)
  scrollTo({ top: 0, behavior: 'instant' })

  // --- colours in use: saturated ones by hue (gold is the accent; green and red are status)
  const hues = new Map()
  const hueName = h => h < 15 || h >= 345 ? 'red' : h < 35 ? 'orange' : h < 65 ? 'gold' : h < 170 ? 'green' : h < 200 ? 'cyan' : h < 260 ? 'blue' : h < 300 ? 'purple' : 'pink'
  const note = (c, el, kind) => {
    if (c[3] < 0.5) return
    const [r, g, b] = c.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
    if (d < 0.12) return
    const s = d / (1 - Math.abs(2 * l - 1))
    if (s < 0.35 || l < 0.12 || l > 0.93) return
    const h = ((max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360
    add(hues, hueName(h), () => ({ hue: hueName(h), n: 0, samples: [] }), `${kind} ${hex(c)} ${tag(el).slice(0, 50)} "${words(el).slice(0, 24)}"`)
  }
  let count = 0
  for (const el of document.body.querySelectorAll('*')) {
    if (++count > 6000) break
    if (!seen(el)) continue
    const cs = getComputedStyle(el)
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) note(rgba(cs.color), el, 'text')
    note(rgba(cs.backgroundColor), el, 'fill')
    if (parseFloat(cs.borderTopWidth) > 0) note(rgba(cs.borderTopColor), el, 'border')
    if (el instanceof SVGElement && el.tagName !== 'svg') { if (cs.fill !== 'none') note(rgba(cs.fill), el, 'svg'); if (cs.stroke !== 'none') note(rgba(cs.stroke), el, 'svg') }
  }
  out.hues = [...hues.values()].sort((a, b) => b.n - a.n)

  // --- wording and structure
  const all = document.body.innerText
  out.safe = (all.match(/[^.\n]*\b(safe(ly|r|st)?|sicher\w*)\b[^.\n]*/gi) ?? []).slice(0, 8).map(s => s.trim().slice(0, 140))
  out.dashes = (all.match(/[^.\n]{0,40}[–—][^.\n]{0,40}/g) ?? []).slice(0, 6)
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(seen).map(h => `${h.tagName} ${words(h).slice(0, 50)}`).slice(0, 40)
  out.h1 = document.querySelectorAll('h1').length
  out.images = [...document.querySelectorAll('img')].filter(seen).filter(i => !i.hasAttribute('alt')).length
  return out
}
