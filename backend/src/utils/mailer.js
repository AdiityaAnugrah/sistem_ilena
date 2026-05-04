const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../../../frontend/public/img/logo-invoice.jpg');
const LOGO_EXISTS = fs.existsSync(LOGO_PATH);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,  
  },
});

const COMPANY = {
  name: 'CV. Catur Bhakti Mandiri',
  address: 'Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang',
  color: '#B91C1C',
};

function buildEmailBody({ tipeLabel, nomor, namaCustomer, tanggal, catatan }) {
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-';

  const nowDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tipeLabel} — ${nomor}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0 48px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px;border-radius:14px 14px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${LOGO_EXISTS
                      ? `<img src="cid:company_logo" alt="${COMPANY.name}" style="height:42px;width:auto;display:block;margin-bottom:8px;" />`
                      : ''
                    }
                    <div style="font-size:14px;font-weight:700;color:#0f172a;letter-spacing:0.01em;">${COMPANY.name}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px;line-height:1.5;">${COMPANY.address}</div>
                  </td>
                  <td align="right" style="vertical-align:middle;padding-left:20px;white-space:nowrap;">
                    <div style="background:#B91C1C;border-radius:8px;padding:10px 18px;display:inline-block;text-align:center;">
                      <div style="font-size:9px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Dokumen</div>
                      <div style="font-size:13px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">${tipeLabel}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- accent line -->
          <tr><td style="background:linear-gradient(90deg,#B91C1C,#FA2F2F,#ef4444);height:4px;"></td></tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:36px 36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <!-- Date stamp -->
              <p style="margin:0 0 28px;font-size:12px;color:#94a3b8;">${nowDate}</p>

              <!-- Salutation -->
              <p style="margin:0 0 3px;font-size:13px;color:#64748b;">Kepada Yth.</p>
              <p style="margin:0 0 22px;font-size:16px;font-weight:700;color:#0f172a;">${namaCustomer || 'Pelanggan yang Terhormat'}</p>

              <p style="margin:0 0 6px;font-size:14px;color:#475569;line-height:1.9;">Dengan hormat,</p>
              <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.9;">
                Bersama email ini, kami menyampaikan <strong style="color:#0f172a;">${tipeLabel}</strong> sebagai
                dokumen resmi atas transaksi Anda bersama <strong style="color:#0f172a;">${COMPANY.name}</strong>.
                Dokumen dimaksud terlampir dalam format PDF dan dapat Anda unduh melalui lampiran email ini.
              </p>

              <!-- Document info card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="background:#f8fafc;padding:12px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.09em;">Informasi Dokumen</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:16px 20px 14px;border-bottom:1px solid #f1f5f9;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Nomor Dokumen</div>
                    <div style="font-size:17px;font-weight:800;color:#0f172a;font-family:'Courier New',Courier,monospace;letter-spacing:0.03em;">${nomor}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;width:50%;border-right:1px solid #f1f5f9;vertical-align:top;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Jenis Dokumen</div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">${tipeLabel}</div>
                  </td>
                  <td style="padding:14px 20px;width:50%;vertical-align:top;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Tanggal Dokumen</div>
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">${tgl}</div>
                  </td>
                </tr>
              </table>

              <!-- PDF notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:11px;vertical-align:top;">
                          <div style="width:22px;height:22px;background:#0ea5e9;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#fff;">i</div>
                        </td>
                        <td>
                          <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:3px;">Lampiran PDF</div>
                          <div style="font-size:12px;color:#0369a1;line-height:1.7;">
                            File PDF <strong>${tipeLabel} ${nomor}</strong> tersedia sebagai lampiran pada email ini.
                            Mohon unduh dan simpan dokumen tersebut untuk keperluan administrasi Anda.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${catatan ? `
              <!-- Notes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <div style="font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Catatan</div>
                    <div style="font-size:13px;color:#78350f;line-height:1.7;">${catatan}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Closing -->
              <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.9;">
                Apabila terdapat pertanyaan atau hal-hal yang perlu dikonfirmasi mengenai dokumen ini,
                jangan ragu untuk menghubungi kami.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.9;">
                Atas perhatian dan kepercayaan Bapak/Ibu, kami mengucapkan terima kasih.
              </p>

              <p style="margin:0 0 3px;font-size:14px;color:#475569;">Hormat kami,</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${COMPANY.name}</p>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#1e293b;padding:22px 32px 26px;border-radius:0 0 14px 14px;">
              <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">${COMPANY.name}</div>
              <div style="font-size:11px;color:#94a3b8;line-height:1.7;margin-bottom:14px;">${COMPANY.address}</div>
              <div style="border-top:1px solid #334155;padding-top:12px;">
                <span style="font-size:10px;color:#64748b;">Email ini dikirim secara otomatis oleh sistem. Mohon tidak membalas email ini langsung.</span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendDocumentEmail({ to, subject, tipeLabel, nomor, namaCustomer, tanggal, catatan, pdfBuffer, pdfFilename }) {
  const html = buildEmailBody({ tipeLabel, nomor, namaCustomer, tanggal, catatan });

  const attachments = [];
  if (LOGO_EXISTS) {
    attachments.push({
      filename: 'logo.jpg',
      path: LOGO_PATH,
      cid: 'company_logo',
    });
  }
  if (pdfBuffer) {
    attachments.push({
      filename: pdfFilename || `${nomor}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${COMPANY.name}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  });
}

