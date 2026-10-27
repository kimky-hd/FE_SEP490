import { describe, expect, it } from 'vitest'
import { registerSchema } from './auth/RegisterPage'
import { loginSchema } from './auth/LoginPage'
import { resetPasswordSchema } from './auth/ResetPasswordPage'
import { companySetupSchema } from './onboarding/CompanySetupPage'

const validRegisterInput = {
  fullName: 'Sarah Lin',
  email: 'sarah@fintechcorp.com',
  password: 'FintechOps#2025',
  agree: true,
}

describe('registerSchema (ảnh Figma #1)', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    expect(registerSchema.safeParse(validRegisterInput).success).toBe(true)
  })

  it('từ chối khi thiếu họ tên', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, fullName: '' })
    expect(result.success).toBe(false)
  })

  it('từ chối email sai định dạng', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('từ chối mật khẩu chưa đạt checklist (thiếu ký tự đặc biệt)', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, password: 'Password1' })
    expect(result.success).toBe(false)
  })

  it('từ chối khi chưa tick đồng ý điều khoản', () => {
    const result = registerSchema.safeParse({ ...validRegisterInput, agree: false })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('chấp nhận email + mật khẩu không rỗng, không đòi hỏi độ mạnh mật khẩu', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })

  it('từ chối khi thiếu mật khẩu', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
  })

  it('từ chối email sai định dạng', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('chấp nhận khi 2 mật khẩu khớp và đủ mạnh', () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: 'NewPass#2025',
      confirmPassword: 'NewPass#2025',
    })
    expect(result.success).toBe(true)
  })

  it('từ chối khi 2 mật khẩu không khớp, báo lỗi đúng field confirmPassword', () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: 'NewPass#2025',
      confirmPassword: 'Khac#2025',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword'])
    }
  })

  it('từ chối khi mật khẩu mới chưa đạt checklist', () => {
    const result = resetPasswordSchema.safeParse({ newPassword: 'weak', confirmPassword: 'weak' })
    expect(result.success).toBe(false)
  })
})

describe('companySetupSchema (ảnh Figma #4 + field bổ sung)', () => {
  const validInput = {
    adminPhone: '+84912345678',
    name: 'Acme Fintech Corp',
    taxCode: '0109876543',
    address: 'Level 12, Landmark 81, HCMC',
    emailDomain: 'fintechcorp.com',
    domainAutoJoinEnabled: false,
  }

  it('chấp nhận dữ liệu hợp lệ', () => {
    expect(companySetupSchema.safeParse(validInput).success).toBe(true)
  })

  it('chấp nhận số điện thoại dạng 0xxxxxxxxx lẫn +84xxxxxxxxx', () => {
    expect(companySetupSchema.safeParse({ ...validInput, adminPhone: '0912345678' }).success).toBe(true)
    expect(companySetupSchema.safeParse({ ...validInput, adminPhone: '+84912345678' }).success).toBe(true)
  })

  it('từ chối số điện thoại sai định dạng', () => {
    expect(companySetupSchema.safeParse({ ...validInput, adminPhone: '12345' }).success).toBe(false)
  })

  it('từ chối domain công ty sai định dạng', () => {
    expect(companySetupSchema.safeParse({ ...validInput, emailDomain: 'khong-hop-le' }).success).toBe(false)
  })

  it('từ chối khi thiếu domain công ty', () => {
    expect(companySetupSchema.safeParse({ ...validInput, emailDomain: '' }).success).toBe(false)
  })
})
