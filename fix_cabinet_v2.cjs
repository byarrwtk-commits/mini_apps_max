const https = require('https');
const crypto = require('crypto');
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
  // Новый узел: Check Cabinet User (между Lookup Cabinet User и Get Debt)
  // Если пользователь не найден — сразу отвечает {registered:false}
  // Если найден — передаёт plot_number дальше
  // ============================================================
  const checkCabinetId = crypto.randomUUID();
  const respondNotRegId = crypto.randomUUID();

  const checkCabinetNode = {
    id: checkCabinetId,
    name: 'Check Cabinet User',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1080, 660],
    parameters: {
      jsCode: `
const r = items[0].json;
const plot = r.plot_number || r['plot_number'] || r['Участок'] || r['участок'] || r.plot || '';
if (!plot) {
  // Пользователь не зарегистрирован — выходим
  return [{ json: { registered: false, _notFound: true } }];
}
// Передаём plot дальше для запроса в Должники
return [{ json: { plot_number: String(plot), registered: true } }];
`.trim()
    }
  };

  // Узел ответа "не зарегистрирован" для cabinet
  const respondNotRegNode = {
    id: respondNotRegId,
    name: 'Respond Cabinet Not Reg',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1,
    position: [1320, 560],
    parameters: {
      respondWith: 'text',
      responseBody: '{"registered":false}',
      options: {
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: '*' }
          ]
        }
      }
    }
  };

  // If-узел: зарегистрирован ли пользователь?
  const ifCabinetId = crypto.randomUUID();
  const ifCabinetNode = {
    id: ifCabinetId,
    name: 'Is Cabinet Registered',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [1320, 660],
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose' },
        conditions: [{ id: 'cc1', leftValue: '={{ $json._notFound }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and'
      },
      options: {}
    }
  };

  // Добавляем новые узлы
  wf.nodes.push(checkCabinetNode, ifCabinetNode, respondNotRegNode);

  // Обновляем позицию Get Debt и Format Cabinet
  const getDebt = wf.nodes.find(n => n.name === 'Get Debt');
  getDebt.position = [1560, 660];
  // Исправляем lookupValue — теперь plot_number гарантированно есть
  getDebt.parameters.lookupValue = '={{ $json.plot_number }}';

  const formatCabinet = wf.nodes.find(n => n.name === 'Format Cabinet');
  formatCabinet.position = [1800, 660];
  // Исправляем Format Cabinet — теперь $() не нужен, plot уже в items[0]
  formatCabinet.parameters.jsCode = `
const debtRow = items[0].json;
// plot_number передан через Check Cabinet User -> Get Debt
let plot = '';
try { plot = $('Check Cabinet User').first().json.plot_number || ''; } catch(e) {}

const balance = debtRow['Задолженность'] || debtRow['Долг'] || debtRow.balance || debtRow['сумма'] || '0';

return [{ json: { registered: true, plot_number: String(plot), balance: String(balance) } }];
`.trim();

  const respondCabinet = wf.nodes.find(n => n.name === 'Respond Cabinet');
  respondCabinet.position = [2040, 660];

  // ============================================================
  // Перестраиваем connections для cabinet ветки
  // ============================================================
  // Старые connections: Lookup Cabinet User -> Get Debt -> Format Cabinet -> Respond Cabinet
  // Новые: Lookup Cabinet User -> Check Cabinet User -> Is Cabinet Registered
  //                    [true=notFound] -> Respond Cabinet Not Reg
  //                    [false=found]   -> Get Debt -> Format Cabinet -> Respond Cabinet

  wf.connections['Lookup Cabinet User'] = { main: [[{ node: 'Check Cabinet User', type: 'main', index: 0 }]] };
  wf.connections['Check Cabinet User']  = { main: [[{ node: 'Is Cabinet Registered', type: 'main', index: 0 }]] };
  wf.connections['Is Cabinet Registered'] = {
    main: [
      [{ node: 'Respond Cabinet Not Reg', type: 'main', index: 0 }],  // true = notFound
      [{ node: 'Get Debt', type: 'main', index: 0 }]                   // false = found
    ]
  };
  // Get Debt -> Format Cabinet -> Respond Cabinet остаются те же

  const upd = await apiReq(`/api/v1/workflows/${WF_ID}`, 'PUT', {
    name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {}
  });
  console.log('Update:', upd.status);

  await new Promise(r => setTimeout(r, 500));
  const act = await apiReq(`/api/v1/workflows/${WF_ID}/activate`, 'POST');
  console.log('Active:', JSON.parse(act.body).active);

  await new Promise(r => setTimeout(r, 3000));

  // ============================================================
  // ТЕСТЫ
  // ============================================================
  async function test(label, body) {
    const r = await apiReq(WEBHOOK_PATH, 'POST', body);
    console.log(`\n[${label}] status:${r.status} | ${r.body || '(empty)'}`);
  }

  await test('get_news', { action: 'get_news', user_id: 'test' });
  await test('check_user (unknown)', { action: 'check_user', user_id: 'test_unknown_999', platform: 'max' });
  await test('get_cabinet (unknown)', { action: 'get_cabinet', user_id: 'test_unknown_999', platform: 'max' });
  await test('register (wrong)', { action: 'register', user_id: 'test_u', plot: '999', surname: 'Тестов', phone: '+79991234567' });
})();
