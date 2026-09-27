'use client'

import { AdminNotice } from '@/components/admin/admin-notice'
import { AdminShell } from '@/components/admin/admin-shell'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { PendingInfo } from '@/components/ui/demo-notice'
import { Checkbox, Input, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { brand, companyInfo, platform } from '@/lib/config'

export default function AdminSettingsPage() {
  const { toast } = useToast()

  function notifyReadOnly(event: React.FormEvent) {
    event.preventDefault()
    toast({
      tone: 'warn',
      title: 'Not saved',
      description: 'Settings need a backend. Nothing is persisted in this build.',
    })
  }

  return (
    <AdminShell data="mock" title="Settings" description="Platform, company and compliance configuration">
      <div className="space-y-6">
        <AdminNotice />

        <Card>
          <CardHeader>
            <CardTitle>Brand</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={notifyReadOnly} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Platform name" defaultValue={brand.name} />
                <Input label="Wordmark" defaultValue={brand.wordmark} />
              </div>
              <Input label="Tagline" defaultValue={brand.tagline} />
              <Textarea label="Description" defaultValue={brand.description} />
              <p className="text-xs leading-relaxed text-muted">
                In this build these values live in{' '}
                <code className="text-white/80">lib/config.ts</code>. Editing that one file
                rebrands the entire product.
              </p>
              <Button type="submit" size="sm">
                Save brand
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Company and regulatory information</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Published in the footer, About page and legal documents
              </p>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={notifyReadOnly} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Legal entity name" defaultValue={companyInfo.legalName} placeholder="Not set" />
                <Input
                  label="Registration number"
                  defaultValue={companyInfo.registrationNumber}
                  placeholder="Not set"
                />
              </div>
              <Input
                label="Registered address"
                defaultValue={companyInfo.registeredAddress}
                placeholder="Not set"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Jurisdiction"
                  defaultValue={companyInfo.jurisdiction}
                  placeholder="Not set"
                />
                <Input
                  label="Support hours"
                  defaultValue={companyInfo.supportHours}
                  placeholder="Not set"
                />
              </div>
              <Textarea
                label="Regulatory status"
                defaultValue={companyInfo.regulatoryStatus}
                placeholder="Not set"
                hint="Name the regulator and the reference number so a visitor can verify it on the regulator's own register. Leave empty if there is no authorisation — an empty field is published as 'no regulatory claim', which is accurate."
              />

              <div className="rounded-xl border border-negative/25 bg-negative/[0.06] p-4 text-sm leading-relaxed text-white/75">
                <p className="font-medium text-negative">Do not enter anything unverified here</p>
                <p className="mt-1.5">
                  A licence number, registration or approval published without a matching entry on
                  the regulator's register is a false statement to every visitor who reads it, and
                  an offence in most jurisdictions. Verify before you type.
                </p>
              </div>

              <Button type="submit" size="sm">
                Save company information
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform mode</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-base-800 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Demo mode</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Currently{' '}
                    <span className={platform.demoMode ? 'text-warn' : 'text-positive'}>
                      {platform.demoMode ? 'on' : 'off'}
                    </span>
                    . While on, every value-moving action is refused and the demonstration banner is
                    shown site-wide. Controlled by{' '}
                    <code className="text-white/80">NEXT_PUBLIC_DEMO_MODE</code>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-base-800 p-4">
                <p className="text-sm font-medium text-white">Backend endpoints</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">API base URL</dt>
                    <dd className="num text-white/90">
                      {platform.apiBaseUrl || 'Not configured — using mock data'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">Live market data</dt>
                    <dd className="num text-white/90">
                      {platform.liveMarketData ? 'Enabled' : 'Off — using mock feed'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">Custody</dt>
                    <dd className="num text-white/90">
                      {platform.custodyEnabled ? 'Enabled' : 'Off — deposits unavailable'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-muted">Trading</dt>
                    <dd className="num text-white/90">
                      {platform.tradingEnabled ? 'Enabled' : 'Off — orders unavailable'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance checklist</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-relaxed text-muted">
              Items that must be completed before this platform accepts a single real customer.
              These checkboxes are indicators, not controls.
            </p>
            <div className="mt-5 space-y-3">
              {[
                'Legal entity incorporated and company details published',
                'Regulatory position assessed in every jurisdiction served',
                'Terms, privacy policy and risk disclosure reviewed by a qualified lawyer',
                'AML/KYC programme and sanctions screening in place',
                'Custody arrangements agreed and documented',
                'Fee schedule finalised and published',
                'Complaints procedure and dispute resolution published',
                'Independent security assessment completed',
                'Admin access placed behind server-side authorisation',
              ].map((item) => (
                <Checkbox key={item} label={item} disabled />
              ))}
            </div>
            <div className="mt-5">
              <PendingInfo label="All items above" />
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  )
}
