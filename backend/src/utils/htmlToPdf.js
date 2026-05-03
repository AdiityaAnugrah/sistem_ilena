let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;

  let launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };

  let puppeteer;

  if (process.env.CHROME_PATH) {
    // Pakai system Chrome yang di-set manual lewat env
    puppeteer = require('puppeteer-core');
    launchOptions.executablePath = process.env.CHROME_PATH;
  } else {
    try {
      // Coba @sparticuz/chromium — bundle sendiri, cocok untuk server minimal
      const chromium = require('@sparticuz/chromium');
      puppeteer = require('puppeteer-core');
      launchOptions.executablePath = await chromium.executablePath();
      launchOptions.args = [...launchOptions.args, ...chromium.args];
      launchOptions.defaultViewport = chromium.defaultViewport;
    } catch {
      // Fallback ke puppeteer bundled Chrome (dev/local)
      puppeteer = require('puppeteer');
    }
  }

  browserInstance = await puppeteer.launch(launchOptions);
  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
}

async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return pdf;
  } finally {
    await page.close();
  }
}

module.exports = { htmlToPdf };
