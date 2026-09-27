import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      {/* Offsets the fixed navbar */}
      <main id="main" className="flex-1 pt-[72px]">
        {children}
      </main>
      <Footer />
    </div>
  )
}
