import { ImageResponse } from 'next/og'

/**
 * Favicon, generated at build time from the brand mark.
 *
 * Generated rather than a static .ico so it stays in sync with the logo in
 * `components/brand/logo.tsx` — the same two paths, redrawn at 32px.
 */

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D100C',
          borderRadius: 7,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 20.5L13.5 12.5L17.5 17.5L24 9"
            stroke="#B8FF00"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="9" r="3" fill="#B8FF00" />
        </svg>
      </div>
    ),
    size,
  )
}
