import { notFound, ok, withErrorHandling } from '@/lib/server/api'
import { revokeAssignment } from '@/lib/server/deposit-addresses'
import { requireAdmin } from '@/lib/server/guard'
import { getRequestContext } from '@/lib/server/session'

/**
 * DELETE — stop showing an address to a user.
 *
 * The row is marked revoked, never deleted. If funds arrive at that destination
 * afterwards — and they will, because people save addresses — the record of
 * who was told to use it is the only way to attribute the deposit.
 */
export const DELETE = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    const { id } = await params
    const revoked = await revokeAssignment(id, {
      id: guard.user.id,
      context: await getRequestContext(),
    })

    if (!revoked) return notFound('No active assignment with that id.')

    return ok({
      id,
      revoked: true,
      message:
        'The user can no longer see that address. They cannot deposit this asset until another is assigned.',
    })
  },
)
