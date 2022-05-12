import * as Sentry from "@sentry/browser"
import { BrowserTracing } from "@sentry/tracing"

Sentry.init({
  dsn: "https://308df0f35e9b4edb9c67119a298e99f0@o820541.ingest.sentry.io/6397709",
  integrations: [new BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
})