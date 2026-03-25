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
  // 1. Смотрим структуру лист РеестрСНТ — какие там реально колонки
  console.log('=== Sending register with real plot ===');
  // Попробуем участок 1 с любой фамилией
  const r = await apiReq(WEBHOOK_PATH, 'POST', {
    action: 'register',
    user_id: 'debug_user_001',
    platform: 'max',
    plot: '1',
    surname: 'тест',
    phone: '+79001234567'
  });
  console.log('Status:', r.status, '| Body:', r.body);

  await new Promise(res => setTimeout(res, 2000));

  // 2. Смотрим последнее выполнение
  const execs = await apiReq(`/api/v1/executions?workflowId=${WF_ID}&limit=1`, 'GET');
  const execData = JSON.parse(execs.body);
  const lastExec = execData.data && execData.data[0];
  if (!lastExec) { console.log('No executions'); return; }
  console.log('\nExecution:', lastExec.id, '| status:', lastExec.status);

  const detail = await apiReq(`/api/v1/executions/${lastExec.id}?includeData=true`, 'GET');
  const exec = JSON.parse(detail.body);

  if (exec.data && exec.data.resultData && exec.data.resultData.runData) {
    const runData = exec.data.resultData.runData;
    console.log('\n=== Nodes execution trace ===');
    Object.keys(runData).forEach(nodeName => {
      const task = runData[nodeName][0];
      const error = task && task.error;
      const output = task && task.data && task.data.main;
      if (error) {
        console.log(`[ERR] ${nodeName}: ${error.message}`);
      } else {
        const outStr = output ? JSON.stringify(output).substring(0, 200) : 'no output';
        console.log(`[OK]  ${nodeName}: ${outStr}`);
      }
    });
  }

  // 3. Смотрим ноды Write Registration и Lookup Registry
  console.log('\n=== Workflow nodes: Lookup Registry + Write Registration ===');
  const wfR = await apiReq(`/api/v1/workflows/${WF_ID}`, 'GET');
  const wf = JSON.parse(wfR.body);
  ['Lookup Registry', 'Verify Registration', 'Is Valid', 'Write Registration'].forEach(name => {
    const node = wf.nodes.find(n => n.name === name);
    if (node) {
      console.log(`\n-- ${name} --`);
      console.log(JSON.stringify(node.parameters, null, 2).substring(0, 400));
    } else {
      console.log(`\n-- ${name} -- NOT FOUND`);
    }
  });
})();
