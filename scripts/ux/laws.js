// Runs in the page. Three measures for the "laws" part of the review.
const LAWS = {
  // Hick and Fitts: what can be tapped on the first screen, and where it sits for a thumb
  first() {
    const bar = document.querySelector('.app-tabbar')?.getBoundingClientRect().top ?? innerHeight
    const seen = el => el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    const name = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 28)
    const all = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=tab],[role=button]')].filter(seen)
      .map(el => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width > 2 && r.bottom > 0 && r.top < bar)
    const zone = y => (y < innerHeight / 3 ? 'top' : y < innerHeight * 2 / 3 ? 'middle' : 'bottom')
    const rows = all.filter(({ el }) => !el.closest('.app-tabbar')).map(({ el, r }) => ({ name: name(el) || '(icon)', y: Math.round(r.top + r.height / 2), zone: zone(r.top + r.height / 2) }))
    const by = z => rows.filter(r => r.zone === z).map(r => r.name)
    return { choices: rows.length, tabBar: all.length - rows.length, top: by('top'), middle: by('middle'), bottom: by('bottom') }
  },
  // gold: every visible thing coloured gold, by what it is
  gold() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1
    const cx = cv.getContext('2d', { willReadFrequently: true }), memo = new Map()
    const rgba = c => { if (memo.has(c)) return memo.get(c); cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2], d[3] / 255]; memo.set(c, v); return v }
    const isGold = c => { if (c[3] < 0.5) return false; const [r, g, b] = c.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min; if (d < 0.12) return false; const s = d / (1 - Math.abs(2 * l - 1)); if (s < 0.35 || l < 0.12 || l > 0.93) return false; const h = ((max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360; return h >= 30 && h < 62 }
    const bar = document.querySelector('.app-tabbar')?.getBoundingClientRect().top ?? innerHeight
    const kinds = new Map(), firstKinds = new Map()
    const kind = (el, how) => {
      if (el.closest('.app-tabbar')) return 'current tab in the tab bar'
      const svg = el.closest('svg')
      if (svg && svg.getBoundingClientRect().width > 200) return 'chart line or chart label'
      if (el.closest('[role=tab][aria-selected="true"],[aria-pressed="true"],[aria-current]')) return 'selected tab or chip'
      if (/Blend/.test(el.textContent) && el.closest('h1,button,a')?.textContent.trim().startsWith('Meta')) return 'logo'
      if (el.closest('button,[role=button]')) return how === 'text' || svg ? 'button (text or icon)' : 'button (fill or border)'
      if (el.closest('a')) return 'link'
      if (el.closest('h1')) return 'page title'
      if (el.closest('h2,h3,h4')) return 'section label'
      if (svg) return 'icon'
      if (how === 'text') return 'running text'
      return 'card border or fill'
    }
    const add = (map, k, el) => { const e = map.get(k) ?? { n: 0, samples: [] }; e.n++; const t = (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30); if (t && e.samples.length < 3 && !e.samples.includes(t)) e.samples.push(t); map.set(k, e) }
    for (const el of document.body.querySelectorAll('*')) {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue
      const cs = getComputedStyle(el)
      let how = null
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()) && isGold(rgba(cs.color))) how = 'text'
      else if (el instanceof SVGElement && el.tagName !== 'svg' && ((cs.stroke !== 'none' && isGold(rgba(cs.stroke))) || (cs.fill !== 'none' && isGold(rgba(cs.fill))))) how = 'svg'
      else if (isGold(rgba(cs.backgroundColor))) how = 'fill'
      else if (parseFloat(cs.borderTopWidth) > 0 && isGold(rgba(cs.borderTopColor))) how = 'border'
      if (!how) continue
      const k = kind(el, how)
      add(kinds, k, el)
      if (r.top < bar && r.bottom > 0) add(firstKinds, k, el)
    }
    const out = m => [...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${k} x${v.n}${v.samples.length ? ' (' + v.samples.join(' | ') + ')' : ''}`)
    return { firstScreen: out(firstKinds), page: out(kinds) }
  },
  // Doherty: after an action, when does anything on screen change, and when is the result there
  async act(run, done) {
    const t0 = performance.now(); let first = null, what = ''
    // only what a person can see counts: nothing in the page's head, nothing hidden, no attribute on a form field
    const shows = rec => { const t = rec.target, el = t.nodeType === 1 ? t : t.parentElement; return !!el && !el.closest('head,script,style,link') && el !== document.documentElement && el.isConnected && el.checkVisibility() && !(rec.type === 'attributes' && /^(name|value|autocomplete)$/.test(rec.attributeName ?? '')) }
    const mo = new MutationObserver(all => { if (first !== null) return; const recs = all.filter(shows); if (!recs.length) return; first = performance.now() - t0; const t = recs[0].target, el = t.nodeType === 1 ? t : t.parentElement; what = `${recs[0].type}${recs[0].attributeName ? ' ' + recs[0].attributeName : ''} on ${(el?.tagName ?? '?').toLowerCase()}${typeof el?.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}` })
    mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    try { run() } catch (e) { mo.disconnect(); return { error: String(e).slice(0, 80) } }
    let result = null
    const end = performance.now() + 9000
    while (performance.now() < end) { await new Promise(r => requestAnimationFrame(r)); if (first !== null && (!done || done())) { result = performance.now() - t0; break } }
    mo.disconnect()
    return { first: first === null ? null : Math.round(first), result: result === null ? null : Math.round(result), what }
  },
}
