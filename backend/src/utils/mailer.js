const nodemailer = require('nodemailer');

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
  shortName: 'ILENA',
  address: 'Kawasan Industri BSB, A 3A, 5-6 Jatibarang, Mijen, Semarang',
  phone: '',
  color: '#FA2F2F',
};

function buildEmailBody({ tipeLabel, nomor, namaCustomer, tanggal, catatan }) {
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tipeLabel} — ${nomor}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c41c1c,#FA2F2F);padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${COMPANY.shortName}</div>
                    <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;letter-spacing:0.04em;text-transform:uppercase;">${COMPANY.name}</div>
                  </td>
                  <td align="right">
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 14px;">
                      <div style="font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">Dokumen</div>
                      <div style="font-size:13px;color:#fff;font-weight:700;margin-top:1px;">${tipeLabel}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Yth. <strong style="color:#0f172a;">${namaCustomer || 'Pelanggan'}</strong>,<br/>
                Berikut kami lampirkan <strong>${tipeLabel}</strong> sebagai dokumen resmi dari transaksi Anda bersama ${COMPANY.name}.
              </p>

              <!-- Document info card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;border-bottom:1px solid #f1f5f9;">
                          <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Nomor Dokumen</span>
                          <div style="font-size:15px;font-weight:800;color:#0f172a;font-family:monospace;margin-top:2px;">${nomor}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 5px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:50%;padding-right:12px;">
                                <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Tipe</span>
                                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${tipeLabel}</div>
                              </td>
                              <td style="width:50%;">
                                <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Tanggal</span>
                                <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;">${tgl}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
                Dokumen <strong>${tipeLabel} ${nomor}</strong> terlampir dalam format PDF pada email ini.
                Silakan buka lampiran untuk melihat dan menyimpan dokumen secara lengkap.
              </p>
              ${catatan ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;line-height:1.6;padding:12px 14px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;"><strong>Catatan:</strong> ${catatan}</p>` : ''}
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:24px 32px 0;"><div style="height:1px;background:#f1f5f9;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                Hubungi kami jika ada pertanyaan mengenai dokumen ini.
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                ${COMPANY.address}
              </p>
              <div style="margin-top:16px;padding-top:14px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;font-weight:800;color:${COMPANY.color};">${COMPANY.shortName}</span>
                <span style="font-size:11px;color:#cbd5e1;">·</span>
                <span style="font-size:11px;color:#94a3b8;">Dikirim otomatis oleh sistem. Mohon tidak membalas email ini.</span>
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

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${COMPANY.name}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: pdfBuffer ? [{
      filename: pdfFilename || `${nomor}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }] : [],
  });
}

module.exports = { sendDocumentEmail, transporter };
