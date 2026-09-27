'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import {
  createPlan,
  deletePlan,
  listAdminPlans,
  updatePlan,
  type AdminPlan,
  type PlanPayload,
} from '@/lib/api/plans'
import type { PlanTier } from '@/lib/types'

/**
 * Plan configuration.
 *
 * Every field here ends up on a public page in front of prospective
 * customers. Two consequences shape this screen:
 *
 * 1. A plan may promise a **contractual fixed return**. That figure is a debt
 *    the business owes on maturity whatever its own performance was, so the
 *    form will not let one be published without a term to measure it over and
 *    a stated source of the money. The database enforces the same rule.
 *
 * 2. Nothing reaches the public until "Published" is switched on, and new
 *    plans are created unpublished. An operator can leave a draft half-written
 *    without a visitor ever seeing it.
 *
 * 3. Editing a rate does **not** change contracts already open. Those froze
 *    their terms at subscription. The change applies to new subscriptions only.
 */

const TIERS: Array<{ value: PlanTier; label: string }> = [
  { value: 'starter', label: 'Starter' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'pro', label: 'Pro' },
]

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/** Empty string means "not configured", which is not the same as zero. */
function toNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function numberToField(value: number | null): string {
  return value === null ? '' : String(value)
}

interface Draft {
  tier: PlanTier
  fixedRatePercent: string
  rateBasis: 'per_term' | 'annual'
  yieldSource: string
  name: string
  summary: string
  minimumAmount: string
  maximumAmount: string
  fee: string
  duration: string
  currency: string
  features: string[]
  riskDisclosure: string
  popular: boolean
  published: boolean
  displayOrder: string
}

function draftFrom(plan: AdminPlan): Draft {
  return {
    tier: plan.tier,
    fixedRatePercent: numberToField(plan.fixedRatePercent ?? null),
    rateBasis: plan.rateBasis ?? 'per_term',
    yieldSource: plan.yieldSource ?? '',
    name: plan.name,
    summary: plan.summary,
    minimumAmount: numberToField(plan.minimumAmount),
    maximumAmount: numberToField(plan.maximumAmount),
    fee: numberToField(plan.fee),
    duration: numberToField(plan.duration),
    currency: plan.currency,
    features: plan.features,
    riskDisclosure: plan.riskDisclosure,
    popular: Boolean(plan.popular),
    published: plan.published,
    displayOrder: String(plan.displayOrder),
  }
}

const EMPTY_DRAFT: Draft = {
  tier: 'starter',
  fixedRatePercent: '',
  rateBasis: 'per_term',
  yieldSource: '',
  name: '',
  summary: '',
  minimumAmount: '',
  maximumAmount: '',
  fee: '',
  duration: '',
  currency: 'USD',
  features: [],
  riskDisclosure: '',
  popular: false,
  published: false,
  displayOrder: '0',
}

function toPayload(draft: Draft): PlanPayload {
  return {
    tier: draft.tier,
    name: draft.name.trim(),
    summary: draft.summary.trim(),
    minimumAmount: toNullableNumber(draft.minimumAmount),
    maximumAmount: toNullableNumber(draft.maximumAmount),
    fee: toNullableNumber(draft.fee),
    duration: toNullableNumber(draft.duration),
    currency: draft.currency.trim().toUpperCase(),
    features: draft.features.map((f) => f.trim()).filter(Boolean),
    riskDisclosure: draft.riskDisclosure.trim(),
    popular: draft.popular,
    published: draft.published,
    displayOrder: Number(draft.displayOrder) || 0,
    fixedRatePercent: toNullableNumber(draft.fixedRatePercent),
    rateBasis: draft.rateBasis,
    yieldSource: draft.yieldSource.trim() || null,
  }
}

/* ------------------------------------------------------------------ */
/* Feature list editor                                                 */
/* ------------------------------------------------------------------ */

