import { afterEach, describe, expect, it } from 'vitest'
import { tokenStorage } from './storage'

describe('tokenStorage', () => {
  afterEach(() => {
    tokenStorage.clear()
  })

  it('trả về null khi chưa có token nào', () => {
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
  })

  it('setTokens lưu đúng cả access và refresh token', () => {
    tokenStorage.setTokens('access-x', 'refresh-x')
    expect(tokenStorage.getAccessToken()).toBe('access-x')
    expect(tokenStorage.getRefreshToken()).toBe('refresh-x')
  })

  it('clear xoá sạch cả 2 token', () => {
    tokenStorage.setTokens('access-x', 'refresh-x')
    tokenStorage.clear()
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
  })
})
