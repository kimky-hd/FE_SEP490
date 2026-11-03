import { Link } from 'react-router-dom'
import { buttonClasses } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { useI18n } from '@/i18n'

export function NotFoundPage() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-white bg-[radial-gradient(60%_40%_at_50%_0%,#e8eeff,transparent)] px-4 text-center">
      <Logo />
      <h1 className="text-3xl font-bold tracking-tight text-gray-950">
        {t('Không tìm thấy trang này', 'Page not found')}
      </h1>
      <p className="max-w-sm text-gray-600">
        {t(
          'Lỗi 404: đường dẫn có thể đã đổi hoặc chưa từng tồn tại.',
          'Error 404: the link may have changed or never existed.',
        )}
      </p>
      <Link to="/" className={buttonClasses({ inline: true })}>
        {t('Về trang chủ', 'Back to home')}
      </Link>
    </div>
  )
}
