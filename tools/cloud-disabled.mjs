// Deliberately fail closed: billing and Cloudflare deployment must be managed in the Cloudflare dashboard.
console.error('Cloudflare deployment is disabled for OMNIFORGE. Cancel paid Workers under Cloudflare Billing > Subscriptions, then run npm run offline:start locally.');
process.exitCode = 1;
