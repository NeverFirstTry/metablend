'use client'

import { MessageSquare, ChevronRight } from 'lucide-react'
import { t } from '@/lib/i18n'
import { appInfo } from '@/lib/native'
import { feedbackMailto, osLabel } from '@/lib/testers'

// "Send feedback": an email to us with platform, app version, OS and
// language filled in — nothing is sent until the user sends the mail.
export default function FeedbackLink({ lang }) {
  async function open() {
    const info = await appInfo()
    window.location.href = feedbackMailto({ ...info, os: osLabel(navigator.userAgent), lang })
  }
  return (
    <button onClick={open} className="w-full flex items-center justify-between px-4 py-3 text-sm hover:text-emerald-400">
      <span className="inline-flex items-center gap-2"><MessageSquare size={15} className="text-zinc-500" aria-hidden /> {t(lang, 'feedbackSend')}</span>
      <ChevronRight size={16} className="text-zinc-600" aria-hidden />
    </button>
  )
}
