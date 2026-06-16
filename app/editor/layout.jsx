export const dynamic = 'force-dynamic'

import { prisma } from '../../lib/db'
import EditorNav from '../../components/EditorNav'

export default async function EditorLayout({ children }) {
  const flagCount = await prisma.assessment.count({ where: { reviewStatus: 'FLAGGED' } })
  return (
    <div>
      <EditorNav flagCount={flagCount} />
      {children}
    </div>
  )
}
