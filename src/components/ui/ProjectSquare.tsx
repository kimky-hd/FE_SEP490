import clsx from 'clsx'
import { projectColor, projectInitial } from '@/lib/recentProjects'

/** Ô vuông màu nhận diện dự án (màu cố định theo id). */
export function ProjectSquare({
  projectId,
  name,
  size = 'sm',
  active = false,
}: {
  projectId: number
  name: string
  size?: 'sm' | 'md'
  active?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        backgroundColor: projectColor(projectId),
        boxShadow: active ? '0 0 0 2px #fff, 0 0 0 4px #2f5bea' : undefined,
      }}
      className={clsx(
        'flex shrink-0 items-center justify-center font-bold text-white',
        size === 'sm' ? 'h-[18px] w-[18px] rounded-[5px] text-[10px]' : 'h-6 w-6 rounded-[6px] text-[11px]',
      )}
    >
      {projectInitial(name)}
    </span>
  )
}
