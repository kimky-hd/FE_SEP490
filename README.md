# SSAM Frontend

React 18 + TypeScript + Vite 5 + Tailwind CSS 3 (react-router 6, react-hook-form + zod, axios).

FE code theo các API contract ở thư mục `doc/` (gốc repo `DoAn`). BE đổi API thì sửa contract trước, rồi báo FE:

| Contract | Phạm vi |
|---|---|
| `doc/Auth-API-Contract.md` | Đăng ký / đăng nhập / xác thực email / quên mật khẩu / onboarding company / lời mời |
| `doc/Workspace-RBAC-API-Contract.md` | Workspace, Role & Phân quyền, Dự án & Workflow (+ các chỗ đổi trên API Auth cũ) |
| `doc/DB-Changes-Workspace-RBAC-Project.md`, `doc/BE-Changes-Workspace-RBAC-Project.md` | Thay đổi DB và việc BE cần làm cho phần trên |

## Chạy dự án

```bash
npm install
cp .env.example .env    # rồi chỉnh các biến bên dưới
npm run dev             # http://127.0.0.1:5174
```

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_BASE_URL` | URL API BE, vd `http://localhost:5158/api/v1` (BE .NET) |
| `VITE_GOOGLE_CLIENT_ID` | OAuth Client ID (Google Cloud Console, loại "Web application"). Bỏ trống thì nút Google vẫn hiện nhưng báo lỗi khi bấm |
| `VITE_USE_MOCK` | `true` = bật mock trong app cho Workspace / Role / Dự án (BE chưa có các API này). Mặc định `false` |

- Dev server ép IPv4 `127.0.0.1:5174` (`vite.config.ts`) để ngrok/tunnel nối được — mở đúng địa chỉ này.
- Font Be Vietnam Pro nạp qua Google Fonts trong `index.html`; offline thì rơi về system-ui.

### Chế độ mock (đang dùng cho Workspace / Role / Dự án)

BE hiện mới có API Auth/Onboarding và `POST /workspaces`. Các màn mới chạy bằng **mock trong app** (`src/mocks/`):

```bash
# .env
VITE_USE_MOCK=true
```

- Mock chặn request ngay trên axios (`axios-mock-adapter`), **có state** (lưu `localStorage` key `ssam.mockdb.v2`) và **kiểm tra quyền + luật workflow giống BE** — tạo role / đổi quyền / tạo dự án xong thì tải lại vẫn còn, và người dùng khác thấy nút ẩn-hiện / bị 403 đúng như thật.
- Route mock không khai báo (đăng ký, Google, onboarding company…) vẫn đi ra `VITE_API_BASE_URL`.
- Ở chế độ mock **đăng nhập bằng tài khoản demo** (mật khẩu chung `Password@123`), không dùng tài khoản BE thật:

| Email | Dùng để thử |
|---|---|
| `sarah@fintechcorp.com` | Tenant Admin — toàn quyền, khu Quản trị công ty, tạo role |
| `khoa@fintechcorp.com` | Workspace Admin *Mobile Banking Revamp* — quản lý thành viên, cài đặt workspace, PM dự án CORE |
| `ky@fintechcorp.com` | Project Initiator — **tạo được dự án** (wizard 3 bước) |
| `luong@fintechcorp.com` | Workspace Member — **không** tạo được dự án (modal Access Denied) |
| `tam@fintechcorp.com` | QA trong dự án — xem workflow chỉ đọc |

  Danh sách đầy đủ + kịch bản bấm thử: **`mock/README.md`**.
- Console trình duyệt: `__ssamMock.accounts()` in bảng tài khoản, `__ssamMock.reset()` đưa dữ liệu về ban đầu (rồi tải lại trang).
- Dữ liệu mẫu nằm ở `src/mocks/data.ts`, mẫu SDLC ở `src/mocks/sdlcTemplates.ts` — **BE seed giống hệt** để FE chạy được với BE thật mà không cần sửa.

### Chuyển sang BE thật

Khi BE xong các API trong `Workspace-RBAC-API-Contract.md`: đặt `VITE_USE_MOCK=false` (hoặc xoá dòng), trỏ `VITE_API_BASE_URL` về BE. Không cần sửa code. Build production không đóng gói mock khi cờ tắt.

> `ssam-auth.mockoon.json` (Mockoon, cổng 5000) là mock cũ cho riêng luồng Auth/Onboarding — xem phần đầu `mock/README.md`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server `127.0.0.1:5174` |
| `npm run build` | `tsc --noEmit` + `vite build` ra `dist/` |
| `npm test` | Vitest (jsdom) — gồm test mock RBAC/Project (`src/mocks/mocks.test.ts`), smoke test các màn (`src/pages/rbacPages.test.tsx`), luật workflow (`src/lib/workflowValidation.test.ts`) |
| `npm run lint` | ESLint — repo **chưa có file cấu hình ESLint**, lệnh hiện báo lỗi thiếu config |

## Tính năng & route

### Auth & Onboarding (BE thật)
Đăng ký, đăng nhập (email + Google), quên / đặt lại mật khẩu, xác thực email, onboarding Cá nhân / Doanh nghiệp, gợi ý tham gia theo domain (kèm chờ duyệt), tạo workspace đầu tiên, chấp nhận lời mời qua email.

