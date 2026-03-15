const BASE = 'http://localhost:3500';

async function test() {
  console.log('=== Testing Fake Zoho v2 Endpoints ===\n');

  // 1. OAuth2
  console.log('1. OAuth2 Token:');
  let r = await fetch(`${BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&client_id=test&client_secret=test&refresh_token=test'
  });
  let d = await r.json();
  console.log('   ', d.access_token ? 'OK' : 'FAIL', d);

  // 2. Webhook registration
  console.log('\n2. Webhook Register:');
  r = await fetch(`${BASE}/api/v3/portal/8060001/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://httpbin.org/post', events: ['project.updated'] })
  });
  d = await r.json();
  console.log('   ', d.webhook ? 'OK' : 'FAIL', JSON.stringify(d).slice(0, 120));

  // 3. List webhooks
  console.log('\n3. Webhook List:');
  r = await fetch(`${BASE}/api/v3/portal/8060001/webhooks`);
  d = await r.json();
  console.log('   ', d.webhooks?.length >= 0 ? 'OK' : 'FAIL', `${d.webhooks?.length} webhooks`);

  // 4. Admin update project
  console.log('\n4. Admin Update Project:');
  r = await fetch(`${BASE}/admin/projects/FZP-2001`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ custom_status: 'puesta_en_marcha', project_percent: '75' })
  });
  d = await r.json();
  console.log('   ', d.success ? 'OK' : 'FAIL', `webhooks_dispatched: ${d.webhooks_dispatched}`);

  // 5. Pagination
  console.log('\n5. Pagination (range=3, index=0):');
  r = await fetch(`${BASE}/api/v3/portal/8060001/projects?range=3&index=0`);
  d = await r.json();
  console.log('   ', d.page_info ? 'OK' : 'FAIL', `projects: ${d.projects?.length}, has_more: ${d.page_info?.has_more}`);

  // 6. Rate limit headers
  console.log('\n6. Rate Limit Headers:');
  r = await fetch(`${BASE}/health`);
  console.log('   ', r.headers.get('x-ratelimit-limit') ? 'OK' : 'FAIL',
    `Limit: ${r.headers.get('x-ratelimit-limit')}, Remaining: ${r.headers.get('x-ratelimit-remaining')}`);

  // 7. Admin info
  console.log('\n7. Admin Info:');
  r = await fetch(`${BASE}/admin/info`);
  d = await r.json();
  console.log('   ', d.version ? 'OK' : 'FAIL', `${d.name} v${d.version}`);

  // 8. Health
  console.log('\n8. Health:');
  r = await fetch(`${BASE}/health`);
  d = await r.json();
  console.log('   ', d.status, `DB: ${d.database?.connected}, Projects: ${d.database?.projectCount}`);

  // 9. Projects with filter
  console.log('\n9. Projects filter (group=VRAF):');
  r = await fetch(`${BASE}/api/v3/portal/8060001/projects?group=VRAF`);
  d = await r.json();
  console.log('   ', d.projects?.length === 4 ? 'OK' : 'FAIL', `${d.projects?.length} VRAF projects`);

  // 10. Admin webhook test
  console.log('\n10. Admin Webhook Test:');
  r = await fetch(`${BASE}/admin/webhooks/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'project.updated', project_id: 'FZP-2001' })
  });
  d = await r.json();
  console.log('   ', d.success ? 'OK' : 'FAIL', `dispatched: ${d.dispatched_to}`);

  console.log('\n=== All tests complete ===');
}

test().catch(console.error);
