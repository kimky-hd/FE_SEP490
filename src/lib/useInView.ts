import { useEffect, useRef, useState } from 'react'

// Hook nhỏ cho hiệu ứng fade-in khi cuộn tới — không cần thêm thư viện animation.
// Chỉ trigger 1 lần (once in view thì thôi theo dõi tiếp, tránh lặp lại khi cuộn qua lại).
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, isInView }
}
