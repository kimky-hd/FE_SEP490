import { useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { AuthCard } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { UserIcon, UsersIcon } from '@/components/ui/icons'
import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'

type AccountType = 'personal' | 'business'

export function ChooseAccountTypePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const [selected, setSelected] = useState<AccountType>('business')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (selected === 'personal') {
      navigate('/onboarding/create-workspace', {
        state: {
          companyId: null,
          suggestedName: user ? t(`Workspace của ${user.fullName}`, `${user.fullName}'s workspace`) : undefined,
        },
      })
      return
    }

    if (!user) return
    setError(null)
    setIsChecking(true)
    try {
      const match = await companyApi.matchByEmail(user.email)
      if (match.matched && match.company) {
        navigate('/onboarding/domain-match', { state: { company: match.company } })
      } else {
        navigate('/onboarding/company-setup')
      }
    } catch {
      setError(
        t(
          'Không kiểm tra được domain công ty, vui lòng thử lại.',
          'Could not check your company domain. Please try again.',
        ),
      )
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <AuthCard
      maxWidth="max-w-xl"
      title={t('Bạn dùng SSAM cho ai?', 'Who will use SSAM?')}
      description={t('Bạn vẫn mời thêm thành viên được bất cứ lúc nào.', 'You can invite members at any time.')}
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div role="group" aria-label={t('Loại tài khoản', 'Account type')} className="grid gap-3 sm:grid-cols-2">
        <OptionCard
          selected={selected === 'personal'}
          onSelect={() => setSelected('personal')}
          icon={<UserIcon className="h-5 w-5" />}
          title={t('Cá nhân', 'Personal')}
          description={t('Một workspace riêng cho bạn.', 'A private workspace for you.')}
        />
        <OptionCard
          selected={selected === 'business'}
          onSelect={() => setSelected('business')}
          icon={<UsersIcon className="h-5 w-5" />}
          title={t('Doanh nghiệp', 'Business')}
          description={t('Công ty, nhiều đội, phân quyền theo vai trò.', 'A company with teams and role-based access.')}
        />
      </div>

      <div className="mt-6">
        <Button onClick={handleContinue} isLoading={isChecking}>
          {t('Tiếp tục', 'Continue')}
        </Button>
      </div>
    </AuthCard>
  )
}

function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={clsx(
        'relative flex flex-col items-start rounded-card border p-4 text-left transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
        selected
          ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600'
          : 'border-gray-200 bg-white shadow-xs hover:border-gray-300',
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full border',
          selected ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white',
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
      <span
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-control border',
          selected ? 'border-brand-200 bg-white text-brand-600' : 'border-gray-200 bg-gray-50 text-gray-500',
        )}
      >
        {icon}
      </span>
      <span className="mt-3 text-sm font-semibold text-gray-900">{title}</span>
      <span className="mt-1 text-sm text-gray-600">{description}</span>
    </button>
  )
}
