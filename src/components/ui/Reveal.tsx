import { createElement, type ReactNode } from 'react'
import clsx from 'clsx'
import { useInView } from '@/lib/useInView'

type RevealTag = 'div' | 'li' | 'article' | 'section'

// Fade-in nhẹ khi cuộn tới. Tôn trọng prefers-reduced-motion (hiện ngay, không dịch chuyển).
// `as="li"` để dùng được trong <ol>/<ul> mà không chèn <div> sai ngữ nghĩa.
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: RevealTag
}) {
  const { ref, isInView } = useInView<HTMLElement>()

  return createElement(
    as,
    {
      ref,
      className: clsx(
        'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
        isInView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        'motion-reduce:translate-y-0 motion-reduce:opacity-100',
        className,
      ),
      style: { transitionDelay: `${delay}ms` },
    },
    children,
  )
}
