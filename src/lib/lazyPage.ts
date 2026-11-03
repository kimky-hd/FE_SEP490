import { lazy, type ComponentType } from 'react'

export function lazyPage<M extends Record<K, ComponentType>, K extends keyof M & string>(
  load: () => Promise<M>,
  name: K,
) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}
