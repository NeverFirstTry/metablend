import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        {/* Plausible Analytics hier einfügen */}
        <Script
          defer
          data-domain="metablend.app"
          src="https://plausible.io"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}