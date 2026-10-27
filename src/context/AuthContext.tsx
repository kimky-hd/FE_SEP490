import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api/authApi'
import { tokenStorage } from '@/lib/storage'
import { companyPermissionSet, hasPermission } from '@/lib/permissions'
import type { AuthSessionDto, CompanyMembershipDto, MeResponseDto, UserDto, WorkspaceSummaryDto } from '@/types/auth'

interface AuthContextValue {
  user: UserDto | null
  companies: CompanyMembershipDto[]
  workspaces: WorkspaceSummaryDto[]
  isBootstrapping: boolean
  isAuthenticated: boolean
  hasOnboarded: boolean
  /** Công ty đang làm việc — hiện app chỉ hỗ trợ 1 công ty/người dùng nên lấy phần tử đầu. */
  currentCompany: CompanyMembershipDto | null
  /** Kiểm tra quyền cấp công ty (scope TENANT) của người dùng trong `currentCompany`. */
  can: (permission: string) => boolean
  applySession: (session: AuthSessionDto) => void
  refreshMe: () => Promise<MeResponseDto>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [companies, setCompanies] = useState<CompanyMembershipDto[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceSummaryDto[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const loadMe = async () => {
    const me = await authApi.me()
    setUser(me.user)
    setCompanies(me.companies)
    setWorkspaces(me.workspaces)
    return me
  }

  useEffect(() => {
    // Cờ huỷ để không set state / xoá token sau khi provider đã unmount (test, StrictMode chạy effect 2 lần).
    let cancelled = false
    const bootstrap = async () => {
      if (tokenStorage.getAccessToken()) {
        try {
          await loadMe()
        } catch {
          if (!cancelled) tokenStorage.clear()
        }
      }
      if (!cancelled) setIsBootstrapping(false)
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const applySession = (session: AuthSessionDto) => {
    tokenStorage.setTokens(session.accessToken, session.refreshToken)
    // Một số endpoint (vd POST /invitations/{token}/accept) trả token nhưng không kèm `user` — coi như chưa
    // hydrate, bên gọi phải refreshMe() rồi mới điều hướng. Không để `undefined` lọt vào state.
    setUser(session.user ?? null)
  }

  const logout = async () => {
    const accessToken = tokenStorage.getAccessToken()
    const refreshToken = tokenStorage.getRefreshToken()
    // Đăng xuất cục bộ ngay lập tức, không chờ mạng.
    tokenStorage.clear()
    setUser(null)
    setCompanies([])
    setWorkspaces([])
    if (refreshToken) {
      try {
        // Token đã bị xoá khỏi storage nên phải truyền tay access token cho header Authorization.
        await authApi.logout(refreshToken, accessToken ?? undefined)
      } catch {
        // đã clear token ở FE rồi, lỗi gọi API logout không quan trọng nữa
      }
    }
  }

  const currentCompany = companies[0] ?? null
  const companyPermissions = companyPermissionSet(currentCompany)

  const value: AuthContextValue = {
    user,
    companies,
    workspaces,
    isBootstrapping,
    isAuthenticated: user !== null,
    hasOnboarded: companies.length > 0 || workspaces.length > 0,
    currentCompany,
    can: (permission) => hasPermission(companyPermissions, permission),
    applySession,
    refreshMe: loadMe,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được gọi bên trong <AuthProvider>')
  return ctx
}
