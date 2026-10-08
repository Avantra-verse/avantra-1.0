// Error alerts (Sentry). Off unless SENTRY_DSN is set. Only unexpected errors (5xx) are reported, without
// request bodies or cookies (sendDefaultPii stays off: the users are minors).
import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0 });
