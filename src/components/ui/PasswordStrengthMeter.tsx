import clsx from 'clsx'
import { checkPassword, passwordScore } from '@/lib/passwordStrength'

// v2: bỏ lưới checklist 2x2 tĩnh (chiếm 2 dòng, luôn hiện cả phần đã đạt) — thay bằng 1 thanh mảnh
// + 1 dòng gợi ý ĐỘNG: chỉ liệt kê đúng phần còn thiếu, tự biến mất khi đạt. Gọn hơn, đỡ rối mắt,
// và đúng tâm lý hơn (chỉ nhắc việc cần làm, không nhắc lại việc đã xong).
const barColors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-brand-500']

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password)
  const checklist = checkPassword(password)

  const missing = [
    !checklist.minLength && '8+ ký tự',
    !checklist.hasDigit && 'chữ số',
    !checklist.hasUpperLower && 'hoa & thường',
    !checklist.hasSpecialChar && 'ký tự đặc biệt',
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
      <p className={clsx('mt-1.5 text-xs', missing.length > 0 ? 'text-gray-400' : 'text-brand-600')}>
        {missing.length > 0 ? `Cần thêm: ${missing.join(', ')}` : '✓ Mật khẩu đủ mạnh'}
      </p>
    </div>
  )
}
