const crypto = require('crypto');
const fs = require('fs');

const uuid = () => crypto.randomUUID();

// Константы — берутся из env, иначе дефолт
const CRED = {
  googleSheetsOAuth2Api: {
    id: process.env.GOOGLE_CRED_ID || 'x7Dt7uzZMaxnegVP',
    name: 'Google Sheets account 2'
  }
};
const SHEET_ID = process.env.SHEET_ID || '1O6VcZMgPrwYp-lxjv8t0Bfzy1BmwfrqZAVZx8PG-UQk';
const RSS_URL  = process.env.RSS_URL  || 'https://sntberezka4.ru/feed/';

const CORS_HEADERS = {
  responseHeaders: {
    entries: [
      { name: 'Content-Type',                value: 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: '*' }
    ]
  }
};

// ---- Хелперы для типовых нод ----

function makeGSheetsLookup(id, name, position, range, lookupColumn, lookupValue) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 1,
    position,
    alwaysOutputData: true,
    credentials: CRED,
    parameters: {
      authentication: 'oAuth2',
      operation: 'lookup',
      sheetId: SHEET_ID,
      range,
      lookupColumn,
      lookupValue,
      options: {}
    }
  };
}

function makeRespond(id, name, position, body) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1,
    position,
    parameters: {
      respondWith: 'text',
      responseBody: body,
      options: CORS_HEADERS
    }
  };
}

// ---- ID всех нод ----

const ids = {
  webhook: uuid(),
  router:  uuid(),
  // get_news
  rss:        uuid(),
  formatNews: uuid(),
  respondNews: uuid(),
  // check_user
  extractCheck:  uuid(),
  lookupUser:    uuid(),
  formatCheck:   uuid(),
  respondCheck:  uuid(),
  // register
  prepReg:      uuid(),
  lookupReg:    uuid(),
  verifyReg:    uuid(),
  ifValid:      uuid(),
  writeReg:     uuid(),
  respondRegOk:   uuid(),
  respondRegFail: uuid(),
  // get_cabinet
  extractCabinet:      uuid(),
  lookupCabinet:       uuid(),
  isCabinetReg:        uuid(),
  respondCabinetNotReg: uuid(),
  getDebt:             uuid(),
  formatCabinet:       uuid(),
  respondCabinet:      uuid(),
  // get_payments
  extractPayments:     uuid(),
  lookupPayUser:       uuid(),
  getPayments:         uuid(),
  formatPayments:      uuid(),
  respondPayments:     uuid(),
  // update_contact
  extractUpdate:   uuid(),
  updateContact:   uuid(),
  respondUpdateOk: uuid(),
};

// ---- Workflow ----

