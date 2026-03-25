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

(async () => {
  await apiReq(`/api/v1/workflows/${WF_ID}/deactivate`, 'POST');
  const g = await apiReq(`/api/v1/workflows/${WF_ID}`, 'GET');
  const wf = JSON.parse(g.body);

  // ============================================================
  // FIX 1: Verify Registration
  // Реестр имеет колонки: Участок, Телефон (последние 4 цифры или целиком), Фамилия
  // Проверяем по участку И (фамилия ИЛИ телефон)
  // Фамилия — нечёткое совпадение (toLowerCase + includes)
  // Телефон — последние 4 цифры
  // ============================================================
  const verifyReg = wf.nodes.find(n => n.name === 'Verify Registration');
  verifyReg.parameters.jsCode = `
const regRow = items[0].json;

let input = {};
try {
  input = $('Prep Register').first().json || {};
} catch(e) { input = {}; }

// Участок должен быть найден
const foundPlot = String(regRow['Участок'] || regRow['участок'] || regRow.plot || '').trim();
if (!foundPlot) return [{ json: { success: false, not_found: true } }];

// Проверяем фамилию (нечёткое совпадение)
const foundSurname = String(
  regRow['Фамилия'] || regRow['фамилия'] || regRow['ФИО'] || ''
).toLowerCase().trim();
const inputSurname = String(input.surname || '').toLowerCase().trim();

// Проверяем телефон (последние 4 цифры)
const foundPhone = String(
  regRow['Телефон (последние 4 цифры или целиком)'] || regRow['Телефон'] || regRow['телефон'] || ''
).replace(/\\D/g, '');
const inputPhone = String(input.phone || '').replace(/\\D/g, '');
const last4Input = inputPhone.slice(-4);
const last4Found = foundPhone.slice(-4);

// Совпадение: фамилия совпадает ИЛИ последние 4 цифры телефона совпадают
const surnameMatch = inputSurname && foundSurname && foundSurname.includes(inputSurname);
const phoneMatch   = last4Input.length === 4 && last4Found.length === 4 && last4Input === last4Found;

if (!surnameMatch && !phoneMatch) {
  return [{ json: { success: false, not_found: true } }];
}

return [{
  json: {
    ok: true,
    plot: foundPlot,
    user_id: input.user_id || '',
    surname: input.surname || '',
    phone: input.phone || '',
    registered_at: new Date().toISOString()
  }
}];
`.trim();

  // ============================================================
  // FIX 2: Write Registration — добавляем маппинг колонок
  // Лист РеестрТелеграм должен иметь заголовки или мы используем appendOrUpdate
  // Используем operation: append с явным указанием данных через Set-узел перед ним
  // Проще всего: заменить на Code-узел который готовит данные + Sheets append
  // ============================================================
  const writeReg = wf.nodes.find(n => n.name === 'Write Registration');
  // Меняем на appendOrUpdate с маппингом
  writeReg.parameters = {
    authentication: 'oAuth2',
    operation: 'append',
    sheetId: '1O6VcZMgPrwYp-lxjv8t0Bfzy1BmwfrqZAVZx8PG-UQk',
    range: 'РеестрТелеграм!A:Z',
    dataMode: 'autoMapInputData',
    options: {}
  };

  // Добавим Code-узел перед Write Registration для подготовки данных
  const crypto = require('crypto');
  const prepWriteId = crypto.randomUUID();
  const prepWriteNode = {
    id: prepWriteId,
    name: 'Prep Write Reg',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1680, 380],
    parameters: {
      jsCode: `
const d = items[0].json;
return [{
  json: {
    telegram_id:   d.user_id || '',
    plot_number:   d.plot    || '',
    surname:       d.surname || '',
    phone:         d.phone   || '',
    registered_at: d.registered_at || new Date().toISOString()
  }
}];
`.trim()
    }
  };

  // Смещаем Write Registration
  writeReg.position = [1920, 380];
  const respondRegOk = wf.nodes.find(n => n.name === 'Respond Reg OK');
  if (respondRegOk) respondRegOk.position = [2160, 380];

  wf.nodes.push(prepWriteNode);

  // Перестраиваем connections: Is Valid(true) -> Prep Write Reg -> Write Registration -> Respond Reg OK
  wf.connections['Is Valid'] = {
    main: [
      [{ node: 'Prep Write Reg', type: 'main', index: 0 }],
      [{ node: 'Respond Reg Fail', type: 'main', index: 0 }]
    ]
  };
  wf.connections['Prep Write Reg'] = { main: [[{ node: 'Write Registration', type: 'main', index: 0 }]] };

  // ============================================================
  // FIX 3: Check User — проверяем по полю telegram_id в РеестрТелеграм
  // После успешной регистрации check_user должен находить пользователя
  // Убеждаемся что Format Check правильно читает поля
  // ============================================================
  const formatCheck = wf.nodes.find(n => n.name === 'Format Check');
  formatCheck.parameters.jsCode = `
const r = items[0].json;
// Поле plot_number или Участок в листе РеестрТелеграм
const plot = r.plot_number || r['plot_number'] || r['Участок'] || r['участок'] || r.plot || '';
if (plot) {
  return [{ json: { registered: true, plot_number: String(plot) } }];
}
return [{ json: { registered: false } }];
`.trim();

  // ============================================================
  // Обновляем и активируем
  // ============================================================
  const upd = await apiReq(`/api/v1/workflows/${WF_ID}`, 'PUT', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {}
  });
  console.log('Update:', upd.status);
  if (upd.status !== 200) {
    console.log('Error:', upd.body.substring(0, 300));
    return;
  }

  await new Promise(r => setTimeout(r, 500));
  const act = await apiReq(`/api/v1/workflows/${WF_ID}/activate`, 'POST');
  console.log('Active:', JSON.parse(act.body).active);

  await new Promise(r => setTimeout(r, 3000));

  // ============================================================
  // Тест регистрации с реальными данными (участок 1, фамилия Иванов)
  // ============================================================
  console.log('\n=== TEST register (plot=1, Иванов) ===');
  const t1 = await apiReq(WEBHOOK_PATH, 'POST', {
    action: 'register',
    user_id: 'debug_user_001',
    platform: 'max',
    plot: '1',
    surname: 'Иванов',
    phone: '+79001234567'
  });
  console.log('Status:', t1.status, '| Body:', t1.body);

  await new Promise(r => setTimeout(r, 2000));

  // Проверяем что пользователь теперь найден
  console.log('\n=== TEST check_user (должен быть registered) ===');
  const t2 = await apiReq(WEBHOOK_PATH, 'POST', {
    action: 'check_user',
    user_id: 'debug_user_001',
    platform: 'max'
  });
  console.log('Status:', t2.status, '| Body:', t2.body);

  // Кабинет
  console.log('\n=== TEST get_cabinet ===');
  const t3 = await apiReq(WEBHOOK_PATH, 'POST', {
    action: 'get_cabinet',
    user_id: 'debug_user_001',
    platform: 'max'
  });
  console.log('Status:', t3.status, '| Body:', t3.body);
})();
