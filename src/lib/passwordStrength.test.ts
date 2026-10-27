import { describe, expect, it } from 'vitest'
import { checkPassword, isPasswordValid, passwordScore } from './passwordStrength'

describe('checkPassword', () => {
  it('báo tất cả false với chuỗi rỗng', () => {
    expect(checkPassword('')).toEqual({
      minLength: false,
      hasDigit: false,
      hasUpperLower: false,
      hasSpecialChar: false,
    })
  })

  it('chỉ đạt minLength khi đủ 8 ký tự nhưng thiếu tiêu chí khác', () => {
    const result = checkPassword('aaaaaaaa')
    expect(result.minLength).toBe(true)
    expect(result.hasDigit).toBe(false)
    expect(result.hasUpperLower).toBe(false)
    expect(result.hasSpecialChar).toBe(false)
  })

  it('nhận diện đúng từng tiêu chí riêng lẻ', () => {
    expect(checkPassword('Password').hasUpperLower).toBe(true)
    expect(checkPassword('password').hasUpperLower).toBe(false)
    expect(checkPassword('PASSWORD').hasUpperLower).toBe(false)
    expect(checkPassword('pass1234').hasDigit).toBe(true)
    expect(checkPassword('password').hasDigit).toBe(false)
    expect(checkPassword('pass#word').hasSpecialChar).toBe(true)
    expect(checkPassword('password').hasSpecialChar).toBe(false)
  })

  it('mật khẩu 7 ký tự thì minLength = false dù có đủ loại ký tự khác', () => {
    expect(checkPassword('Aa1#aaa').minLength).toBe(false)
  })
})

describe('passwordScore', () => {
  it('rỗng cho điểm 0', () => {
    expect(passwordScore('')).toBe(0)
  })

  it('đạt đủ 4 tiêu chí cho điểm 4', () => {
    expect(passwordScore('FintechOps#2025')).toBe(4)
  })

  it('đạt 2 tiêu chí cho điểm 2', () => {
    // đủ 8 ký tự + có chữ số, thiếu hoa/thường lẫn lộn và ký tự đặc biệt
    expect(passwordScore('password1')).toBe(2)
  })
})

describe('isPasswordValid', () => {
  it('false khi thiếu bất kỳ tiêu chí nào', () => {
    expect(isPasswordValid('password1')).toBe(false)
    expect(isPasswordValid('Password1')).toBe(false)
    expect(isPasswordValid('short1#A')).toBe(true) // đủ 8 ký tự, số, hoa/thường, đặc biệt
  })

  it('true khi đủ cả 4 tiêu chí đúng theo checklist ảnh Figma #1', () => {
    expect(isPasswordValid('FintechOps#2025')).toBe(true)
  })

  it('false với chuỗi rỗng', () => {
    expect(isPasswordValid('')).toBe(false)
  })
})