const wf = {
  name: 'MINI_APP_ENGINE',
  nodes: [

    // ===================== WEBHOOK =====================
    {
      id: ids.webhook,
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [240, 500],
      parameters: {
        httpMethod: 'POST',
        path: 'mini-app',
        responseMode: 'responseNode',
        options: {}
      }
    },

    // ===================== ROUTER =====================
    {
      id: ids.router,
      name: 'Router',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3,
      position: [480, 500],
      parameters: {
        rules: {
          values: [
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c1', leftValue: '={{ $json.body.action }}', rightValue: 'get_news', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'news'
            },
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c2', leftValue: '={{ $json.body.action }}', rightValue: 'check_user', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'check'
            },
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c3', leftValue: '={{ $json.body.action }}', rightValue: 'register', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'register'
            },
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c4', leftValue: '={{ $json.body.action }}', rightValue: 'get_cabinet', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'cabinet'
            },
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c5', leftValue: '={{ $json.body.action }}', rightValue: 'get_payments', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'payments'
            },
            {
              conditions: {
                options: { caseSensitive: false, typeValidation: 'loose' },
                conditions: [{ id: 'c6', leftValue: '={{ $json.body.action }}', rightValue: 'update_contact', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true, outputKey: 'update_contact'
            }
          ]
        },
        options: {}
      }
    },

    // ===================== GET_NEWS =====================
    {
      id: ids.rss,
      name: 'RSS Feed',
      type: 'n8n-nodes-base.rssFeedRead',
      typeVersion: 1,
      position: [720, 80],
      parameters: { url: RSS_URL, options: {} }
    },
    {
      id: ids.formatNews,
      name: 'Format News',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [960, 80],
      parameters: {
        jsCode: [
          'const news = items.map(i => {',
          '  const raw = i.json.pubDate || i.json.isoDate || "";',
          '  let date = raw;',
          '  try {',
          '    if (raw) date = new Date(raw).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });',
          '  } catch {}',
          '  return {',
          '    title:       i.json.title || "",',
          '    date,',
          '    description: String(i.json.contentSnippet || i.json.summary || i.json.description || "").substring(0, 300),',
          '    link:        i.json.link || ""',
          '  };',
          '});',
          'return [{ json: { news } }];'
        ].join('\n')
      }
    },
    makeRespond(ids.respondNews, 'Respond News', [1200, 80], '={{ JSON.stringify($json.news) }}'),

    // ===================== CHECK_USER =====================
    {
      id: ids.extractCheck,
      name: 'Extract User Check',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 280],
      parameters: {
        jsCode: [
          'const b = items[0].json.body || items[0].json;',
          'return [{ json: { user_id: String(b.user_id || b.userId || b.telegram_id || "") } }];'
        ].join('\n')
      }
    },
    makeGSheetsLookup(ids.lookupUser, 'Lookup User', [960, 280], 'РеестрТелеграм!A:Z', 'telegram_id', '={{ $json.user_id }}'),
    {
      id: ids.formatCheck,
      name: 'Format Check',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 280],
      parameters: {
        jsCode: [
          'const r = items[0].json;',
          'const plot = r.plot_number || r["Участок"] || r.plot || "";',
          'return [{ json: plot ? { registered: true, plot_number: String(plot) } : { registered: false } }];'
        ].join('\n')
      }
    },
    makeRespond(ids.respondCheck, 'Respond Check', [1440, 280], '={{ JSON.stringify($json) }}'),

    // ===================== REGISTER =====================
    {
      id: ids.prepReg,
      name: 'Prep Register',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 480],
      parameters: {
        jsCode: [
          'const b = items[0].json.body || items[0].json;',
          'return [{ json: {',
          '  user_id: String(b.user_id || b.userId || ""),',
          '  plot:    String(b.plot || b.plot_number || "").trim(),',
          '  surname: String(b.surname || b.last_name || "").trim(),',
          '  phone:   String(b.phone || b.phone_number || "").trim().replace(/\\s+/g, "")',
          '} }];'
        ].join('\n')
      }
    },
    makeGSheetsLookup(ids.lookupReg, 'Lookup Registry', [960, 480], 'РеестрСНТ!A:Z', 'Участок', '={{ $json.plot }}'),
    {
      id: ids.verifyReg,
      name: 'Verify Registration',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 480],
      parameters: {
        jsCode: [
          'const regRow = items[0].json;',
          'const input  = $("Prep Register").first().json;',
          '',
          'const foundPlot = regRow["Участок"] || regRow["участок"] || regRow.plot || "";',
          'if (!foundPlot) return [{ json: { success: false, not_found: true } }];',
          '',
          '// Проверка фамилии',
          'const foundSurname = String(regRow["Фамилия"] || regRow["фамилия"] || regRow["ФИО"] || "").toLowerCase();',
          'const inputSurname = input.surname.toLowerCase();',
          'const surnameOk    = Boolean(foundSurname && foundSurname.includes(inputSurname));',
          '',
          '// Проверка телефона по последним 4 цифрам',
          'const foundPhone = String(regRow["Телефон"] || regRow["телефон"] || regRow.phone || "").replace(/\\D/g, "");',
          'const inputPhone = input.phone.replace(/\\D/g, "");',
          'const phoneOk    = foundPhone.length >= 4 && inputPhone.length >= 4 &&',
          '                   foundPhone.slice(-4) === inputPhone.slice(-4);',
          '',
          '// Достаточно совпадения ЛЮБОГО из двух',
          'if (!surnameOk && !phoneOk) {',
          '  return [{ json: { success: false, not_found: true } }];',
          '}',
          '',
          'return [{ json: { ok: true, plot: String(foundPlot), user_id: input.user_id, surname: input.surname, phone: input.phone } }];'
        ].join('\n')
      }
    },
    {
      id: ids.ifValid,
      name: 'Is Valid',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1440, 480],
      parameters: {
        conditions: {
          options: { caseSensitive: true, typeValidation: 'loose' },
          conditions: [{ id: 'cv', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
          combinator: 'and'
        },
        options: {}
      }
    },
    {
      id: ids.writeReg,
      name: 'Write Registration',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 1,
      position: [1680, 400],
      credentials: CRED,
      parameters: {
        authentication: 'oAuth2',
        operation: 'append',
        sheetId: SHEET_ID,
        range: 'РеестрТелеграм!A:Z',
        options: {}
      }
    },
    makeRespond(ids.respondRegOk,   'Respond Reg OK',   [1920, 400], '{"success":true}'),
    makeRespond(ids.respondRegFail, 'Respond Reg Fail', [1680, 580], '{"success":false,"not_found":true}'),

    // ===================== GET_CABINET =====================
    {
      id: ids.extractCabinet,
      name: 'Extract User Cabinet',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 700],
      parameters: {
        jsCode: [
          'const b = items[0].json.body || items[0].json;',
          'return [{ json: { user_id: String(b.user_id || b.userId || b.telegram_id || "") } }];'
        ].join('\n')
      }
    },
    makeGSheetsLookup(ids.lookupCabinet, 'Lookup Cabinet User', [960, 700], 'РеестрТелеграм!A:Z', 'telegram_id', '={{ $json.user_id }}'),
    {
      id: ids.isCabinetReg,
      name: 'Is Cabinet Registered',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [1200, 700],
      parameters: {
        conditions: {
          options: { caseSensitive: false, typeValidation: 'loose' },
          conditions: [{
            id: 'cr',
            leftValue: '={{ $json.plot_number || $json["Участок"] || $json.plot || "" }}',
            rightValue: '',
            operator: { type: 'string', operation: 'notEmpty' }
          }],
          combinator: 'and'
        },
        options: {}
      }
    },
    makeRespond(ids.respondCabinetNotReg, 'Respond Cabinet Not Reg', [1440, 800], '{"registered":false}'),
    makeGSheetsLookup(
      ids.getDebt, 'Get Debt', [1440, 600],
      'Должники!A:Z', 'Участок',
      '={{ $("Lookup Cabinet User").first().json.plot_number || $("Lookup Cabinet User").first().json["Участок"] || $("Lookup Cabinet User").first().json.plot || "" }}'
    ),
    {
      id: ids.formatCabinet,
      name: 'Format Cabinet',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, 600],
      parameters: {
        jsCode: [
          'const debtRow = items[0].json;',
          'const regRow  = $("Lookup Cabinet User").first().json;',
          'const plot    = regRow.plot_number || regRow["Участок"] || regRow.plot || "";',
          'const balance = debtRow["Задолженность"] || debtRow["Долг"] || debtRow.balance || "0";',
          'return [{ json: { registered: true, plot_number: String(plot), balance: String(balance) } }];'
        ].join('\n')
      }
    },
    makeRespond(ids.respondCabinet, 'Respond Cabinet', [1920, 600], '={{ JSON.stringify($json) }}'),

    // ===================== GET_PAYMENTS =====================
    {
      id: ids.extractPayments,
      name: 'Extract User Payments',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 920],
      parameters: {
        jsCode: [
          'const b = items[0].json.body || items[0].json;',
          'return [{ json: { user_id: String(b.user_id || b.userId || b.telegram_id || "") } }];'
        ].join('\n')
      }
    },
    makeGSheetsLookup(ids.lookupPayUser, 'Lookup Pay User', [960, 920], 'РеестрТелеграм!A:Z', 'telegram_id', '={{ $json.user_id }}'),
    makeGSheetsLookup(
      ids.getPayments, 'Get Payments', [1200, 920],
      'Платежи!A:Z', 'Участок',
      '={{ $json.plot_number || $json["Участок"] || $json.plot || "" }}'
    ),
    {
      id: ids.formatPayments,
      name: 'Format Payments',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1440, 920],
      parameters: {
        jsCode: [
          'const regRow = $("Lookup Pay User").first().json;',
          'const plot   = regRow.plot_number || regRow["Участок"] || regRow.plot || "";',
          'if (!plot) return [{ json: { registered: false, payments: [] } }];',
          '',
          'const payments = items',
          '  .map(i => ({',
          '    date:        i.json["Дата"]    || i.json.date        || "",',
          '    amount:      i.json["Сумма"]   || i.json.amount      || "0",',
          '    description: i.json["Описание"]|| i.json.description || ""',
          '  }))',
          '  .filter(p => p.date || p.amount !== "0");',
          '',
          'return [{ json: { registered: true, plot_number: String(plot), payments } }];'
        ].join('\n')
      }
    },
    makeRespond(ids.respondPayments, 'Respond Payments', [1680, 920], '={{ JSON.stringify($json) }}'),

    // ===================== UPDATE_CONTACT =====================
    {
      id: ids.extractUpdate,
      name: 'Extract Update Contact',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, 1120],
      parameters: {
        jsCode: [
          'const b = items[0].json.body || items[0].json;',
          'const phone = String(b.phone || b.phone_number || "").trim().replace(/\\s+/g, "");',
          'if (!phone || phone.replace(/\\D/g,"").length < 10) {',
          '  return [{ json: { error: "invalid_phone" } }];',
          '}',
          'return [{ json: {',
          '  telegram_id:  String(b.user_id || b.userId || ""),',
          '  phone,',
          '  updated_at:   new Date().toISOString()',
          '} }];'
        ].join('\n')
      }
    },
    {
      id: ids.updateContact,
      name: 'Update Contact',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 1,
      position: [960, 1120],
      credentials: CRED,
      parameters: {
        authentication: 'oAuth2',
        operation: 'appendOrUpdate',
        sheetId: SHEET_ID,
        range: 'РеестрТелеграм!A:Z',
        options: {}
      }
    },
    makeRespond(ids.respondUpdateOk, 'Respond Update OK', [1200, 1120], '{"success":true}'),

  ],

  // ===================== CONNECTIONS =====================
  connections: {
    'Webhook': { main: [[{ node: 'Router', type: 'main', index: 0 }]] },
    'Router':  { main: [
      [{ node: 'RSS Feed',               type: 'main', index: 0 }],
      [{ node: 'Extract User Check',     type: 'main', index: 0 }],
      [{ node: 'Prep Register',          type: 'main', index: 0 }],
      [{ node: 'Extract User Cabinet',   type: 'main', index: 0 }],
      [{ node: 'Extract User Payments',  type: 'main', index: 0 }],
      [{ node: 'Extract Update Contact', type: 'main', index: 0 }],
    ]},

    // get_news
    'RSS Feed':    { main: [[{ node: 'Format News',   type: 'main', index: 0 }]] },
    'Format News': { main: [[{ node: 'Respond News',  type: 'main', index: 0 }]] },

    // check_user
    'Extract User Check': { main: [[{ node: 'Lookup User',   type: 'main', index: 0 }]] },
    'Lookup User':        { main: [[{ node: 'Format Check',  type: 'main', index: 0 }]] },
    'Format Check':       { main: [[{ node: 'Respond Check', type: 'main', index: 0 }]] },

    // register
    'Prep Register':       { main: [[{ node: 'Lookup Registry',      type: 'main', index: 0 }]] },
    'Lookup Registry':     { main: [[{ node: 'Verify Registration',  type: 'main', index: 0 }]] },
    'Verify Registration': { main: [[{ node: 'Is Valid',             type: 'main', index: 0 }]] },
    'Is Valid': { main: [
      [{ node: 'Write Registration', type: 'main', index: 0 }],
      [{ node: 'Respond Reg Fail',   type: 'main', index: 0 }]
    ]},
    'Write Registration': { main: [[{ node: 'Respond Reg OK', type: 'main', index: 0 }]] },

    // get_cabinet
    'Extract User Cabinet':  { main: [[{ node: 'Lookup Cabinet User',     type: 'main', index: 0 }]] },
    'Lookup Cabinet User':   { main: [[{ node: 'Is Cabinet Registered',   type: 'main', index: 0 }]] },
    'Is Cabinet Registered': { main: [
      [{ node: 'Get Debt',                type: 'main', index: 0 }],
      [{ node: 'Respond Cabinet Not Reg', type: 'main', index: 0 }]
    ]},
    'Get Debt':      { main: [[{ node: 'Format Cabinet',  type: 'main', index: 0 }]] },
    'Format Cabinet': { main: [[{ node: 'Respond Cabinet', type: 'main', index: 0 }]] },

    // get_payments
    'Extract User Payments': { main: [[{ node: 'Lookup Pay User', type: 'main', index: 0 }]] },
    'Lookup Pay User':       { main: [[{ node: 'Get Payments',    type: 'main', index: 0 }]] },
    'Get Payments':          { main: [[{ node: 'Format Payments', type: 'main', index: 0 }]] },
    'Format Payments':       { main: [[{ node: 'Respond Payments',type: 'main', index: 0 }]] },

    // update_contact
    'Extract Update Contact': { main: [[{ node: 'Update Contact',    type: 'main', index: 0 }]] },
    'Update Contact':         { main: [[{ node: 'Respond Update OK', type: 'main', index: 0 }]] },
  },

  settings: { executionOrder: 'v1' }
};

fs.writeFileSync('./MINI_APPS/mini_app_engine_v2.json', JSON.stringify(wf, null, 2));
console.log('Written! Nodes:', wf.nodes.length);