### Workspace (mock)
| Route | Màn hình |
|---|---|
| `/workspaces` | Danh sách workspace (đang hoạt động / lưu trữ), modal **Tạo Workspace** (tên, mã tự sinh, mô tả) |
| `/workspaces/:id` | Tab **Tổng quan** |
| `/workspaces/:id/projects` | Tab **Dự án** — bảng dự án; nút "Tạo dự án" (thiếu quyền → modal Access Denied, Figma hàng 2 frame 01) |
| `/workspaces/:id/members` | Tab **Thành viên** — role riêng trong workspace, thêm / gỡ (gỡ = mất luôn quyền ở các dự án) |
| `/workspaces/:id/settings` | Tab **Cài đặt** — sửa thông tin, lưu trữ / khôi phục |

### Dự án & Workflow (mock)
| Route | Màn hình |
|---|---|
| `/workspaces/:id/projects/new` | **Wizard tạo dự án 3 bước** (Figma hàng 2 frame 02–04): Project & Phases (key tự sinh, chọn Scrum / Kanban / Custom, bảng phase) → Issue Workflow (trạng thái + luật chuyển theo role từng phase, kiểm tra ngõ cụt) → Invite Users (thành viên + role dự án, bảng tóm tắt). Tự lưu nháp vào `localStorage` |
| `/projects` | Mục "Dự án" ở sidebar — mọi dự án thấy được trong công ty |
| `/projects/:id` | **Tổng quan** (Tài liệu / Kanban / Testcase hiện "SỚM") |
| `/projects/:id/workflow` | **Workflow** — phase, trạng thái, luật chuyển; thêm phase, sửa trạng thái & luồng chuyển |
| `/projects/:id/members` | **Thành viên dự án** — role cấp dự án |
| `/projects/:id/settings` | **Cài đặt** — tên, mô tả, bật / tắt module AI, lưu trữ |

### Quản trị công ty (mock)
| Route | Màn hình |
|---|---|
| `/admin/roles` | **Danh mục role** (Figma C) — lọc theo cấp công ty / workspace / dự án, bật / tắt role |
| `/admin/roles/new`, `/admin/roles/:id` | **Tạo / sửa role + ma trận quyền** (Figma D) — chọn phạm vi, tick quyền theo nhóm, sao chép quyền từ role khác |
| `/admin/users` | **Người dùng** — đổi role cấp công ty |
| `/members/invite` | **Mời thành viên** — chọn role từ danh mục, tuỳ chọn thêm thẳng vào 1 workspace |

### Phân quyền phía FE
- Quyền hiệu lực lấy từ `GET /auth/me` (`companies[].permissions`, `workspaces[].permissions`) và `myPermissions` của workspace / dự án.
- Cấp công ty: `useAuth().can('role.manage')`; cấp workspace / dự án: `can` trong `useWorkspaceContext()` / `useProjectContext()`.
- Key quyền: hằng số `PERMISSIONS` trong `src/types/rbac.ts`. Thiếu quyền thì **ẩn nút / menu**; vào thẳng URL thì hiện "Bạn không có quyền truy cập". BE vẫn là nơi chặn thật (403).

## Cấu trúc

```
src/
  api/          - gọi API theo nhóm: authApi, companyApi, invitationApi, workspaceApi, roleApi, projectApi
  mocks/        - mock trong app (bật bằng VITE_USE_MOCK=true): index.ts (route + luật), data.ts (seed), sdlcTemplates.ts
  context/      - AuthContext: phiên đăng nhập, user, companies/workspaces, currentCompany, can()
  lib/          - apiClient (axios + tự refresh token khi 401), apiErrors (map mã lỗi → thông báo), permissions,
                  slug (mã workspace / role / project key), workflowValidation + workflowDraft (luật & nháp workflow),
                  useAsync, format, storage, passwordStrength
  types/        - auth.ts, rbac.ts, project.ts — khớp 1-1 với DTO trong contract
  components/
    ui/         - Button, TextField, TextAreaField, SelectField, Modal, Badge, Avatar, Alert, icons…
    layout/     - DashboardLayout (sidebar + chuyển workspace), PageParts (PageHeader, PageTabs, Card…), AuthCard, ProtectedRoute
  pages/
    auth/       - Register, Login, Verify email, Forgot/Reset password
    onboarding/ - Chọn loại tài khoản, Thiết lập Doanh nghiệp, Domain-match, Chờ duyệt, Tạo workspace
    invite/     - Chấp nhận lời mời qua email
    dashboard/  - Tổng quan, Mời thành viên
    workspaces/ - Danh sách + modal tạo, layout chi tiết và các tab
    projects/   - wizard/ (3 bước), layout dự án và các tab, PhaseWorkflowEditor (dùng chung wizard & tab Workflow)
    admin/      - Role & Phân quyền, Người dùng công ty
```

## Chưa làm

- Đăng nhập GitHub / SAML SSO — nút hiện nhưng chưa gọi API thật.
- Dashboard số liệu thật; module Issue / Kanban, Tài liệu yêu cầu, Testcase, Traceability.
- Màn nhận lời mời vào dự án (Figma hàng 2 frame 05) — hiện thêm thẳng thành viên.
- Dự án trong workspace cá nhân (role dự án định nghĩa ở cấp công ty).
- Duyệt join-request, vô hiệu hoá / import người dùng, Audit log, Direct Grant (Figma E/G).
