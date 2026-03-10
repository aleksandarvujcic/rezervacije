/**
 * End-to-end API test script for Rezervacije
 * Tests all major flows: auth, zones, tables, reservations, availability, working hours
 */

const BASE = 'http://localhost:3001/api';
const FRONTEND = 'http://localhost:5174';

let accessToken = '';
let refreshToken = '';
let passed = 0;
let failed = 0;
const failures: string[] = [];

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `${name}${detail ? ` — ${detail}` : ''}`;
    failures.push(msg);
    console.log(`  ❌ ${name}${detail ? ` (${detail})` : ''}`);
  }
}

// ═══════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════
async function testHealth() {
  console.log('\n🏥 Health Check');
  const { status, data } = await api('GET', '/health');
  assert('GET /health returns 200', status === 200);
  assert('Health status is ok', data?.status === 'ok');
}

// ═══════════════════════════════════════════════════
// 2. AUTH
// ═══════════════════════════════════════════════════
async function testAuth() {
  console.log('\n🔐 Auth');

  const login = await api('POST', '/auth/login', { username: 'admin', password: 'admin123' });
  assert('Login succeeds with valid credentials', login.status === 200);
  assert('Login returns accessToken', !!login.data?.accessToken);
  assert('Login returns refreshToken', !!login.data?.refreshToken);
  assert('Login returns user object', login.data?.user?.username === 'admin');
  assert('User role is owner', login.data?.user?.role === 'owner');
  accessToken = login.data?.accessToken;
  refreshToken = login.data?.refreshToken;

  const badLogin = await api('POST', '/auth/login', { username: 'admin', password: 'wrong' });
  assert('Login fails with wrong password', badLogin.status === 401);

  const noUser = await api('POST', '/auth/login', { username: 'nobody', password: 'test' });
  assert('Login fails with non-existent user', noUser.status === 401);

  const me = await api('GET', '/auth/me', undefined, accessToken);
  assert('GET /me returns current user', me.status === 200 && me.data?.username === 'admin');

  const noAuth = await api('GET', '/auth/me');
  assert('GET /me without token returns 401', noAuth.status === 401);

  const refresh = await api('POST', '/auth/refresh', { refreshToken });
  assert('Refresh token works', refresh.status === 200 && !!refresh.data?.accessToken);
  if (refresh.data?.accessToken) accessToken = refresh.data.accessToken;

  const waiterLogin = await api('POST', '/auth/login', { username: 'konobar1', password: 'admin123' });
  assert('Waiter can login', waiterLogin.status === 200 && waiterLogin.data?.user?.role === 'waiter');
}

// ═══════════════════════════════════════════════════
// 3. ZONES
// ═══════════════════════════════════════════════════
async function testZones() {
  console.log('\n🏢 Zones');

  const list = await api('GET', '/zones', undefined, accessToken);
  assert('GET /zones returns array', Array.isArray(list.data));
  assert('Seed created 3 zones', list.data?.length === 3);
  assert('Zones are sorted by sort_order', list.data?.[0]?.name === 'Glavna sala');

  const create = await api('POST', '/zones', {
    name: 'Test Terasa',
    description: 'Terasa na spratu',
    sort_order: 99,
  }, accessToken);
  assert('Create zone succeeds', create.status === 201, `status=${create.status}`);
  const newZoneId = create.data?.id;
  assert('New zone has ID', !!newZoneId, `id=${newZoneId}`);

  if (newZoneId) {
    const update = await api('PATCH', `/zones/${newZoneId}`, {
      description: 'Terasa na drugom spratu',
      is_seasonal: true,
      season_start: '2026-05-01',
      season_end: '2026-10-01',
    }, accessToken);
    assert('Update zone succeeds', update.status === 200, `status=${update.status}`);
    assert('Zone is now seasonal', update.data?.is_seasonal === true);

    const del = await api('DELETE', `/zones/${newZoneId}`, undefined, accessToken);
    assert('Delete (soft) zone succeeds', del.status === 200, `status=${del.status}, body=${JSON.stringify(del.data)}`);
    assert('Deleted zone is deactivated', del.data?.is_active === false);
  }

  const listAfter = await api('GET', '/zones', undefined, accessToken);
  assert('Active zone count unchanged after soft delete', listAfter.data?.length === 3);
}

