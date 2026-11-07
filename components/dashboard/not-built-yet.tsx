import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * The page for a navigation entry whose feature does not exist yet.
 *
 * States plainly that the feature is not available rather than showing an
 * empty table or a row of zeroes. Those read as "you have nothing here",
 * which is a claim about the customer's account; the truth is a claim about
 * the platform, and the two lead to very different next actions.
 *
 * Every one of these should be deleted as its feature ships — if one of these
 * pages is still here, the feature is not.
 */
export function NotBuiltYet({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-4 sm:p-6">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-2.5">
            <ButtonLink href="/dashboard" size="sm">
              Back to dashboard
            </ButtonLink>
            <ButtonLink href="/dashboard/support" variant="secondary" size="sm">
              Contact support
            </ButtonLink>
          </div>
        }
      />
    </div>
  )
}
