import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Trung tính ẤM (stone) thay cho gray lạnh mặc định của Tailwind: toàn bộ class `gray-*` hiện có
        // trong app tự đổi theo, không phải sửa từng file. Nền giấy + xanh thương hiệu là cặp màu duy nhất
        // trên trang, xanh chỉ dùng cho "liên kết / đã kiểm chứng / hành động chính".
        gray: colors.stone,
        paper: '#faf9f6',
        brand: {
          50: '#ecfdf3',
          100: '#d1fae0',
          200: '#a7f3c9',
          300: '#6ee7ab',
          400: '#34d485',
          500: '#12b76a',
          600: '#079455',
          700: '#067647',
          800: '#085d3a',
          900: '#074d31',
          950: '#03301f',
        },
      },
      fontFamily: {
        // Dùng chung 1 font duy nhất — Be Vietnam Pro — cho cả `font-sans` và `font-mono`. Trước đây
        // `font-mono` trỏ IBM Plex Mono cho nhãn eyebrow/mã REQ-TC, nhưng muốn đồng bộ 1 font xuyên suốt
        // thì đổi ở đây là đủ, không cần sửa từng chỗ dùng class `font-mono` trong toàn bộ app.
        sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgb(245 158 11 / 0.45)' },
          '100%': { boxShadow: '0 0 0 8px rgb(245 158 11 / 0)' },
        },
        'draw-x': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      animation: {
        blink: 'blink 1.1s steps(2, start) infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'draw-x': 'draw-x 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
