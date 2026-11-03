import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { companyApi } from '@/api/companyApi'
import { apiErrorMessage, applyApiFieldErrors } from '@/lib/apiErrors'
import { ProjectSquare } from '@/components/ui/ProjectSquare'
import type { ProjectDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { InviteSuccess, makeInviteEmailSchema } from './inviteParts'

// Mảnh dùng chung của trang Tổng quan: lời chào, thẻ "Mời đội", hộp chọn dự án cho "+ Tài liệu mới", icon KPI.

type T = (vi: string, en: string) => string

const VI_SURNAMES = new Set([
  'nguyễn',
  'trần',
  'lê',
  'phạm',
  'hoàng',
  'huỳnh',
  'phan',
  'vũ',
  'võ',
  'đặng',
  'bùi',
  'đỗ',
  'hồ',
  'ngô',
  'dương',
  'lý',
  'đinh',
  'trịnh',
  'mai',
  'cao',
  'đoàn',
  'lâm',
  'tạ',
  'hà',
  'lưu',
  'trương',
  'đào',
  'kiều',
])

/**
 * Tên gọi trong lời chào: tên kiểu Việt (≥ 2 chữ, chữ đầu là họ phổ biến) lấy chữ cuối ("Nguyễn Văn An" → "An");
 * còn lại giữ nguyên cả tên ("UX Review" → "UX Review").
 */
export function callName(fullName: string | undefined | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && VI_SURNAMES.has(parts[0].toLocaleLowerCase('vi'))) return parts[parts.length - 1]
  return parts.join(' ')
}

export function greeting(t: T, hour = new Date().getHours()) {
  if (hour < 11) return t('Chào buổi sáng', 'Good morning')
  if (hour < 13) return t('Chào buổi trưa', 'Good afternoon')
  if (hour < 18) return t('Chào buổi chiều', 'Good afternoon')
  return t('Chào buổi tối', 'Good evening')
}

export function todayLabel(lang: 'vi' | 'en', now = new Date()) {
  const text = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: lang === 'vi' ? '2-digit' : 'short',
  }).format(now)
  return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1)
}

// --- Mời đội ---

/** Thẻ "Mời đội của bạn": email + "Mời" (role mặc định Member của công ty, như /members/invite khi để trống role). */
export function InviteCard({
  companyId,
  description,
  onInvited,
  onDismiss,
  className,
}: {
  companyId: number
  description: string
  onInvited: () => void
  onDismiss?: () => void
  className?: string
}) {
  const { t } = useI18n()
  return (
    <section
      aria-labelledby="invite-card-title"
      className={clsx('rounded-card border border-gray-200 bg-white px-4 py-3.5 shadow-xs', className)}
    >
      <div className="flex items-center gap-2">
        <h2 id="invite-card-title" className="flex-1 text-sm font-medium text-gray-950">
          {t('Mời đội của bạn', 'Invite your team')}
        </h2>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('Ẩn gợi ý mời đội', 'Hide the invite suggestion')}
            className="rounded-control px-1.5 py-0.5 text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          >
            {t('Ẩn', 'Hide')}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-gray-500">{description}</p>
      <div className="mt-2.5">
        <QuickInvite companyId={companyId} onInvited={onInvited} />
      </div>
    </section>
  )
}

function QuickInvite({ companyId, onInvited }: { companyId: number; onInvited: () => void }) {
  const { t } = useI18n()
  const schema = useMemo(() => z.object({ email: makeInviteEmailSchema(t) }), [t])
  const [serverError, setServerError] = useState<string | null>(null)
  const [invited, setInvited] = useState<{ email: string; inviteUrl: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = async ({ email }: { email: string }) => {
    setServerError(null)
    try {
      const result = await companyApi.invite(companyId, { email })
      setInvited({ email, inviteUrl: result.inviteUrl })
      reset()
      onInvited()
    } catch (err) {
      if (!applyApiFieldErrors(err, setError, ['email'])) setServerError(apiErrorMessage(err))
    }
  }

  if (invited)
    return <InviteSuccess email={invited.email} inviteUrl={invited.inviteUrl} onAgain={() => setInvited(null)} />

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex gap-2">
        <label htmlFor="quick-invite-email" className="sr-only">
          {t('Email người được mời', 'Invitee email')}
        </label>
        <input
          id="quick-invite-email"
          type="email"
          autoComplete="off"
          placeholder={t('email@congty.vn', 'email@company.com')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email || serverError ? 'quick-invite-error' : undefined}
          className={clsx(
            'h-11 min-w-0 flex-1 rounded-control border bg-white px-3 text-sm text-gray-950 shadow-xs placeholder:text-gray-500 focus:outline-none focus:ring-4 lg:h-9',
            errors.email
              ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100',
          )}
          {...register('email')}
        />
        <Button type="submit" variant="secondary" inline isLoading={isSubmitting} className="shrink-0">
          {t('Mời', 'Invite')}
        </Button>
      </div>
      {(errors.email || serverError) && (
        <p id="quick-invite-error" role="alert" className="mt-1.5 text-xs text-red-700">
          {errors.email?.message ?? serverError}
        </p>
      )}
      <Link
        to="/members/invite"
        className="mt-1.5 inline-block text-xs text-gray-500 hover:text-gray-800 hover:underline"
      >
        {t('Chọn role & workspace', 'Choose role & workspace')}
      </Link>
    </form>
  )
}

// --- Chọn dự án cho "+ Tài liệu mới" ---

export type NewDocKind = 'blank' | 'notes'

export function ProjectPickerModal({
  open,
  kind,
  projects,
  onPick,
  onClose,
}: {
  open: boolean
  kind: NewDocKind
  projects: ProjectDto[]
  onPick: (project: ProjectDto) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      title={
        kind === 'notes'
          ? t('Tạo tài liệu từ ghi chú họp', 'Create a document from meeting notes')
          : t('Tạo trang trống', 'Create a blank page')
      }
      description={t('Chọn dự án chứa tài liệu.', 'Pick the project for this document.')}
      onClose={onClose}
    >
      <ul className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto">
        {projects.map((p) => (
          <li key={p.projectId}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 lg:min-h-10"
            >
              <ProjectSquare projectId={p.projectId} name={p.name} size="md" />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-950">{p.name}</span>
              <span className="truncate text-xs text-gray-500">{p.workspaceName}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// --- Icon KPI (outline 18px) ---

const kpiSvg = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
)
export const KpiIcons = {
  review: kpiSvg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>,
  ),
  write: kpiSvg(<path d="M4 20h4L19 9l-4-4L4 16z" />),
  changes: kpiSvg(
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>,
  ),
  stale: kpiSvg(
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>,
  ),
  doc: kpiSvg(
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h7" />
    </>,
  ),
}