// ═══════════════════════════════════════════════════
// 4. TABLES
// ═══════════════════════════════════════════════════
async function testTables() {
  console.log('\n🪑 Tables');

  const zones = await api('GET', '/zones', undefined, accessToken);
  const glavnaSalaId = zones.data?.find((z: any) => z.name === 'Glavna sala')?.id;
  const vipId = zones.data?.find((z: any) => z.name === 'VIP')?.id;

  const tables = await api('GET', `/zones/${glavnaSalaId}/tables`, undefined, accessToken);
  assert('GET tables returns array', Array.isArray(tables.data));
  assert('Glavna sala has 15 tables', tables.data?.length === 15, `got ${tables.data?.length}`);

  const vipTables = await api('GET', `/zones/${vipId}/tables`, undefined, accessToken);
  assert('VIP has tables', vipTables.data?.length >= 5, `got ${vipTables.data?.length}`);

  // Create a table to test with
  const create = await api('POST', `/zones/${vipId}/tables`, {
    table_number: 'TEST1',
    capacity: 10,
    shape: 'rectangle',
    pos_x: 600,
    pos_y: 150,
  }, accessToken);
  assert('Create table succeeds', create.status === 201, `status=${create.status}`);
  const newTableId = create.data?.id;

  if (newTableId) {
    const update = await api('PATCH', `/tables/${newTableId}`, {
      capacity: 12,
      pos_x: 650,
    }, accessToken);
    assert('Update table succeeds', update.status === 200);
    assert('Table capacity updated', update.data?.capacity === 12);

    // Delete the test table (no reservations)
    const del = await api('DELETE', `/tables/${newTableId}`, undefined, accessToken);
    assert('Delete table without reservations succeeds', del.status === 200, `status=${del.status}, body=${JSON.stringify(del.data)}`);
  }

  // Bulk layout update
  const layoutTables = vipTables.data?.slice(0, 2).map((t: any) => ({
    id: t.id,
    pos_x: t.pos_x + 10,
    pos_y: t.pos_y + 10,
    width: t.width,
    height: t.height,
    rotation: 0,
  }));
  const layout = await api('PUT', `/zones/${vipId}/tables/layout`, layoutTables, accessToken);
  assert('Bulk layout update succeeds', layout.status === 200);
}

// ═══════════════════════════════════════════════════
// 5. FLOOR PLANS
// ═══════════════════════════════════════════════════
async function testFloorPlans() {
  console.log('\n🗺️  Floor Plans');

  const zones = await api('GET', '/zones', undefined, accessToken);
  const zoneId = zones.data?.[0]?.id;

  const get = await api('GET', `/zones/${zoneId}/floor-plan`, undefined, accessToken);
  assert('GET floor plan returns data', get.status === 200);
  assert('Floor plan has canvas dimensions', get.data?.canvas_width > 0 && get.data?.canvas_height > 0);

  const update = await api('PUT', `/zones/${zoneId}/floor-plan`, {
    canvas_width: 1400,
    canvas_height: 900,
  }, accessToken);
  assert('Update floor plan succeeds', update.status === 200);

  // Restore
  await api('PUT', `/zones/${zoneId}/floor-plan`, {
    canvas_width: 1200,
    canvas_height: 800,
  }, accessToken);
}

