import { LANGUAGES } from '@/lib/i18n'
import { IMPRESSUM, OPERATOR, EMAIL } from './content'
import { VisibleLang, BackLink, LangFooter } from './LangChrome'

export const metadata = {
  title: 'Impressum',
  description: 'Impressum and media disclosure of MetaBlend.',
  alternates: { canonical: '/impressum' },
}

// Every language is in the server's HTML, on a static page: no render per
// visit, and the footer link's prefetch costs no function call. VisibleLang
// keeps the visitor's language; without JavaScript all of them show.
function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-emerald-400 text-xs uppercase tracking-widest mb-2">{title}</h2>
      <div className="text-zinc-300">{children}</div>
    </section>
  )
}

function Article({ lang }) {
  const c = IMPRESSUM[lang]
  return (
    <article data-legal lang={lang}>
      <h1 className="text-3xl font-bold mb-1">{c.title}</h1>
      <p className="text-zinc-500 text-sm mb-8">{c.basis}</p>
      <div className="space-y-6 text-sm leading-relaxed text-zinc-300">
        <Section title={c.operator}>
          <address className="not-italic">
            {OPERATOR.map(line => <span key={line}>{line}<br /></span>)}
            {c.country}
          </address>
        </Section>
        <Section title={c.contact}>
          {c.email}: <a href={`mailto:${EMAIL}`} className="text-emerald-400 hover:underline">{EMAIL}</a>
        </Section>
        <Section title={c.business}>{c.businessText}</Section>
        <Section title={c.line}>{c.lineText}</Section>
      </div>
    </article>
  )
}

export default function Impressum() {
  return (
    <main className="min-h-screen bg-[#0e0e12] text-white font-mono p-4 sm:p-8 overflow-x-hidden">
      <VisibleLang />
      <noscript><style>{'[data-legal]{display:block!important;margin-bottom:3rem}'}</style></noscript>
      <div className="max-w-2xl mx-auto">
        <BackLink />
        {LANGUAGES.map(({ code }) => <Article key={code} lang={code} />)}
        <LangFooter />
      </div>
    </main>
  )
}
