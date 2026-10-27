import { useState } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { AuthCard, AuthCardEyebrow } from '@/components/layout/AuthCard'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Tag } from '@/components/ui/Eyebrow'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { UserIcon, UsersIcon } from '@/components/ui/icons'
import type { ReactNode } from 'react'

type AccountType = 'personal' | 'business'

export function ChooseAccountTypePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selected, setSelected] = useState<AccountType>('business')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async () => {
    if (selected === 'personal') {
      navigate('/onboarding/create-workspace', {
        state: { companyId: null, suggestedName: user ? `Workspace của ${user.fullName}` : undefined },
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
      setError('Không kiểm tra được domain công ty, vui lòng thử lại.')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <AuthCard maxWidth="max-w-lg">
      <AuthCardEyebrow>// Bước thiết lập ban đầu</AuthCardEyebrow>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
        Bạn dự định sử dụng SSAM cho mục đích nào?
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Bạn có thể chuyển đổi hoặc bổ sung thành viên bất kỳ lúc nào trong cài đặt dự án.
      </p>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <ul className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
        <OptionRow
          index={1}
          selected={selected === 'personal'}
          onSelect={() => setSelected('personal')}
          icon={<UserIcon className="h-4 w-4" />}
          title="Cho cá nhân"
          badge="Cá nhân"
          description="Soạn thảo tài liệu, theo dõi dự án cá nhân và sử dụng AI độc lập."
          footnote="Truy cập trực tiếp Dashboard"
        />
        <OptionRow
          index={2}
          selected={selected === 'business'}
          onSelect={() => setSelected('business')}
          icon={<UsersIcon className="h-4 w-4" />}
          title="Cho doanh nghiệp / Tổ chức"
          badge="Khuyến dùng"
          badgeTone="brand"
          description="Cộng tác trên toàn bộ vòng đời phát triển phần mềm (SDLC), thiết lập quy trình làm việc động và quản lý phân quyền theo chuẩn doanh nghiệp."
          footnote="Chuyển tiếp đến Thiết lập Doanh nghiệp"
        />
      </ul>

      <div className="mt-6">
        <Button onClick={handleContinue} isLoading={isChecking}>
          {selected === 'business' ? 'Tiếp tục thiết lập Đội ngũ →' : 'Truy cập Dashboard →'}
        </Button>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Chọn &quot;Cho doanh nghiệp&quot; sẽ đưa bạn đến biểu mẫu Thiết lập Tổ chức Doanh nghiệp, hỗ trợ phân quyền và SSO.
      </p>
    </AuthCard>
  )
}

function OptionRow({
  index,
  selected,
  onSelect,
  icon,
  title,
  badge,
  badgeTone = 'neutral',
  description,
  footnote,
}: {
  index: number
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  title: string
  badge: string
  badgeTone?: 'neutral' | 'brand'
  description: string
  footnote: string
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={clsx(
          'group grid w-full grid-cols-[1.5rem_1fr_1rem] items-start gap-3 py-4 text-left transition-colors sm:grid-cols-[2rem_1fr_1rem]',
          selected ? 'text-gray-950' : 'text-gray-600 hover:text-gray-900',
        )}
      >
        <span className={clsx('mt-0.5 font-mono text-sm', selected ? 'text-brand-700' : 'text-gray-300')}>0{index}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('shrink-0', selected ? 'text-brand-600' : 'text-gray-400')}>{icon}</span>
            <h3 className="font-semibold tracking-tight text-gray-950">{title}</h3>
            <Tag tone={selected ? badgeTone : 'neutral'}>{badge}</Tag>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{description}</p>
          <p className={clsx('mt-2 font-mono text-[11px] uppercase tracking-[0.1em]', selected ? 'text-brand-700' : 'text-gray-400')}>
            → {footnote}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={clsx(
            'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-brand-600' : 'border-gray-300 group-hover:border-gray-400',
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-brand-600" />}
        </span>
      </button>
    </li>
  )
}