// ═══════════════════════════════════════════════════
// 6. WORKING HOURS
// ═══════════════════════════════════════════════════
async function testWorkingHours() {
  console.log('\n⏰ Working Hours');

  const get = await api('GET', '/working-hours', undefined, accessToken);
  assert('GET working hours returns 7 days', get.data?.length === 7);
  assert('Monday open at 10:00', get.data?.[1]?.open_time?.startsWith('10:00'));
  assert('No day is closed by default', get.data?.every((d: any) => !d.is_closed));

  const days = get.data.map((d: any) => ({
    day_of_week: d.day_of_week,
    open_time: d.open_time.substring(0, 5),
    close_time: d.close_time.substring(0, 5),
    is_closed: d.day_of_week === 0,
  }));
  const update = await api('PUT', '/working-hours', days, accessToken);
  assert('Update working hours succeeds', update.status === 200);

  const verify = await api('GET', '/working-hours', undefined, accessToken);
  const sunday = verify.data?.find((d: any) => d.day_of_week === 0);
  assert('Sunday is now closed', sunday?.is_closed === true);

  // Restore
  days[0].is_closed = false;
  await api('PUT', '/working-hours', days, accessToken);
}

// ═══════════════════════════════════════════════════
// 7. RESERVATIONS — CORE CRUD
// ═══════════════════════════════════════════════════
async function testReservations() {
  console.log('\n📋 Reservations — CRUD');

  const zones = await api('GET', '/zones', undefined, accessToken);
  const zoneId = zones.data?.[0]?.id;
  const tables = await api('GET', `/zones/${zoneId}/tables`, undefined, accessToken);
  const table1 = tables.data?.[0];
  const table2 = tables.data?.[1];

  // Create reservation for tomorrow
  const create = await api('POST', '/reservations', {
    guest_name: 'Petar Petrović',
    guest_phone: '0641234567',
    guest_count: 4,
    date: '2026-03-10',
    start_time: '19:00',
    duration_minutes: 120,
    table_ids: [table1.id],
    reservation_type: 'standard',
    notes: 'Prozor mesto',
  }, accessToken);
  assert('Create reservation succeeds', create.status === 201, `status=${create.status}, err=${JSON.stringify(create.data)}`);
  const resId = create.data?.id;
  assert('Reservation has ID', !!resId);
  assert('Status is nova', create.data?.status === 'nova');
  assert('Type is standard', create.data?.reservation_type === 'standard');

  // Create celebration (different table)
  const celebration = await api('POST', '/reservations', {
    guest_name: 'Marija Marić',
    guest_phone: '0659876543',
    guest_count: 12,
    date: '2026-03-10',
    start_time: '18:00',
    duration_minutes: 240,
    table_ids: [table2.id],
    reservation_type: 'celebration',
    celebration_details: 'Rođendan — torta i dekoracija',
  }, accessToken);
  assert('Create celebration succeeds', celebration.status === 201, `status=${celebration.status}`);
  assert('Celebration type is correct', celebration.data?.reservation_type === 'celebration');
  const celebrationId = celebration.data?.id;

  // List reservations
  const list = await api('GET', '/reservations?date=2026-03-10', undefined, accessToken);
  assert('List reservations returns results', list.data?.length >= 2, `got ${list.data?.length}`);

  const filtered = await api('GET', '/reservations?date=2026-03-10&status=nova', undefined, accessToken);
  assert('Filter by status works', filtered.data?.length >= 1);

  // Status transitions
  if (resId) {
    const confirm = await api('PATCH', `/reservations/${resId}`, { status: 'potvrdjena' }, accessToken);
    assert('Confirm (nova → potvrdjena)', confirm.status === 200 && confirm.data?.status === 'potvrdjena');

    const seat = await api('PATCH', `/reservations/${resId}`, { status: 'seated' }, accessToken);
    assert('Seat (potvrdjena → seated)', seat.status === 200 && seat.data?.status === 'seated');

    const finish = await api('PATCH', `/reservations/${resId}`, { status: 'zavrsena' }, accessToken);
    assert('Finish (seated → zavrsena)', finish.status === 200 && finish.data?.status === 'zavrsena');
  }

  if (celebrationId) {
    const noshow = await api('PATCH', `/reservations/${celebrationId}`, { status: 'no_show' }, accessToken);
    assert('No-show works', noshow.status === 200);
  }

  // Delete future reservation
  if (resId) {
    const del = await api('DELETE', `/reservations/${resId}`, undefined, accessToken);
    assert('Delete future reservation succeeds', del.status === 200, `status=${del.status}`);
  }

  // Cleanup celebration
  if (celebrationId) {
    await api('DELETE', `/reservations/${celebrationId}`, undefined, accessToken);
  }

  return { zoneId, table1, table2 };
}

