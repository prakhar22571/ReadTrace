const SHARED_STYLE = `
  :root { color-scheme: light dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 0;
    background: #f6f7f9;
    color: #202124;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #17181a; color: #e8eaed; }
  }
`;

export function loginPage(error?: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ReadTrace Dashboard</title>
<style>
${SHARED_STYLE}
  .wrap { max-width: 360px; margin: 15vh auto 0; padding: 32px; }
  h1 { font-size: 18px; margin: 0 0 20px; }
  input[type="password"] {
    width: 100%; padding: 10px; font-size: 14px; box-sizing: border-box;
    border: 1px solid #ccc; border-radius: 6px;
  }
  button {
    margin-top: 12px; width: 100%; padding: 10px; font-size: 14px;
    background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer;
  }
  .error { color: #d93025; font-size: 13px; margin-top: 10px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>ReadTrace Dashboard</h1>
    <form method="POST" action="/dashboard/login">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Log in</button>
      ${error ? `<div class="error">${error}</div>` : ""}
    </form>
  </div>
</body>
</html>`;
}

export function dashboardPage(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ReadTrace Dashboard</title>
<style>
${SHARED_STYLE}
  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 24px; border-bottom: 1px solid rgba(128,128,128,0.25);
  }
  h1 { font-size: 16px; margin: 0; }
  button.logout {
    background: none; border: 1px solid rgba(128,128,128,0.4); border-radius: 6px;
    padding: 6px 12px; font-size: 12px; cursor: pointer; color: inherit;
  }
  .stats { display: flex; gap: 24px; padding: 20px 24px; flex-wrap: wrap; }
  .stat { min-width: 120px; }
  .stat .value { font-size: 24px; font-weight: 600; }
  .stat .label { font-size: 12px; opacity: 0.7; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 10px 24px; border-bottom: 1px solid rgba(128,128,128,0.15); }
  th { font-weight: 600; opacity: 0.7; font-size: 11px; text-transform: uppercase; }
  .opened { color: #1a73e8; }
  .unopened { opacity: 0.6; }
  #empty { padding: 40px 24px; opacity: 0.6; font-size: 13px; }
</style>
</head>
<body>
  <header>
    <h1>ReadTrace Dashboard</h1>
    <form method="POST" action="/dashboard/logout"><button class="logout" type="submit">Log out</button></form>
  </header>
  <div class="stats" id="stats"></div>
  <table id="table" style="display:none">
    <thead>
      <tr><th>Subject</th><th>From</th><th>Recipients</th><th>Sent</th><th>Status</th><th>Clicks</th></tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>
  <div id="empty" style="display:none">No tracked emails yet.</div>
  <script>
    fetch('/dashboard/api/emails')
      .then(r => r.json())
      .then(data => {
        const emails = data.emails || [];
        const opened = emails.filter(e => e.openCount > 0).length;
        const clicks = emails.reduce((sum, e) => sum + e.clickCount, 0);

        document.getElementById('stats').innerHTML = [
          ['Tracked emails', emails.length],
          ['Opened', opened],
          ['Open rate', emails.length ? Math.round((opened / emails.length) * 100) + '%' : '—'],
          ['Total link clicks', clicks],
        ].map(([label, value]) =>
          '<div class="stat"><div class="value">' + value + '</div><div class="label">' + label + '</div></div>'
        ).join('');

        if (emails.length === 0) {
          document.getElementById('empty').style.display = 'block';
          return;
        }

        document.getElementById('table').style.display = 'table';
        document.getElementById('rows').innerHTML = emails.map(e => {
          const opened = e.openCount > 0;
          const status = opened
            ? '<span class="opened">✓✓ Opened ' + e.openCount + 'x</span>'
            : '<span class="unopened">✓ Not opened</span>';
          const recipients = escapeHtml(e.recipients) + (e.isReply ? ' <span style="opacity:0.6">(reply)</span>' : '');
          return '<tr>' +
            '<td>' + escapeHtml(e.subject) + '</td>' +
            '<td>' + escapeHtml(e.sender || '—') + '</td>' +
            '<td>' + recipients + '</td>' +
            '<td>' + escapeHtml(e.sentAt) + '</td>' +
            '<td>' + status + '</td>' +
            '<td>' + e.clickCount + '</td>' +
          '</tr>';
        }).join('');
      });

    function escapeHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
}
