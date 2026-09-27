import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { investmentPlans, type InvestmentPlanRow } from '@/db/schema'
import type { InvestmentPlan, PlanTier } from '@/lib/types'
import { AuditAction, recordAudit } from './audit'
import type { RequestContext } from './session'

/**
 * Investment plan service.
 *
 * Plans are commercial terms shown to prospective customers, so the read path
 * has one rule that the write path exists to protect: `listPublicPlans` never
 * returns an unpublished plan. A half-written set of terms is exactly the kind
 * of thing that should not reach a visitor, and the only way to publish is a
 * deliberate admin action that is audited.
 *
 * Amounts come back from Postgres as strings (`numeric`). They are converted
 * to numbers only at this boundary, for display, and never converted back.
 */

export class PlanError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'duplicate' | 'invalid' | 'in_use',
  ) {
    super(message)
    this.name = 'PlanError'
  }
}

/** Admin view: everything stored, including whether it is live. */
export interface AdminPlan extends InvestmentPlan {
  published: boolean
  displayOrder: number
  updatedAt: string
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function toPublicPlan(row: InvestmentPlanRow): InvestmentPlan {
  return {
    id: row.id,
    tier: row.tier as PlanTier,
    name: row.name,
    summary: row.summary,
    minimumAmount: toNumber(row.minimumAmount),
    maximumAmount: toNumber(row.maximumAmount),
    fee: toNumber(row.feePercent),
    duration: row.durationDays,
    currency: row.currency,
    features: row.features ?? [],
    riskDisclosure: row.riskDisclosure,
    popular: row.popular,
    /**
     * The promised return, or null when the plan promises nothing.
     *
     * `rateBasis` travels with it always. A percentage shown without saying
     * whether it is per-term or annual is ambiguous in the seller's favour.
     */
    fixedRatePercent: toNumber(row.fixedRatePercent),
    rateBasis: row.rateBasis as 'per_term' | 'annual',
    yieldSource: row.yieldSource,
  }
}

function toAdminPlan(row: InvestmentPlanRow): AdminPlan {
  return {
    ...toPublicPlan(row),
    published: row.published,
    displayOrder: row.displayOrder,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Plans a visitor may see.
 *
 * Filtered to published rows in the query itself rather than in the caller, so
 * a new consumer cannot forget the filter and leak a draft.
 */
export async function listPublicPlans(): Promise<InvestmentPlan[]> {
  const rows = await db
    .select()
    .from(investmentPlans)
    .where(eq(investmentPlans.published, true))
    .orderBy(asc(investmentPlans.displayOrder), asc(investmentPlans.name))

  return rows.map(toPublicPlan)
}

export async function getPublicPlan(id: string): Promise<InvestmentPlan | null> {
  const [row] = await db
    .select()
    .from(investmentPlans)
    .where(eq(investmentPlans.id, id))
    .limit(1)

  if (!row || !row.published) return null
  return toPublicPlan(row)
}

export async function listAllPlans(): Promise<AdminPlan[]> {
  const rows = await db
    .select()
    .from(investmentPlans)
    .orderBy(asc(investmentPlans.displayOrder), asc(investmentPlans.name))

  return rows.map(toAdminPlan)
}

export interface PlanInput {
  tier: PlanTier
  name: string
  summary: string
  minimumAmount: number | null
  maximumAmount: number | null
  fee: number | null
  duration: number | null
  currency: string
  features: string[]
  riskDisclosure: string
  popular: boolean
  published: boolean
  displayOrder: number
  fixedRatePercent: number | null
  rateBasis: 'per_term' | 'annual'
  yieldSource: string | null
}

/** Amounts are stored as decimal strings; `numeric` will not take a float. */
function toDecimal(value: number | null | undefined, scale: number): string | null {
  if (value === null || value === undefined) return null
  return value.toFixed(scale)
}

/**
 * Derives a slug from a plan name.
 *
 * Stable ids matter here — an id is what a future subscription row will point
 * at — so it is generated once on create and never recomputed on rename.
 */
function slugFor(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
  return `plan_${base || 'untitled'}`
}

export async function createPlan(
  input: PlanInput,
  actor: { id: string; context?: RequestContext },
): Promise<AdminPlan> {
  const id = slugFor(input.name)

  const [existing] = await db
    .select({ id: investmentPlans.id })
    .from(investmentPlans)
    .where(eq(investmentPlans.id, id))
    .limit(1)

  if (existing) {
    throw new PlanError(`A plan named "${input.name}" already exists.`, 'duplicate')
  }

  const [row] = await db
    .insert(investmentPlans)
    .values({
      id,
      tier: input.tier,
      name: input.name,
      summary: input.summary,
      minimumAmount: toDecimal(input.minimumAmount, 2),
      maximumAmount: toDecimal(input.maximumAmount, 2),
      feePercent: toDecimal(input.fee, 3),
      durationDays: input.duration,
      currency: input.currency,
      features: input.features,
      riskDisclosure: input.riskDisclosure,
      popular: input.popular,
      published: input.published,
      displayOrder: input.displayOrder,
      fixedRatePercent: toDecimal(input.fixedRatePercent, 3),
      rateBasis: input.rateBasis,
      yieldSource: input.yieldSource,
      updatedBy: actor.id,
    })
    .returning()

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.PlanCreated,
    targetType: 'investment_plan',
    targetId: row.id,
    metadata: {
      name: row.name,
      tier: row.tier,
      published: row.published,
      fixedRatePercent: row.fixedRatePercent,
      rateBasis: row.rateBasis,
      yieldSource: row.yieldSource,
    },
    context: actor.context,
  })

  return toAdminPlan(row)
}

/**
 * Updates a plan.
 *
 * The full record is written, including what changed, because these are the
 * terms a customer was shown. If someone later asks "what did the Advanced
 * plan say in March", the audit log is the only thing that can answer.
 */
export async function updatePlan(
  id: string,
  input: Partial<PlanInput>,
  actor: { id: string; context?: RequestContext },
): Promise<AdminPlan> {
  const [before] = await db
    .select()
    .from(investmentPlans)
    .where(eq(investmentPlans.id, id))
    .limit(1)

  if (!before) throw new PlanError('No plan with that id.', 'not_found')

  // Resolved against the stored row so a partial update cannot slip past the
  // range check by sending only one side of the pair.
  const minimum = input.minimumAmount !== undefined ? input.minimumAmount : toNumber(before.minimumAmount)
  const maximum = input.maximumAmount !== undefined ? input.maximumAmount : toNumber(before.maximumAmount)

  if (minimum !== null && maximum !== null && maximum < minimum) {
    throw new PlanError(
      'The maximum cannot be below the minimum — that describes a plan nobody can join.',
      'invalid',
    )
  }

  const [row] = await db
    .update(investmentPlans)
    .set({
      ...(input.tier !== undefined && { tier: input.tier }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.minimumAmount !== undefined && {
        minimumAmount: toDecimal(input.minimumAmount, 2),
      }),
      ...(input.maximumAmount !== undefined && {
        maximumAmount: toDecimal(input.maximumAmount, 2),
      }),
      ...(input.fee !== undefined && { feePercent: toDecimal(input.fee, 3) }),
      ...(input.duration !== undefined && { durationDays: input.duration }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.features !== undefined && { features: input.features }),
      ...(input.riskDisclosure !== undefined && { riskDisclosure: input.riskDisclosure }),
      ...(input.popular !== undefined && { popular: input.popular }),
      ...(input.published !== undefined && { published: input.published }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      ...(input.fixedRatePercent !== undefined && {
        fixedRatePercent: toDecimal(input.fixedRatePercent, 3),
      }),
      ...(input.rateBasis !== undefined && { rateBasis: input.rateBasis }),
      ...(input.yieldSource !== undefined && { yieldSource: input.yieldSource }),
      updatedAt: new Date(),
      updatedBy: actor.id,
    })
    .where(eq(investmentPlans.id, id))
    .returning()

  const changed = Object.keys(input).filter((key) => {
    const field = key as keyof PlanInput
    const previous = toAdminPlan(before)[field as keyof AdminPlan]
    return JSON.stringify(previous) !== JSON.stringify(input[field])
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action:
      input.published !== undefined && input.published !== before.published
        ? input.published
          ? AuditAction.PlanPublished
          : AuditAction.PlanUnpublished
        : AuditAction.PlanUpdated,
    targetType: 'investment_plan',
    targetId: id,
    metadata: {
      name: row.name,
      changed,
      before: {
        minimumAmount: before.minimumAmount,
        maximumAmount: before.maximumAmount,
        feePercent: before.feePercent,
        durationDays: before.durationDays,
        riskDisclosure: before.riskDisclosure,
        published: before.published,
        fixedRatePercent: before.fixedRatePercent,
        rateBasis: before.rateBasis,
        yieldSource: before.yieldSource,
      },
    },
    context: actor.context,
  })

  return toAdminPlan(row)
}

/**
 * Deletes a plan.
 *
 * Hard delete is safe only while nothing references a plan id. Once
 * subscriptions exist this must become an unpublish — deleting terms somebody
 * is currently signed up under destroys the record of what they agreed to.
 */
export async function deletePlan(
  id: string,
  actor: { id: string; context?: RequestContext },
): Promise<boolean> {
  const [row] = await db
    .delete(investmentPlans)
    .where(eq(investmentPlans.id, id))
    .returning()

  if (!row) throw new PlanError('No plan with that id.', 'not_found')

  await recordAudit({
    actorId: actor.id,
    actorRole: 'admin',
    action: AuditAction.PlanDeleted,
    targetType: 'investment_plan',
    targetId: id,
    // The whole row, because after this there is nothing left to look at.
    metadata: {
      name: row.name,
      tier: row.tier,
      minimumAmount: row.minimumAmount,
      maximumAmount: row.maximumAmount,
      feePercent: row.feePercent,
      durationDays: row.durationDays,
      features: row.features,
      riskDisclosure: row.riskDisclosure,
      published: row.published,
      fixedRatePercent: row.fixedRatePercent,
      rateBasis: row.rateBasis,
      yieldSource: row.yieldSource,
    },
    context: actor.context,
  })

  return true
}
