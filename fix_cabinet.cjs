const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTIxYzI0NS1iYzM4LTRlOWQtODFhMi0wYTgxZTQ3MTRjMTgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMzk0MDYxfQ.oTFzo6IL3M3oX4JyTm9XYg7B6lSU30Zpnh6uqznzUr8';
const WF_ID = 'scjuXWA1W93tIFCU';
const WEBHOOK_PATH = '/webhook/50ee1e3b-1132-4649-84a2-b25a92a0711c';

function apiReq(path, method, data) {
  return new Promise((resolve) => {
    const body = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'vibe.umnode.ru', path, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', 'Content-Length': body ? Buffer.byteLength(body) : 0 }
    };
    const r = https.request(opts, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    if (body) r.write(body);
    r.end();
  });
}

function post(action, extra) {
  return apiReq(WEBHOOK_PATH, 'POST', { action, user_id: 'test_user_123', platform: 'max', ...extra });
}

(async () => {
  // Деактивируем
  await apiReq(`/api/v1/workflows/${WF_ID}/deactivate`, 'POST');

  // Получаем workflow
  const g = await apiReq(`/api/v1/workflows/${WF_ID}`, 'GET');
  const wf = JSON.parse(g.body);

  // ====================================================
  // FIX: Format Cabinet
  // Проблема: $node[] не работает в Code v2
  // Решение: использовать $('NodeName').first().json
  // ====================================================
  const formatCabinet = wf.nodes.find(n => n.name === 'Format Cabinet');
  formatCabinet.parameters.jsCode = `
const debtRow = items[0].json;

// Получаем данные регистрации из Lookup Cabinet User
let regRow = {};
try {
  regRow = $('Lookup Cabinet User').first().json || {};
} catch(e) {
  regRow = {};
}

const plot    = regRow.plot_number || regRow['plot_number'] || regRow['Участок'] || '';
const balance = debtRow['Задолженность'] || debtRow['Долг'] || debtRow.balance || debtRow['сумма'] || '0';

if (!plot) {
  return [{ json: { registered: false } }];
}

return [{ json: { registered: true, plot_number: String(plot), balance: String(balance) } }];
`.trim();

  // ====================================================
  // FIX: Verify Registration
  // ====================================================
  const verifyReg = wf.nodes.find(n => n.name === 'Verify Registration');
  verifyReg.parameters.jsCode = `
const regRow = items[0].json;

let input = {};
try {
  input = $('Prep Register').first().json || {};
} catch(e) {
  input = {};
}

const foundPlot = regRow['Участок'] || regRow['участок'] || regRow.plot || '';
if (!foundPlot) return [{ json: { success: false, not_found: true } }];

const foundSurname = String(regRow['Фамилия'] || regRow['фамилия'] || regRow['ФИО'] || '').toLowerCase();
const inputSurname = String(input.surname || '').toLowerCase();

// Проверяем фамилию если она заполнена в реестре
if (inputSurname && foundSurname && !foundSurname.includes(inputSurname)) {
  return [{ json: { success: false, not_found: true } }];
}

return [{ json: { ok: true, plot: String(foundPlot), user_id: input.user_id || '', surname: input.surname || '', phone: input.phone || '' } }];
`.trim();

  // ====================================================
  // FIX: Format Check — тоже проверим
  // ====================================================
  const formatCheck = wf.nodes.find(n => n.name === 'Format Check');
  formatCheck.parameters.jsCode = `
const r = items[0].json;
const plot = r.plot_number || r['plot_number'] || r['Участок'] || r['участок'] || r.plot || '';
if (plot) {
  return [{ json: { registered: true, plot_number: String(plot) } }];
}
return [{ json: { registered: false } }];
`.trim();

  // Обновляем
  const upd = await apiReq(`/api/v1/workflows/${WF_ID}`, 'PUT', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {}
  });
  console.log('Update status:', upd.status);

  await new Promise(r => setTimeout(r, 500));

  // Активируем
  const act = await apiReq(`/api/v1/workflows/${WF_ID}/activate`, 'POST');
  console.log('Active:', JSON.parse(act.body).active);

  await new Promise(r => setTimeout(r, 3000));

  // ====================================================
  // ТЕСТЫ
  // ====================================================
  console.log('\n--- TEST: get_news ---');
  const t1 = await post('get_news');
  const news = JSON.parse(t1.body);
  console.log('Status:', t1.status, '| Count:', Array.isArray(news) ? news.length : 'N/A');

  console.log('\n--- TEST: check_user (unknown) ---');
  const t2 = await post('check_user');
  console.log('Status:', t2.status, '|', t2.body);

  console.log('\n--- TEST: get_cabinet (unknown user) ---');
  const t3 = await post('get_cabinet');
  console.log('Status:', t3.status, '|', t3.body || '(empty - PROBLEM)');

  console.log('\n--- TEST: register (wrong plot) ---');
  const t4 = await apiReq(WEBHOOK_PATH, 'POST', { action: 'register', user_id: 'test_user_123', plot: '999', surname: 'Тестов', phone: '+79001234567' });
  console.log('Status:', t4.status, '|', t4.body);
})();
