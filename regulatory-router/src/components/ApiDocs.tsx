'use client'

import Script from 'next/script'
import { useState } from 'react'

/**
 * Scalar renders the OpenAPI document as interactive docs with a request playground.
 * It is loaded from a CDN rather than added as a dependency, and the fallback below
 * stays visible if that load fails, so the page is never blank.
 */
export function ApiDocs({ specUrl }: { specUrl: string }) {
  const [failed, setFailed] = useState(false)

  const configuration = JSON.stringify({
    theme: 'default',
    layout: 'modern',
    hideDownloadButton: false,
    darkMode: false,
    customCss: `
      :root {
        --scalar-color-accent: #1e3a8a;
        --scalar-color-1: #0b1120;
        --scalar-color-2: #4a5670;
        --scalar-border-color: rgba(11, 17, 32, 0.12);
        --scalar-radius: 0.25rem;
        --scalar-radius-lg: 0.25rem;
        --scalar-font: var(--font-inter), Inter, system-ui, sans-serif;
      }
      .scalar-app { font-family: var(--scalar-font); }
    `,
  })

  return (
    <>
      <script id="api-reference" data-url={specUrl} data-configuration={configuration} />
      <Script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
        onError={() => setFailed(true)}
      />

      {failed && (
        <div className="max-w-2xl mx-auto px-6 py-16 text-sm">
          <h2 className="text-lg font-semibold mb-2">Interactive docs could not load</h2>
          <p className="text-ink-soft leading-relaxed">
            The renderer is served from a CDN that appears to be unreachable. The specification
            itself is fine — fetch it directly at{' '}
            <a href={specUrl} className="text-brand hover:underline">
              {specUrl}
            </a>{' '}
            and open it in any OpenAPI viewer.
          </p>
        </div>
      )}
    </>
  )
}