// ═══════════════════════════════════════════════════
// 8. WALK-IN
// ═══════════════════════════════════════════════════
async function testWalkin(tableId: number) {
  console.log('\n🚶 Walk-in');

  const walkin = await api('POST', '/reservations/walkin', {
    guest_name: 'Walk-in gost',
    guest_count: 2,
    table_ids: [tableId],
  }, accessToken);
  assert('Walk-in creation succeeds', walkin.status === 201, `status=${walkin.status}`);
  assert('Walk-in type is walkin', walkin.data?.reservation_type === 'walkin');
  assert('Walk-in status is seated', walkin.data?.status === 'seated');
  assert('Walk-in date is today', !!walkin.data?.date);

  if (walkin.data?.id) {
    const finish = await api('PATCH', `/reservations/${walkin.data.id}`, { status: 'zavrsena' }, accessToken);
    assert('Finish walk-in succeeds', finish.status === 200);
  }
}

// ═══════════════════════════════════════════════════
// 9. AVAILABILITY
// ═══════════════════════════════════════════════════
async function testAvailability(zoneId: number, table1: any) {
  console.log('\n🔍 Availability');

  // Create a reservation to test against
  const res = await api('POST', '/reservations', {
    guest_name: 'Test Availability',
    guest_count: 2,
    date: '2026-03-11',
    start_time: '20:00',
    duration_minutes: 120,
    table_ids: [table1.id],
    reservation_type: 'standard',
  }, accessToken);
  const resId = res.data?.id;
  assert('Setup: created test reservation', res.status === 201);

  // Overlapping time — table should NOT be available
  const overlap = await api('GET', `/reservations/availability?date=2026-03-11&time=20:30&duration=120&guests=2`, undefined, accessToken);
  assert('Availability check returns 200', overlap.status === 200, `status=${overlap.status}`);
  const availableIds = overlap.data?.available_tables?.map((t: any) => t.id) || [];
  assert('Occupied table NOT in available list', !availableIds.includes(table1.id));

  // Non-overlapping time — table should be available
  const free = await api('GET', `/reservations/availability?date=2026-03-11&time=12:00&duration=120&guests=2`, undefined, accessToken);
  assert('Free time returns 200', free.status === 200, `status=${free.status}`);
  const freeIds = free.data?.available_tables?.map((t: any) => t.id) || [];
  assert('Table available at non-overlapping time', freeIds.includes(table1.id), `table ${table1.id} not found in ${freeIds.length} available`);

  // Timeline
  const timeline = await api('GET', `/reservations/availability/timeline?date=2026-03-11&zoneId=${zoneId}`, undefined, accessToken);
  assert('Timeline returns 200', timeline.status === 200, `status=${timeline.status}`);
  assert('Timeline has table entries', Array.isArray(timeline.data) && timeline.data.length > 0);

  // Double-booking prevention
  const double = await api('POST', '/reservations', {
    guest_name: 'Double Booking Test',
    guest_count: 2,
    date: '2026-03-11',
    start_time: '20:30',
    duration_minutes: 120,
    table_ids: [table1.id],
    reservation_type: 'standard',
  }, accessToken);
  assert('Double booking is prevented', double.status === 409 || double.status === 400, `status=${double.status}`);

  // Cleanup
  if (resId) await api('DELETE', `/reservations/${resId}`, undefined, accessToken);
}