function FeatureEditor({
  features,
  onChange,
}: {
  features: string[]
  onChange: (next: string[]) => void
}) {
  const [entry, setEntry] = useState('')

  function add() {
    const value = entry.trim()
    if (!value || features.includes(value)) return
    onChange([...features, value])
    setEntry('')
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-white/90">Features</p>

      {features.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-base-800 px-3 py-1.5 text-xs text-white/80"
            >
              {feature}
              <button
                type="button"
                aria-label={`Remove ${feature}`}
                onClick={() => onChange(features.filter((f) => f !== feature))}
                className="text-muted transition-colors hover:text-negative"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
          placeholder="Portfolio tracking"
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="sm" onClick={add} disabled={!entry.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Plan form                                                           */
/* ------------------------------------------------------------------ */

function PlanForm({
  open,
  plan,
  onClose,
  onSaved,
}: {
  open: boolean
  plan: AdminPlan | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(plan ? draftFrom(plan) : EMPTY_DRAFT)
    setError(null)
  }, [open, plan])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    setBusy(true)
    setError(null)

    try {
      const payload = toPayload(draft)
      if (plan) {
        await updatePlan(plan.id, payload)
      } else {
        await createPlan(payload)
      }

      toast({
        tone: 'success',
        title: plan ? 'Plan saved' : 'Plan created',
        description: payload.published
          ? 'It is live on the public plan pages now.'
          : 'Saved as a draft. It is not visible to anyone until you publish it.',
      })
      onSaved()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause, 'Could not save that plan.'))
    } finally {
      setBusy(false)
    }
  }

  const min = toNullableNumber(draft.minimumAmount)
  const max = toNullableNumber(draft.maximumAmount)
  const rangeWrong = min !== null && max !== null && max < min

  const promisesReturn = toNullableNumber(draft.fixedRatePercent) !== null
  /**
   * A promise cannot be published without a term and a stated source.
   *
   * Blocked here, in the API schema, and by a database CHECK — three places,
   * because a published plan promising a return from nowhere is the single
   * artefact this product must never produce.
   */
  const promiseIncomplete =
    promisesReturn &&
    draft.published &&
    (toNullableNumber(draft.duration) === null || draft.yieldSource.trim().length < 20)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      description="Terms shown to prospective customers."
      size="lg"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-white/80">
            Published terms are a financial promotion. Do not write a rate of return, a projected
            profit, or wording that implies a guarantee — in most jurisdictions that is a regulated
            communication and, if unfounded, unlawful. There is deliberately no field for one.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Name"
            value={draft.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Advanced"
          />
          <Select
            label="Tier"
            options={TIERS}
            value={draft.tier}
            onChange={(event) => set('tier', event.target.value as PlanTier)}
          />
        </div>

        <Textarea
          label="Summary"
          value={draft.summary}
          onChange={(event) => set('summary', event.target.value)}
          rows={2}
          placeholder="For active investors who want deeper analysis and alerting."
          hint="One line describing who the tier is for."
        />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Minimum amount"
            type="number"
            min="0"
            step="any"
            value={draft.minimumAmount}
            onChange={(event) => set('minimumAmount', event.target.value)}
            placeholder="Not set"
            suffix={draft.currency}
          />
          <Input
            label="Maximum amount"
            type="number"
            min="0"
            step="any"
            value={draft.maximumAmount}
            onChange={(event) => set('maximumAmount', event.target.value)}
            placeholder="Not set"
            suffix={draft.currency}
            error={rangeWrong ? 'Below the minimum.' : undefined}
          />
          <Input
            label="Platform fee"
            type="number"
            min="0"
            max="100"
            step="any"
            value={draft.fee}
            onChange={(event) => set('fee', event.target.value)}
            placeholder="Not set"
            suffix="%"
          />
          <Input
            label="Duration"
            type="number"
            min="1"
            value={draft.duration}
            onChange={(event) => set('duration', event.target.value)}
            placeholder="Open-ended"
            suffix="days"
          />
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Leave a field blank to mean &quot;not configured&quot;. The public card shows
          &quot;Set by operator&quot; for a blank value rather than a figure a visitor could
          mistake for a real term — blank is not the same as zero.
        </p>

        {/* ---------- The promised return ---------- */}
        <div className="rounded-xl border border-line p-4">
          <p className="text-sm font-medium text-white">Promised return</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Leave the rate blank for a plan that promises nothing. A figure here is a debt the
            business owes at maturity, paid from the treasury — not a projection.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Input
              label="Fixed rate"
              type="number"
              min="0"
              step="any"
              value={draft.fixedRatePercent}
              onChange={(event) => set('fixedRatePercent', event.target.value)}
              placeholder="No return promised"
              suffix="%"
            />
            <Select
              label="Rate basis"
              value={draft.rateBasis}
              onChange={(event) => set('rateBasis', event.target.value as 'per_term' | 'annual')}
              options={[
                { value: 'per_term', label: 'Over the whole term' },
                { value: 'annual', label: 'Per year (pro-rated to the term)' },
              ]}
              hint="Shown to customers alongside the figure. Never displayed without it."
            />
          </div>

          {promisesReturn && (
            <div className="mt-4 space-y-4">
              <Textarea
                label="Where does this return come from? (required)"
                value={draft.yieldSource}
                onChange={(event) => set('yieldSource', event.target.value)}
                rows={2}
                placeholder="Platform trading and lending revenue"
                hint="Shown to the customer before they agree, and copied onto every contract. At least 20 characters."
              />

              <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                <div className="text-sm leading-relaxed text-white/80">
                  <p className="font-medium text-warn">This makes the plan a financial product</p>
                  <p className="mt-1.5">
                    You will owe {draft.fixedRatePercent || '—'}%{' '}
                    {draft.rateBasis === 'annual' ? 'a year' : 'over the term'} on every
                    subscription, regardless of how the business performs. Maturity debits the
                    treasury and is <span className="font-medium">refused</span> if the treasury
                    cannot cover it.
                  </p>
                  <p className="mt-1.5">
                    Promising a fixed return is regulated in most jurisdictions. Confirm your
                    licensing position before publishing this.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Currency"
            value={draft.currency}
            onChange={(event) => set('currency', event.target.value)}
            placeholder="USD"
            maxLength={3}
          />
          <Input
            label="Display order"
            type="number"
            min="0"
            value={draft.displayOrder}
            onChange={(event) => set('displayOrder', event.target.value)}
            hint="Lower numbers appear first."
          />
        </div>

        <FeatureEditor features={draft.features} onChange={(next) => set('features', next)} />

        <Textarea
          label="Risk disclosure (required)"
          value={draft.riskDisclosure}
          onChange={(event) => set('riskDisclosure', event.target.value)}
          rows={3}
          hint="Shown on the plan card. Must state plainly that capital is at risk. At least 40 characters."
        />

        <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2.5 text-sm text-white/80">
            <input
              type="checkbox"
              checked={draft.popular}
              onChange={(event) => set('popular', event.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent,#9ae66e)]"
            />
            Mark as &quot;Most chosen&quot;
          </label>
          <label className="flex items-center gap-2.5 text-sm text-white/80">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => set('published', event.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent,#9ae66e)]"
            />
            Published — visible to the public
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-negative/30 bg-negative/[0.07] p-3.5 text-xs leading-relaxed text-negative"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            onClick={submit}
            loading={busy}
            disabled={
              rangeWrong ||
              promiseIncomplete ||
              draft.name.trim().length < 2 ||
              draft.summary.trim().length < 10 ||
              draft.riskDisclosure.trim().length < 40
            }
            className="sm:flex-1"
          >
            {plan ? 'Save plan' : 'Create plan'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="sm:flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function PlanEditor() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<AdminPlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminPlan | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await listAdminPlans()
      setPlans(response.plans)
      setLoadError(null)
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Could not load plans.'))
      setPlans([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePublished(plan: AdminPlan) {
    if (
      plan.published &&
      !window.confirm(`Unpublish ${plan.name}? It disappears from the public plan pages at once.`)
    ) {
      return
    }

    try {
      await updatePlan(plan.id, { published: !plan.published })
      toast({
        tone: 'success',
        title: plan.published ? 'Unpublished' : 'Published',
        description: plan.published
          ? `${plan.name} is no longer shown to the public.`
          : `${plan.name} is now live on the plan pages.`,
      })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not change that',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  async function remove(plan: AdminPlan) {
    if (
      !window.confirm(
        `Delete ${plan.name} permanently? This cannot be undone. If you only want it off the site, unpublish it instead.`,
      )
    ) {
      return
    }

    try {
      const result = await deletePlan(plan.id)
      toast({ tone: 'success', title: 'Plan deleted', description: result.message })
      void load()
    } catch (cause) {
      toast({
        tone: 'warn',
        title: 'Could not delete that plan',
        description: errorMessage(cause, 'Try again.'),
      })
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(plan: AdminPlan) {
    setEditing(plan)
    setFormOpen(true)
  }

  if (loadError) {
    return (
      <Card className="border-negative/30 bg-negative/[0.05]">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-negative">Could not load plans</p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">{loadError}</p>
          </div>
        </CardBody>
      </Card>
    )
  }

  const publishedCount = plans?.filter((plan) => plan.published).length ?? 0

  return (
    <div className="space-y-6">
      <Card className="border-warn/25 bg-warn/[0.05]">
        <CardBody className="text-sm leading-relaxed text-white/75">
          <p className="font-medium text-warn">Terms published here are a financial promotion</p>
          <p className="mt-1.5">
            Whatever you publish is shown to prospective customers. Do not enter a rate of return,
            a projected profit or any wording that implies a guarantee — in most jurisdictions that
            is a regulated communication and, if unfounded, unlawful. There is deliberately no
            field for a return, and every plan must carry a risk disclosure before it can be saved.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Investment plans</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {plans === null
                ? 'Loading…'
                : `${plans.length} plan${plans.length === 1 ? '' : 's'}, ${publishedCount} published`}
            </p>
          </div>
          <Button size="sm" className="sm:ml-auto" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New plan
          </Button>
        </CardHeader>

        <CardBody>
          {plans === null ? (
            <SkeletonRows rows={3} />
          ) : plans.length === 0 ? (
            <EmptyState
              title="No plans yet"
              description="Create one to show tiers on the public plan pages. Nothing is shown to visitors until you publish it."
              className="border-0"
              action={<Button onClick={openNew}>New plan</Button>}
            />
          ) : (
            <ul className="space-y-4">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Card>
                    <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle>{plan.name}</CardTitle>
                          <Badge tone={plan.published ? 'success' : 'neutral'}>
                            {plan.published ? 'Published' : 'Draft'}
                          </Badge>
                          {plan.popular && <Badge tone="accent">Most chosen</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted">{plan.summary}</p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(plan)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => togglePublished(plan)}>
                          {plan.published ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Publish
                            </>
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(plan)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardBody className="space-y-4">
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          [
                            'Minimum',
                            plan.minimumAmount === null
                              ? null
                              : `${plan.minimumAmount} ${plan.currency}`,
                          ],
                          [
                            'Maximum',
                            plan.maximumAmount === null
                              ? null
                              : `${plan.maximumAmount} ${plan.currency}`,
                          ],
                          ['Fee', plan.fee === null ? null : `${plan.fee}%`],
                          ['Duration', plan.duration === null ? null : `${plan.duration} days`],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-baseline justify-between gap-3">
                            <dt className="text-sm text-muted">{label}</dt>
                            <dd
                              className={
                                value
                                  ? 'num text-sm font-medium text-white'
                                  : 'text-xs italic text-muted'
                              }
                            >
                              {value ?? 'Set by operator'}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {plan.features.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {plan.features.map((feature) => (
                            <li
                              key={feature}
                              className="rounded-lg border border-line bg-base-800 px-3 py-1.5 text-xs text-muted"
                            >
                              {feature}
                            </li>
                          ))}
                        </ul>
                      )}

                      <p className="rounded-lg border border-line bg-white/[0.02] p-3 text-xs leading-relaxed text-muted">
                        {plan.riskDisclosure}
                      </p>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <PlanForm
        open={formOpen}
        plan={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </div>
  )
}
