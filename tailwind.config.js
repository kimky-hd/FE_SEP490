/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Trung tính lạnh (slate-xanh nhẹ) cho toàn bộ `gray-*`. Chữ phụ dùng gray-500 trở lên (≥ 4.5:1 trên trắng).
        gray: {
          25: '#fcfcfd',
          50: '#f9fafb',
          100: '#f2f4f7',
          200: '#e4e7ec',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
          950: '#0c111d',
        },
        // Nền khung app (sidebar nằm trên nền này, nội dung là tấm trắng tách riêng).
        paper: '#f2f4f7',
        // Xanh dương thương hiệu: nút chính, liên kết, mục đang chọn.
        brand: {
          50: '#eef2ff',
          100: '#dfe6ff',
          200: '#c7d4fe',
          300: '#a3b8fd',
          400: '#7591f8',
          500: '#4f6ff1',
          600: '#2f5bea',
          700: '#2549c7',
          800: '#1c3aa8',
          900: '#1b3384',
          950: '#131f4f',
        },
        // Trạng thái "ổn / đã liên kết / hoạt động".
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          200: '#abefc6',
          500: '#12b76a',
          600: '#079455',
          700: '#067647',
          800: '#05603a',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        control: '8px',
        chip: '6px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(16,24,40,.05)',
        pop: '0 12px 24px -6px rgba(16,24,40,.14), 0 4px 8px -4px rgba(16,24,40,.06)',
        float: '0 24px 48px -12px rgba(16,24,40,.18)',
      },
    },
  },
  plugins: [],
}
