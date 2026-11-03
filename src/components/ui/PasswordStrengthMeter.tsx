import clsx from 'clsx'
import { checkPassword, passwordScore } from '@/lib/passwordStrength'
import { useI18n } from '@/i18n'

// v2: bỏ lưới checklist 2x2 tĩnh (chiếm 2 dòng, luôn hiện cả phần đã đạt) — thay bằng 1 thanh mảnh
// + 1 dòng gợi ý ĐỘNG: chỉ liệt kê đúng phần còn thiếu, tự biến mất khi đạt. Gọn hơn, đỡ rối mắt,
// và đúng tâm lý hơn (chỉ nhắc việc cần làm, không nhắc lại việc đã xong).
const barColors = ['bg-gray-200', 'bg-red-600', 'bg-amber-500', 'bg-amber-500', 'bg-success-500']

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useI18n()
  const score = passwordScore(password)
  const checklist = checkPassword(password)

  const missing = [
    !checklist.minLength && t('8+ ký tự', '8+ characters'),
    !checklist.hasDigit && t('chữ số', 'a digit'),
    !checklist.hasUpperLower && t('hoa & thường', 'upper & lower case'),
    !checklist.hasSpecialChar && t('ký tự đặc biệt', 'a special character'),
  ].filter((v): v is string => Boolean(v))

  if (!password) return null

  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={clsx('h-1 flex-1 rounded-full transition-colors', i < score ? barColors[score] : 'bg-gray-200')}
          />
        ))}
      </div>
      <p className={clsx('mt-1.5 text-xs', missing.length > 0 ? 'text-gray-600' : 'text-success-700')}>
        {missing.length > 0
          ? `${t('Cần thêm', 'Still needs')}: ${missing.join(', ')}`
          : t('Mật khẩu đủ mạnh', 'Password is strong enough')}
      </p>
    </div>
  )
}
