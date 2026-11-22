import type { ReactNode } from 'react'

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="classical-panel rounded-md px-6 py-12 text-center">
      <h2 className="font-serif text-3xl">{title}</h2>
      <div className="mx-auto mt-3 max-w-xl text-sm leading-6 text-graphite">{children}</div>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  )
}
