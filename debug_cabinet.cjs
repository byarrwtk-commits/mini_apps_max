const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjOTIxYzI0NS1iYzM4LTRlOWQtODFhMi0wYTgxZTQ3MTRjMTgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczMzk0MDYxfQ.oTFzo6IL3M3oX4JyTm9XYg7B6lSU30Zpnh6uqznzUr8';
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
  // Отправляем get_cabinet
  console.log('Sending get_cabinet...');
  const t = await apiReq(WEBHOOK_PATH, 'POST', { action: 'get_cabinet', user_id: 'test_user_123', platform: 'max' });
  console.log('Response:', t.status, '|', t.body || '(empty)');

  await new Promise(r => setTimeout(r, 2000));

  // Получаем последнее выполнение
  const execs = await apiReq('/api/v1/executions?workflowId=scjuXWA1W93tIFCU&limit=1', 'GET');
  const execData = JSON.parse(execs.body);
  const lastExec = execData.data && execData.data[0];
  if (!lastExec) { console.log('No executions'); return; }

  console.log('\nExecution:', lastExec.id, '| status:', lastExec.status);

  // Детали выполнения
  const detail = await apiReq(`/api/v1/executions/${lastExec.id}?includeData=true`, 'GET');
  const exec = JSON.parse(detail.body);

  if (exec.data && exec.data.resultData && exec.data.resultData.runData) {
    const runData = exec.data.resultData.runData;
    console.log('\n=== Nodes that ran ===');
    Object.keys(runData).forEach(nodeName => {
      const nodeData = runData[nodeName];
      const task = nodeData[0];
      const error = task && task.error;
      const output = task && task.data && task.data.main && task.data.main[0];
      const outputStr = output ? JSON.stringify(output).substring(0, 150) : 'NO OUTPUT';
      if (error) {
        console.log(`[ERROR] ${nodeName}: ${error.message}`);
      } else {
        console.log(`[OK] ${nodeName}: ${outputStr}`);
      }
    });
  } else if (exec.data && exec.data.resultData && exec.data.resultData.error) {
    console.log('Global error:', exec.data.resultData.error);
  } else {
    console.log('Raw exec data:', JSON.stringify(exec).substring(0, 500));
  }
})();
