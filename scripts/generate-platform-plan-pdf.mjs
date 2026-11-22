import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const sourcePath = path.join(root, 'docs', 'souqi-platform-development-plan.md');
const pdfPath = path.join(root, 'docs', 'souqi-project-guide-ar.pdf');
const mockupDirectory = path.join(root, 'docs', 'souqi-future-interface-concepts');
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const markdown = await readFile(sourcePath, 'utf8');
const mockupFiles = (await readdir(mockupDirectory)).filter((file) => file.endsWith('.png')).sort();
if (mockupFiles.length === 0) throw new Error('No future interface concepts were found. Run scripts/generate-platform-mockups.mjs first.');
const mockupPages = (await Promise.all(mockupFiles.map(async (file, index) => {
  const image = await readFile(path.join(mockupDirectory, file));
  const id = file.replace(/^\d+-/, '').replace(/\.png$/, '');
  const concept = getConceptDetails(id) ?? { title: id.replaceAll('-', ' '), description: 'تصور مرئي مستقبلي لإحدى لوحات المنصة.' };
  return `<section class="concept-page"><div class="concept-heading"><span>تصور واجهة مستقبلية ${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(concept.title)}</h2><p>${escapeHtml(concept.description)}</p></div><img src="data:image/png;base64,${image.toString('base64')}" alt="${escapeHtml(concept.title)} - تصور مستقبلي"><div class="concept-caption">هذه صورة تصورية ببيانات اصطناعية، وليست شاشة منفذة أو متصلة بخدمات فعلية.</div></section>`;
}))).join('');
const htmlPathDirectory = await mkdtemp(path.join(tmpdir(), 'souqi-plan-pdf-'));
const htmlPath = path.join(htmlPathDirectory, 'plan.html');
const port = await findAvailablePort();
const profilePath = path.join(htmlPathDirectory, 'chrome-profile');
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profilePath}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
let socket;
let commandId = 0;
const pending = new Map();

try {
  await waitForChrome();
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await targetResponse.json();
  const page = targets.find((target) => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome page target was not found.');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.error) request.reject(new Error(`${request.method}: ${JSON.stringify(response.error)}`));
    else request.resolve(response.result);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await writeFile(htmlPath, createHtml(markdown, mockupPages), 'utf8');
  await send('Page.navigate', { url: pathToFileURL(htmlPath).href });
  await waitForDocument();
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false,
  });
  await delay(500);
  const output = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font:8px Tahoma;color:#68756d;width:100%;text-align:center;direction:rtl">سوقي | خطة تطوير المنصة · صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></div>',
    transferMode: 'ReturnAsBase64',
  });
  const pdfBytes = Buffer.from(output.data, 'base64');
  if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Chrome did not return a valid PDF.');
  await writeFile(pdfPath, pdfBytes);
  console.log(`Created ${pdfPath} (${pdfBytes.length} bytes)`);
} finally {
  if (socket) socket.close();
  if (chrome.exitCode === null) {
    chrome.kill();
    await Promise.race([new Promise((resolve) => chrome.once('close', resolve)), delay(3000)]);
  }
  await rm(htmlPathDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

async function findAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port: availablePort } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return availablePort;
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {}
    if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}.`);
    await delay(250);
  }
  throw new Error('Timed out waiting for Chrome remote debugging.');
}

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { method, resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForDocument() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (response.result?.value === 'complete') break;
    await delay(100);
  }
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
  await delay(300);
}

function createHtml(source, mockupPages) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>خطة تطوير منصة سوقي</title><style>
@page { size: A4; margin: 17mm 17mm 19mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; direction: rtl; color: #23332a; font: 10.2pt/1.72 Tahoma, "Segoe UI", sans-serif; }
body { background: white; }
h1 { color: #174e38; font-size: 25pt; line-height: 1.35; margin: 0 0 8mm; page-break-after: avoid; }
h2 { color: #19553b; font-size: 16pt; line-height: 1.4; margin: 9mm 0 3mm; padding: 0 0 2mm; border-bottom: 1px solid #d5e0d6; page-break-after: avoid; }
h3 { color: #2a694b; font-size: 12pt; margin: 6mm 0 2mm; page-break-after: avoid; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
strong { color: #263d30; }
blockquote { margin: 0 0 7mm; padding: 3mm 4mm; border-right: 3px solid #d9a45b; background: #f7f5ed; color: #536157; }
ul, ol { margin: 1mm 0 4mm; padding-right: 7mm; }
li { padding-right: 1mm; margin-bottom: 1.4mm; }
code { direction: ltr; unicode-bidi: isolate; font: 9pt Consolas, monospace; color: #24553e; background: #f0f3ef; padding: 0 1mm; }
hr { border: 0; border-top: 1px solid #dce4dc; margin: 6mm 0; }
.concept-intro { break-before: page; min-height: 250mm; display: flex; flex-direction: column; justify-content: center; }
.concept-intro h1 { font-size: 24pt; }
.concept-intro .notice { margin-top: 8mm; padding: 5mm; border-right: 4px solid #d9a45b; background: #f7f5ed; }
.concept-page { break-before: page; break-after: page; min-height: 250mm; page-break-inside: avoid; }
.concept-heading { margin-bottom: 5mm; border-bottom: 1px solid #d5e0d6; padding-bottom: 3mm; }
.concept-heading span { color: #96713a; font-size: 9pt; font-weight: bold; }
.concept-heading h2 { margin: 1mm 0 2mm; border: 0; font-size: 18pt; }
.concept-heading p { color: #65736a; font-size: 9pt; }
.concept-page img { display: block; width: 100%; max-height: 184mm; object-fit: contain; object-position: top center; border: 1px solid #dfe5dd; }
.concept-caption { margin-top: 3mm; color: #83704e; font-size: 8.5pt; text-align: center; }
@media print { h1, h2, h3 { break-after: avoid; } table, pre, blockquote { break-inside: avoid; } }
</style></head><body>${markdownToHtml(source)}<section class="concept-intro"><span style="color:#98733b;font-weight:bold">مرفق بصري · ${mockupFiles.length} شاشة</span><h1>تصورات واجهات المنصة المستقبلية</h1><p>تعرض الصفحات التالية نماذج مرئية مقترحة للوحات التحكم والشاشات الفرعية ومسارات العمل التي ستُطوّر وفق نطاق الخطة. صُممت لتوضيح بنية المعلومات واتجاه التصميم العربي RTL، ويمكن تعديلها بعد اعتماد البحث وتجارب المستخدم.</p><div class="notice"><strong>تنبيه:</strong> هذه الصور تصورات تصميمية مستقبلية ببيانات اصطناعية. لا تمثل وظائف أو شاشات منفذة في التطبيق الحالي، ولا تعني اعتماد الشكل النهائي قبل مراجعة المستخدمين والفريق.</div></section>${mockupPages}</body></html>`;
}

