// Đúng checklist hiển thị ở ảnh Figma #1 (Đăng ký): tối thiểu 8 ký tự, có chữ số,
// có hoa & thường, có ký tự đặc biệt. Dùng lại ở RegisterPage và ResetPasswordPage.

import { tr } from '@/i18n'

export interface PasswordChecklist {
  minLength: boolean
  hasDigit: boolean
  hasUpperLower: boolean
  hasSpecialChar: boolean
}

export function checkPassword(password: string): PasswordChecklist {
  return {
    minLength: password.length >= 8,
    hasDigit: /\d/.test(password),
    hasUpperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  }
}

export function passwordScore(password: string): number {
  const c = checkPassword(password)
  return [c.minLength, c.hasDigit, c.hasUpperLower, c.hasSpecialChar].filter(Boolean).length
}

export function isPasswordValid(password: string): boolean {
  return passwordScore(password) === 4
}

export const PASSWORD_STRENGTH_LABEL = ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh']
export const PASSWORD_STRENGTH_LABEL_EN = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

// Nhãn độ mạnh theo ngôn ngữ hiện tại (score 0–4).
export function passwordStrengthLabel(score: number): string {
  return tr(PASSWORD_STRENGTH_LABEL[score] ?? '', PASSWORD_STRENGTH_LABEL_EN[score] ?? '')
}