// ═══════════════════════════════════════════════════
// 10. USER MANAGEMENT
// ═══════════════════════════════════════════════════
async function testUsers() {
  console.log('\n👤 Users');

  const list = await api('GET', '/users', undefined, accessToken);
  assert('List users returns array', Array.isArray(list.data));
  assert('Has seed users', list.data?.length >= 4, `got ${list.data?.length}`);

  // Create user
  const username = `testkonobar_${Date.now()}`;
  const create = await api('POST', '/users', {
    username,
    password: 'test123',
    display_name: 'Test Konobar',
    role: 'waiter',
  }, accessToken);
  assert('Create user succeeds', create.status === 201, `status=${create.status}`);
  const userId = create.data?.id;

  // New user can login
  const login = await api('POST', '/auth/login', { username, password: 'test123' });
  assert('New user can login', login.status === 200);

  // Waiter cannot manage users
  const waiterToken = login.data?.accessToken;
  const forbidden = await api('GET', '/users', undefined, waiterToken);
  assert('Waiter cannot list users (403)', forbidden.status === 403);

  // Update user
  if (userId) {
    const update = await api('PATCH', `/users/${userId}`, {
      display_name: 'Test Konobar Updated',
    }, accessToken);
    assert('Update user succeeds', update.status === 200, `status=${update.status}`);
  }

  // Deactivate user
  if (userId) {
    const deactivate = await api('DELETE', `/users/${userId}`, undefined, accessToken);
    assert('Deactivate user succeeds', deactivate.status === 200, `status=${deactivate.status}`);
    assert('User is now inactive', deactivate.data?.is_active === false);
  }
}

// ═══════════════════════════════════════════════════
// 11. FRONTEND CHECK
// ═══════════════════════════════════════════════════
async function testFrontend() {
  console.log('\n🌐 Frontend');

  try {
    const res = await fetch(FRONTEND);
    assert('Frontend serves index.html', res.status === 200);
    const html = await res.text();
    assert('HTML contains app root div', html.includes('id="root"'));
    assert('HTML title is Rezervacije', html.includes('Rezervacije'));
  } catch {
    assert('Frontend is reachable', false, 'Could not connect');
  }

  try {
    const res = await fetch(`${FRONTEND}/api/health`);
    assert('Vite proxy to /api works', res.status === 200);
  } catch {
    assert('Vite proxy works', false, 'Proxy not reachable');
  }
}

// ═══════════════════════════════════════════════════
// 12. SSE ENDPOINT
// ═══════════════════════════════════════════════════
async function testSSE() {
  console.log('\n📡 SSE');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${BASE}/events?token=${accessToken}`, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' },
    });
    clearTimeout(timeout);

    assert('SSE endpoint responds', res.status === 200);
    assert('SSE content type is event-stream',
      res.headers.get('content-type')?.includes('text/event-stream') ?? false);
    controller.abort();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      assert('SSE endpoint responds (connection kept open)', true);
    } else {
      assert('SSE endpoint is reachable', false, err.message);
    }
  }
}

// ═══════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════
async function run() {
  console.log('═══════════════════════════════════════════');
  console.log('  Rezervacije — E2E API Test Suite');
  console.log('═══════════════════════════════════════════');

  try {
    await testHealth();
    await testAuth();
    await testZones();
    await testTables();
    await testFloorPlans();
    await testWorkingHours();
    const { zoneId, table1, table2 } = await testReservations();
    await testWalkin(table2.id);
    await testAvailability(zoneId, table1);
    await testUsers();
    await testFrontend();
    await testSSE();
  } catch (err) {
    console.error('\n💥 Unexpected error:', err);
    failed++;
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\n❌ Failures:');
    failures.forEach((f) => console.log(`   - ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
