import { AdminShell } from '@/components/admin/admin-shell'
import { PlanEditor } from '@/components/admin/plan-editor'

/**
 * Plan configuration.
 *
 * This is where commercial terms belong: the public plan pages render whatever
 * an operator publishes here and show "Set by operator" wherever a value is
 * still unset. The risk disclosure is a required field, not an optional one —
 * a plan without a plain statement of its risk cannot be saved at all.
 */
export default function AdminPlansPage() {
  return (
    <AdminShell data="live" title="Investment plans" description="Configure the commercial terms of each tier">
      <PlanEditor />
    </AdminShell>
  )
}
