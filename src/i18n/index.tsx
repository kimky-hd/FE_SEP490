import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Song ngữ Việt / Anh, không cần thư viện: mỗi chuỗi viết cả hai bản ngay tại chỗ dùng, `t('Tiếng Việt', 'English')`.
// Lý do: app nhỏ, đọc code thấy luôn cả hai bản, không phải tra file khoá. Mặc định tiếng Việt.
//
// Trong component: `const { t, lang } = useI18n()`.
// Ngoài component (hàm tiện ích chạy lúc render hoặc trong handler): `tr('…', '…')` đọc ngôn ngữ hiện tại.

export type Lang = 'vi' | 'en'

const STORAGE_KEY = 'ssam.lang'

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}

// Ngôn ngữ hiện tại cho code ngoài React (định dạng lỗi API, ngày tháng…). Provider cập nhật biến này.
let currentLang: Lang = typeof window === 'undefined' ? 'vi' : readStoredLang()

export function tr(vi: string, en: string): string {
  return currentLang === 'en' ? en : vi
}

export function getLang(): Lang {
  return currentLang
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (vi: string, en: string) => string
}

// Giá trị mặc định dùng được cả khi không có Provider (test, story): luôn tiếng Việt.
const I18nContext = createContext<I18nValue>({
  lang: 'vi',
  setLang: () => {},
  t: (vi) => vi,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  // Cập nhật ngay trong lần render này để `tr()` ngoài React khớp với UI.
  currentLang = lang

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    currentLang = next
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // trình duyệt chặn storage: vẫn đổi được ngôn ngữ cho phiên này
    }
  }, [])

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (vi: string, en: string) => (lang === 'en' ? en : vi) }),
    [lang, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