function getConceptDetails(id) {
  return ({
  'buyer-dashboard': { title: 'لوحة المشتري', description: 'مؤشرات طلبات التوريد والعروض والقرارات القادمة.' },
  'buyer-rfq': { title: 'منشئ طلب عروض الأسعار', description: 'نموذج قطاعي لإنشاء RFQ وحفظه ومراجعة متطلباته.' },
  'buyer-matching': { title: 'مطابقة المصانع والدعوات', description: 'مرشحون وأسباب ملاءمة قابلة للتفسير وإدارة الدعوات.' },
  'buyer-quotes': { title: 'مقارنة عروض الموردين', description: 'مقارنة تفصيلية للسعر والكمية والمهلة والصلاحية.' },
  'supplier-dashboard': { title: 'لوحة المصنع والمورد', description: 'صندوق الدعوات والعروض والأوامر وحالة المنشأة.' },
  'supplier-profile': { title: 'ملف المصنع والقدرات', description: 'إدارة العمليات والمواد والحد الأدنى والطاقة ومصدر البيانات.' },
  'verification-queue': { title: 'طابور التحقق والمراجعة', description: 'توزيع حالات التحقق والمراجعة ومواعيد الاستجابة.' },
  'verification-detail': { title: 'ملف التحقق وقرار المراجع', description: 'قائمة تدقيق الوثائق والقرار ونطاقه وتاريخ صلاحيته.' },
  'admin-dashboard': { title: 'لوحة إدارة المنصة', description: 'التشغيل اليومي وطوابير العمل وتنبيهات سلامة الخدمة.' },
  'schema-admin': { title: 'إدارة القطاعات والنماذج', description: 'تحرير وإصدار مخططات القطاعات دون تغيير الطلبات المنشورة.' },
  'quality-production': { title: 'متابعة الجودة والإنتاج', description: 'مراحل أمر التوريد والأدلة والفحص والتغييرات.' },
  'contracts-files': { title: 'مركز العقود والملفات', description: 'ملفات خاصة واتفاقيات وصلاحيات وصول وسجل مستندات.' },
  'finance-reconciliation': { title: 'المالية والتسوية', description: 'مطابقة مرجعية مع مزود الدفع، مشروطة بالمراجعة القانونية.' },
  'disputes-support': { title: 'النزاعات والدعم', description: 'ملف حالة وأدلة وأطراف وخطوات قرار واستئناف.' },
  analytics: { title: 'التحليلات والتقارير', description: 'مؤشرات مجمعة وتحويلات الطلبات وتقارير محكومة بالصلاحيات.' },
  'public-home': { title: 'بوابة سوقي العامة', description: 'بوابة تعريفية للمنصة والقطاعات ورحلة التوريد.' },
  'supplier-directory': { title: 'دليل المصانع والموردين', description: 'بحث في الملفات العامة والقدرات المنشورة للموردين.' },
  'auth-login': { title: 'تسجيل الدخول', description: 'الوصول الآمن إلى مساحة المؤسسة والحساب.' },
  'auth-register': { title: 'إنشاء حساب ومؤسسة', description: 'تسجيل مستخدم جديد واختيار نوع المؤسسة.' },
  'organization-setup': { title: 'تهيئة المؤسسة', description: 'إدخال البيانات القانونية والتشغيلية للمنشأة.' },
  'invite-acceptance': { title: 'قبول دعوة المؤسسة', description: 'مراجعة المؤسسة والدور والصلاحيات قبل الانضمام.' },
  'buyer-rfq-list': { title: 'قائمة طلبات التوريد', description: 'البحث والتصفية في طلبات المؤسسة بحسب الحالة.' },
  'buyer-rfq-detail': { title: 'تفاصيل طلب عروض الأسعار', description: 'مواصفات RFQ والمرفقات وحالة استقبال العروض.' },
  'rfq-invitations': { title: 'إدارة دعوات المصانع', description: 'توزيع الطلب ومتابعة الردود والمواعيد.' },
  'supplier-quote-editor': { title: 'إعداد عرض سعر للمصنع', description: 'بناء عرض تجاري مفصل وحفظ مراجعاته.' },
  'quote-detail': { title: 'تفاصيل العرض ومراجعته', description: 'تفصيل عناصر السعر والمهلة والاستثناءات.' },
  'sample-approval': { title: 'مراجعة واعتماد العينة', description: 'فحص نسخة محددة وتسجيل قرار المشتري.' },
  'purchase-order-detail': { title: 'أمر التوريد والشروط المعتمدة', description: 'الشروط التجارية والوثائق المرتبطة بأمر التوريد.' },
  'production-order-detail': { title: 'تفاصيل أمر الإنتاج', description: 'الجدول الزمني للمراحل والمسؤولين والأدلة.' },
  'milestone-update': { title: 'تحديث مرحلة إنتاج', description: 'تسجيل تقدم المرحلة والتاريخ والدليل.' },
  'quality-inspection': { title: 'تقرير فحص الجودة', description: 'نتائج نقاط الفحص والإجراءات التصحيحية.' },
  'message-thread': { title: 'محادثة مرتبطة بالطلب', description: 'مراسلات الأطراف والمرفقات ضمن سياق RFQ.' },
  'agreement-review': { title: 'مراجعة اتفاقية التوريد', description: 'بنود الاتفاق والنسخة وحالة التوقيع.' },
  'members-roles': { title: 'أعضاء المؤسسة والصلاحيات', description: 'دعوات الفريق والأدوار وحالة العضوية.' },
  'notification-center': { title: 'مركز الإشعارات والمهام', description: 'التنبيهات والإجراءات المطلوبة وتفضيلات الإرسال.' },
  'admin-user-management': { title: 'إدارة الحسابات والمؤسسات', description: 'إدارة محدودة للحسابات مع أثر تدقيق.' },
  'audit-log': { title: 'سجل التدقيق', description: 'مراجعة الأحداث الحساسة والقرارات المسجلة.' },
  'payment-detail': { title: 'تفاصيل عملية الدفع', description: 'سجل حالة مرجعي وأحداث مزود الدفع.' },
  'dispute-case': { title: 'تفاصيل النزاع والقرار', description: 'الأدلة والردود والقرار ومسار الاعتراض.' },
  'support-inbox': { title: 'صندوق طلبات الدعم', description: 'تعيين الحالات ومتابعة الأولوية ووقت الاستجابة.' },
  'analytics-report': { title: 'تفصيل تقرير أداء التوريد', description: 'مؤشرات القطاع والتحويلات ومنهجية الاحتساب.' },
  })[id];
}

function markdownToHtml(source) {
  const lines = source.split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let listType = null;

  const closeParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeParagraph();
      closeList();
      continue;
    }
    if (/^---+$/.test(line)) {
      closeParagraph(); closeList(); output.push('<hr>'); continue;
    }
    if (line.startsWith('>')) {
      closeParagraph(); closeList();
      output.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (ordered || unordered) {
      closeParagraph();
      const targetList = ordered ? 'ol' : 'ul';
      if (listType !== targetList) {
        closeList();
        output.push(`<${targetList}>`);
        listType = targetList;
      }
      output.push(`<li>${inline((ordered ?? unordered)[1])}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }
  closeParagraph();
  closeList();
  return output.join('\n');
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
