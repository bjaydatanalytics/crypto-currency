import { ImageResponse } from 'next/og'
import { brand } from '@/lib/config'

/**
 * Open Graph / Twitter card image.
 *
 * The root metadata declares `summary_large_image`, so without this file every
 * shared link renders as a blank card. Generated at build time so it tracks the
 * brand config rather than needing a designer round-trip on every rename.
 */

export const alt = `${brand.name} — ${brand.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#050505',
          padding: 72,
          // Matches the lime bloom used behind the hero.
          backgroundImage:
            'radial-gradient(1000px 500px at 75% 0%, rgba(184,255,0,0.16), transparent 70%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
            <rect
              x="0.75"
              y="0.75"
              width="30.5"
              height="30.5"
              rx="9"
              stroke="#B8FF00"
              strokeOpacity="0.4"
              strokeWidth="1.5"
            />
            <path
              d="M8 20.5L13.5 12.5L17.5 17.5L24 9"
              stroke="#B8FF00"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="24" cy="9" r="2.4" fill="#B8FF00" />
          </svg>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 9,
              color: '#FFFFFF',
            }}
          >
            {brand.wordmark}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 66,
              fontWeight: 600,
              color: '#FFFFFF',
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 940,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            Build your future with&nbsp;
            <span style={{ color: '#B8FF00' }}>smarter digital asset</span>
            &nbsp;investing
          </div>
          <div style={{ fontSize: 26, color: '#8C9188', marginTop: 26, maxWidth: 860 }}>
            Market data, portfolio tools and digital asset services in one platform.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 19,
            color: '#8C9188',
            borderTop: '1px solid rgba(255,255,255,0.10)',
            paddingTop: 26,
          }}
        >
          {/* Risk warning travels with the shared card, not just the page. */}
          <span>Capital at risk · Digital assets are volatile · No guaranteed returns</span>
        </div>
      </div>
    ),
    size,
  )
}