function buildAccountEmailBody({ eventType, username, namaLengkap, setupLink, adminName, changes }) {
  const nowDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const displayName = namaLengkap || username;

  const EVENT = {
    setup: {
      badge: 'Aktivasi Akun', badgeColor: '#059669',
      heading: `Selamat datang, ${displayName}!`,
      body: `Akun Anda di sistem <strong>${COMPANY.name}</strong> telah dibuat oleh administrator. Untuk mulai menggunakan sistem, Anda perlu mengatur kata sandi terlebih dahulu dengan menekan tombol di bawah ini.`,
      extra: `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td align="center">
              <a href="${setupLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">Atur Kata Sandi Saya</a>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;margin-bottom:24px;">
          <tr><td style="padding:12px 16px;font-size:12px;color:#854d0e;line-height:1.7;">⚠ Link ini hanya dapat digunakan satu kali. Setelah kata sandi diatur, link ini tidak dapat digunakan kembali. Jangan bagikan link ini kepada siapapun.</td></tr>
        </table>`,
    },
    activated: {
      badge: 'Akun Diaktifkan', badgeColor: '#059669',
      heading: `Akun Anda Telah Diaktifkan Kembali`,
      body: `Halo <strong>${displayName}</strong>, akun Anda di sistem <strong>${COMPANY.name}</strong> telah <strong style="color:#059669;">diaktifkan kembali</strong> oleh administrator. Anda sekarang dapat masuk ke sistem menggunakan username dan kata sandi Anda.`,
      extra: '',
    },
    deactivated: {
      badge: 'Akun Dinonaktifkan', badgeColor: '#dc2626',
      heading: `Akun Anda Telah Dinonaktifkan`,
      body: `Halo <strong>${displayName}</strong>, akun Anda di sistem <strong>${COMPANY.name}</strong> telah <strong style="color:#dc2626;">dinonaktifkan sementara</strong> oleh administrator. Anda tidak dapat masuk ke sistem hingga akun diaktifkan kembali.`,
      extra: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:12px 16px;font-size:13px;color:#991b1b;line-height:1.7;">Jika Anda merasa ini adalah kesalahan atau memerlukan informasi lebih lanjut, silahkan hubungi administrator sistem.</td></tr></table>`,
    },
    updated: {
      badge: 'Pembaruan Akun', badgeColor: '#0369a1',
      heading: `Informasi Akun Anda Telah Diperbarui`,
      body: `Halo <strong>${displayName}</strong>, informasi akun Anda di sistem <strong>${COMPANY.name}</strong> telah diperbarui oleh administrator.`,
      extra: (changes && changes.length > 0) ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;overflow:hidden;">
          <tr><td colspan="2" style="background:#f8fafc;padding:10px 16px;border-bottom:1px solid #e2e8f0;"><span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.09em;">Perubahan yang Dilakukan</span></td></tr>
          ${changes.map(c => `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">${c}</td></tr>`).join('')}
        </table>` : '',
    },
    deleted: {
      badge: 'Akun Dihapus', badgeColor: '#dc2626',
      heading: `Akun Anda Telah Dihapus`,
      body: `Halo <strong>${displayName}</strong>, akun <strong>${username}</strong> Anda di sistem <strong>${COMPANY.name}</strong> telah <strong style="color:#dc2626;">dihapus secara permanen</strong> oleh administrator.`,
      extra: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:12px 16px;font-size:13px;color:#991b1b;line-height:1.7;">Jika Anda merasa ini adalah kesalahan, segera hubungi administrator sistem.</td></tr></table>`,
    },
  };

  const ev = EVENT[eventType] || EVENT.updated;
  const adminLine = adminName
    ? `<p style="margin:0 0 24px;font-size:12px;color:#94a3b8;">Tindakan dilakukan oleh: <strong style="color:#64748b;">${adminName}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${ev.badge}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0 48px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:24px 32px;border-radius:14px 14px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  ${LOGO_EXISTS ? `<img src="cid:company_logo" alt="${COMPANY.name}" style="height:42px;width:auto;display:block;margin-bottom:8px;"/>` : ''}
                  <div style="font-size:14px;font-weight:700;color:#0f172a;">${COMPANY.name}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${COMPANY.address}</div>
                </td>
                <td align="right" style="vertical-align:middle;padding-left:20px;white-space:nowrap;">
                  <div style="background:${ev.badgeColor};border-radius:8px;padding:10px 18px;display:inline-block;text-align:center;">
                    <div style="font-size:9px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Notifikasi</div>
                    <div style="font-size:12px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">${ev.badge}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="background:linear-gradient(90deg,${ev.badgeColor},${ev.badgeColor}cc);height:4px;"></td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 36px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 28px;font-size:12px;color:#94a3b8;">${nowDate}</p>
            <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#0f172a;">${ev.heading}</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.9;">${ev.body}</p>
            ${ev.extra}
            ${adminLine}
            <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.9;">Apabila ada pertanyaan, jangan ragu untuk menghubungi administrator sistem.</p>
            <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.9;">Terima kasih atas perhatian Anda.</p>
            <p style="margin:0 0 3px;font-size:14px;color:#475569;">Hormat kami,</p>
            <p style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">${COMPANY.name}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e293b;padding:22px 32px 26px;border-radius:0 0 14px 14px;">
            <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:4px;">${COMPANY.name}</div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.7;margin-bottom:14px;">${COMPANY.address}</div>
            <div style="border-top:1px solid #334155;padding-top:12px;">
              <span style="font-size:10px;color:#64748b;">Email ini dikirim secara otomatis oleh sistem. Mohon tidak membalas email ini langsung.</span>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendAccountEmail({ to, username, namaLengkap, eventType, setupLink, adminName, changes }) {
  const subjects = {
    setup: `[${COMPANY.name}] Aktivasi Akun — Atur Kata Sandi Anda`,
    activated: `[${COMPANY.name}] Akun Anda Telah Diaktifkan Kembali`,
    deactivated: `[${COMPANY.name}] Akun Anda Dinonaktifkan Sementara`,
    updated: `[${COMPANY.name}] Informasi Akun Anda Telah Diperbarui`,
    deleted: `[${COMPANY.name}] Akun Anda Telah Dihapus`,
  };

  const html = buildAccountEmailBody({ eventType, username, namaLengkap, setupLink, adminName, changes });
  const attachments = [];
  if (LOGO_EXISTS) {
    attachments.push({ filename: 'logo.jpg', path: LOGO_PATH, cid: 'company_logo' });
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${COMPANY.name}" <${process.env.SMTP_USER}>`,
    to,
    subject: subjects[eventType] || subjects.updated,
    html,
    attachments,
  });
}

module.exports = { sendDocumentEmail, sendAccountEmail, transporter };
