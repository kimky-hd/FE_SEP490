import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";

/** Origin của API (vd `http://localhost:5158`) lấy từ VITE_API_BASE_URL; URL hỏng/trống thì bỏ qua. */
function apiOrigin(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl) return null;
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy cho bản build (giá trị theo doc/Security-BE-Requirements.md §BE-08).
 * Chỉ gồm các directive dùng được qua <meta>: `frame-ancestors`, HSTS và các header khác phải đặt ở
 * reverse proxy — xem deploy/nginx.conf. Giữ đồng bộ chuỗi này với file nginx khi đổi.
 */
export function buildCsp(apiBaseUrl: string | undefined): string {
  const api = apiOrigin(apiBaseUrl);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Google Identity Services (nút "Đăng nhập với Google") nạp script từ accounts.google.com/gsi/client.
    "script-src": ["'self'", "https://accounts.google.com/gsi/client"],
    // 'unsafe-inline': React style={...}, TipTap và SVG mermaid đều dùng style inline.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'", ...(api ? [api] : []), "https://accounts.google.com"],
    "frame-src": ["https://accounts.google.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

function vendorChunk(id: string): string | undefined {
  const file = id.replace(/\\/g, "/");
  if (!file.includes("/node_modules/")) return undefined;
  if (/\/node_modules\/(@tiptap|prosemirror-[^/]+|linkifyjs|orderedmap|rope-sequence|w3c-keyname)\//.test(file))
    return "vendor-editor";
  if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler)\//.test(file))
    return "vendor-react";
  return undefined;
}

/** Chèn CSP meta khi build production. Dev server không áp (HMR cần ws: và script inline). */
function cspMetaPlugin(apiBaseUrl: string | undefined): Plugin {
  return {
    name: "ssam-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: buildCsp(apiBaseUrl) },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Dev server mặc định chỉ nghe 127.0.0.1 (IPv4 loopback, không lộ ra LAN). Cần mở ra LAN/tunnel thì chạy `npm run dev -- --host`
  // hoặc đặt VITE_DEV_HOST (vd 0.0.0.0) trong .env; host lạ (tunnel) liệt kê ở VITE_DEV_ALLOWED_HOSTS.
  const allowedHosts = (env.VITE_DEV_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    plugins: [
      react(),
      cspMetaPlugin(env.VITE_API_BASE_URL),
      mode === "analyze" && visualizer({ filename: "stats.html", gzipSize: true, open: false }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: "src/main/webapp",
      emptyOutDir: false,
      rollupOptions: {
        output: { manualChunks: vendorChunk },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      host: env.VITE_DEV_HOST || "127.0.0.1",
      ...(allowedHosts.length ? { allowedHosts } : {}),
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      // .kilo/worktrees/** chứa bản sao git worktree của công cụ Kilo Code (không phải của repo này) —
      // loại khỏi phạm vi quét test, không thì vitest chạy nhầm cả bản cũ bên trong và báo fail giả.
      exclude: ["**/node_modules/**", "**/dist/**", "**/.kilo/**"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts", "src/api/mock/documentSeed.ts"],
        reporter: ["text-summary", "html"],
        // Mốc sàn chặn tụt độ phủ; nâng dần khi thêm test.
        thresholds: { lines: 22, functions: 42, branches: 75, statements: 22 },
      },
    },
  };
});
