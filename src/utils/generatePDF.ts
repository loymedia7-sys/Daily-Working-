import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActivityRecord, DailyReportRecord, UserProfile } from '../types';

/**
 * Loads an image URL or data URI onto an HTML5 Canvas and returns a clean JPEG data URL
 * along with its natural aspect ratio so jsPDF can embed actual photograph pixels reliably.
 */
async function loadPhotoForPdf(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      try {
        const maxDim = 900;
        let w = img.naturalWidth || 600;
        let h = img.naturalHeight || 450;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: w,
          height: h,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renders bilingual text (including Noto Sans Khmer Unicode characters) onto a high-DPI canvas
 * and returns a PNG data URL so that Khmer script never garbles inside standard jsPDF fonts.
 */
function renderBilingualTextToImage(
  text: string,
  options: {
    fontSizePx?: number;
    fontWeight?: string;
    color?: string;
    maxWidthMm?: number;
  } = {}
): { dataUrl: string; widthMm: number; heightMm: number } {
  const fontSizePx = options.fontSizePx || 14;
  const fontWeight = options.fontWeight || '600';
  const color = options.color || '#0F172A';
  const maxWidthMm = options.maxWidthMm || 175;
  const scale = 3; // High-DPI rendering for crisp print output
  const pxPerMm = 3.78;
  const maxCanvasWidth = Math.round(maxWidthMm * pxPerMm);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fontStack = `${fontWeight} ${fontSizePx}px "Noto Sans Khmer", "Plus Jakarta Sans", sans-serif`;
  ctx.font = fontStack;

  // Word-wrap text across lines
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxCanvasWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length === 0) lines.push(' ');

  const lineHeightPx = Math.round(fontSizePx * 1.65);
  const totalHeightPx = lines.length * lineHeightPx + 6;

  canvas.width = maxCanvasWidth * scale;
  canvas.height = totalHeightPx * scale;

  const drawCtx = canvas.getContext('2d')!;
  drawCtx.scale(scale, scale);
  drawCtx.font = fontStack;
  drawCtx.fillStyle = color;
  drawCtx.textBaseline = 'top';

  lines.forEach((line, idx) => {
    drawCtx.fillText(line, 0, idx * lineHeightPx + 2);
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: maxWidthMm,
    heightMm: totalHeightPx / pxPerMm,
  };
}

function containsNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

export async function generateDailyWorkPdf(params: {
  profile: UserProfile;
  workDate: string;
  activities: ActivityRecord[];
  report?: DailyReportRecord | null;
  summaryText?: string;
  workingHours?: number;
}): Promise<void> {
  const { profile, workDate, activities, report, summaryText, workingHours } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  let y = 16;

  // 1. Header Banner (Dark Navy Accent Header)
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text((profile.companyName || 'DAILYWORK ENTERPRISE').toUpperCase(), margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('DAILY WORK ACTIVITY & PHOTO REPORT', margin + 6, y + 16);

  // Khmer subtitle rendered cleanly via high-DPI canvas image
  const khmerHeader = renderBilingualTextToImage('របាយការណ៍ការងារប្រចាំថ្ងៃ', {
    fontSizePx: 12,
    fontWeight: '600',
    color: '#93C5FD',
    maxWidthMm: 75,
  });
  doc.addImage(khmerHeader.dataUrl, 'PNG', margin + 6, y + 17.5, khmerHeader.widthMm, khmerHeader.heightMm);

  // Date & Status on right side of header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`DATE: ${workDate}`, pageWidth - margin - 6, y + 10, { align: 'right' });

  const statusLabel = (report?.status || 'draft').toUpperCase().replace('_', ' ');
  doc.setFontSize(9);
  doc.setTextColor(96, 165, 250);
  doc.text(`STATUS: ${statusLabel}`, pageWidth - margin - 6, y + 18, { align: 'right' });

  y += 32;

  // 2. Employee & Report Metadata Table
  const totalPhotos = activities.reduce((sum, a) => sum + (a.photos?.length || 0), 0);
  const hoursVal = workingHours ?? report?.workingHours ?? 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
    },
    body: [
      [
        { content: 'EMPLOYEE', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        profile.fullName || 'Employee',
        { content: 'DEPARTMENT', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        profile.department || 'General',
      ],
      [
        { content: 'POSITION', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        profile.position || 'Staff',
        { content: 'MANAGER', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        profile.managerName || 'Assigned Manager',
      ],
      [
        { content: 'ACTIVITIES', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        `${activities.length} Recorded`,
        { content: 'PHOTOS / HOURS', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        `${totalPhotos} Photos  |  ${hoursVal} hrs`,
      ],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 3. Activities Section Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('RECORDED WORK ACTIVITIES & PHOTO EVIDENCE', margin, y);
  y += 5;

  // Iterate through each activity and embed description + actual photographs
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];

    if (y > pageHeight - 65) {
      doc.addPage();
      y = 18;
    }

    // Activity Title Bar
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, 'FD');

    const timeRange = act.endTime ? `${act.startTime} - ${act.endTime}` : act.startTime;
    const indexStr = String(i + 1).padStart(2, '0');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(37, 99, 235);
    doc.text(`#${indexStr}`, margin + 3, y + 6);

    if (containsNonAscii(act.title)) {
      const titleImg = renderBilingualTextToImage(act.title, {
        fontSizePx: 12,
        fontWeight: '700',
        color: '#0F172A',
        maxWidthMm: 110,
      });
      doc.addImage(titleImg.dataUrl, 'PNG', margin + 13, y + 1.5, titleImg.widthMm, titleImg.heightMm);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.text(act.title.slice(0, 65), margin + 13, y + 6);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${act.category}  |  ${timeRange}  |  ${act.status.toUpperCase()}`, pageWidth - margin - 3, y + 6, {
      align: 'right',
    });

    y += 12;

    // Description & Result
    const detailsText = [
      act.description ? `Description: ${act.description}` : '',
      act.result ? `Result: ${act.result}` : '',
    ]
      .filter(Boolean)
      .join('   •   ');

    if (detailsText) {
      if (containsNonAscii(detailsText)) {
        const descImg = renderBilingualTextToImage(detailsText, {
          fontSizePx: 11,
          fontWeight: '400',
          color: '#334155',
          maxWidthMm: pageWidth - margin * 2 - 4,
        });
        if (y + descImg.heightMm > pageHeight - 25) {
          doc.addPage();
          y = 18;
        }
        doc.addImage(descImg.dataUrl, 'PNG', margin + 2, y, descImg.widthMm, descImg.heightMm);
        y += descImg.heightMm + 3;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const splitLines = doc.splitTextToSize(detailsText, pageWidth - margin * 2 - 4);
        if (y + splitLines.length * 4.5 > pageHeight - 25) {
          doc.addPage();
          y = 18;
        }
        doc.text(splitLines, margin + 2, y + 3);
        y += splitLines.length * 4.5 + 3;
      }
    }

    // Embedded Activity Photographs (up to 3 per row)
    if (act.photos && act.photos.length > 0) {
      const loadedPhotos: { dataUrl: string; width: number; height: number }[] = [];
      for (const photoUrl of act.photos) {
        const loaded = await loadPhotoForPdf(photoUrl);
        if (loaded) loadedPhotos.push(loaded);
      }

      if (loadedPhotos.length > 0) {
        const cols = Math.min(3, loadedPhotos.length);
        const gap = 4;
        const availWidth = pageWidth - margin * 2;
        const boxWidth = (availWidth - gap * (cols - 1)) / cols;
        const boxHeight = cols === 1 ? 58 : 42;

        for (let pIdx = 0; pIdx < loadedPhotos.length; pIdx += cols) {
          if (y + boxHeight + 6 > pageHeight - 22) {
            doc.addPage();
            y = 18;
          }
          const rowSlice = loadedPhotos.slice(pIdx, pIdx + cols);
          rowSlice.forEach((photoObj, colIdx) => {
            const xPos = margin + colIdx * (boxWidth + gap);
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(xPos, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');

            // Fit image inside box preserving aspect ratio
            const ratio = Math.min((boxWidth - 2) / photoObj.width, (boxHeight - 2) / photoObj.height);
            const drawW = photoObj.width * ratio;
            const drawH = photoObj.height * ratio;
            const drawX = xPos + (boxWidth - drawW) / 2;
            const drawY = y + (boxHeight - drawH) / 2;

            doc.addImage(photoObj.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
          });
          y += boxHeight + 4;
        }
      }
    }

    y += 4;
  }

  // 4. Daily Summary & Manager Review / Signatures Block
  if (y > pageHeight - 65) {
    doc.addPage();
    y = 20;
  }

  const finalSummary = summaryText ?? report?.summary ?? '';
  if (finalSummary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('DAILY SUMMARY', margin, y);
    y += 4;

    if (containsNonAscii(finalSummary)) {
      const sumImg = renderBilingualTextToImage(finalSummary, {
        fontSizePx: 11,
        fontWeight: '400',
        color: '#334155',
        maxWidthMm: pageWidth - margin * 2,
      });
      doc.addImage(sumImg.dataUrl, 'PNG', margin, y, sumImg.widthMm, sumImg.heightMm);
      y += sumImg.heightMm + 6;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const sumLines = doc.splitTextToSize(finalSummary, pageWidth - margin * 2);
      doc.text(sumLines, margin, y + 3);
      y += sumLines.length * 4.5 + 6;
    }
  }

  if (report?.managerComment) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(37, 99, 235);
    doc.text(`MANAGER FEEDBACK (${profile.managerName || 'Manager'}):`, margin, y);
    y += 4;
    const commentImg = renderBilingualTextToImage(report.managerComment, {
      fontSizePx: 11,
      fontWeight: '500',
      color: '#1E293B',
      maxWidthMm: pageWidth - margin * 2,
    });
    doc.addImage(commentImg.dataUrl, 'PNG', margin, y, commentImg.widthMm, commentImg.heightMm);
    y += commentImg.heightMm + 6;
  }

  // Signature Boxes at Bottom
  if (y > pageHeight - 42) {
    doc.addPage();
    y = 24;
  }

  const sigWidth = (pageWidth - margin * 2 - 12) / 2;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, sigWidth, 26, 2, 2, 'FD');
  doc.roundedRect(margin + sigWidth + 12, y, sigWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('EMPLOYEE SIGNATURE', margin + 4, y + 6);
  doc.text('MANAGER APPROVAL', margin + sigWidth + 16, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(profile.fullName || 'Employee', margin + 4, y + 21);
  doc.text(
    `${profile.managerName || 'Manager'} (${(report?.status || 'draft').toUpperCase()})`,
    margin + sigWidth + 16,
    y + 21
  );

  const safeName = (profile.fullName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`DailyWork_Report_${safeName}_${workDate}.pdf`);
}
