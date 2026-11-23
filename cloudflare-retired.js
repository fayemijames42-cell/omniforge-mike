// Retain the two existing namespaces during retirement without opening their storage.
function retired() {
  return new Response('OMNIFORGE has moved offline.', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default { fetch: retired };
export class DailyBudget { fetch() { return retired(); } }
export class MikeeCoordinator { fetch() { return retired(); } }
