/**
 * Google APIs service — Sheets (CRM export) + Calendar (followup scheduling).
 * Real googleapis client — no mocks.
 */

import { google } from 'googleapis';
import { prisma } from '../db/prisma';

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/connectors/google/callback',
  );
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  }
  return client;
}

// ─── Google Sheets CRM export ─────────────────────────────────────────────────

export interface SheetsExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsExported: number;
}

const CRM_HEADERS = [
  '#', 'Business Name', 'Owner Name', 'Business Phone', 'Business Email',
  'Business Website', 'Years in Business', 'Specialities', 'Lead Score',
  'Status', 'Outreach Status', 'Source', 'Created At',
];

export async function exportLeadsToSheets(spreadsheetId?: string): Promise<SheetsExportResult> {
  const auth = getOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  const leads = await prisma.lead.findMany({
    orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
  });

  const rows: (string | number)[][] = [
    CRM_HEADERS,
    ...leads.map((l, i) => [
      i + 1,
      l.businessName || l.company || '',
      l.ownerName || l.name || '',
      l.businessPhone || l.phone || '',
      l.businessEmail || l.email || '',
      l.businessWebsite || l.website || '',
      l.yearsInBusiness ?? '',
      l.specialities || '',
      l.leadScore,
      l.status,
      l.outreachStatus,
      l.source || '',
      l.createdAt.toISOString().split('T')[0],
    ]),
  ];

  if (spreadsheetId) {
    // Append to existing sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Leads!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      rowsExported: leads.length,
    };
  }

  // Create new spreadsheet
  const createResp = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `XPS Leads CRM — ${new Date().toLocaleDateString()}` },
      sheets: [{
        properties: { title: 'Leads' },
        data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row) => ({
          values: row.map((cell) => ({
            userEnteredValue: typeof cell === 'number' ? { numberValue: cell } : { stringValue: String(cell) },
            userEnteredFormat: { textFormat: { bold: rows.indexOf(row) === 0 } },
          })),
        })) }],
      }],
    },
  });

  const sid = createResp.data.spreadsheetId!;
  // Freeze header row + auto-resize
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: CRM_HEADERS.length } } },
      ],
    },
  });

  return {
    spreadsheetId: sid,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sid}`,
    rowsExported: leads.length,
  };
}

// ─── Google Calendar followup events ─────────────────────────────────────────

export interface CalendarEventResult {
  eventId: string;
  eventUrl: string;
  scheduledAt: Date;
}

export async function createCalendarFollowup(
  leadId: string,
  title: string,
  description: string,
  scheduledAt: Date,
  calendarId = 'primary',
): Promise<CalendarEventResult> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const endAt = new Date(scheduledAt.getTime() + 30 * 60 * 1000); // 30 min event

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: title,
      description,
      start: { dateTime: scheduledAt.toISOString(), timeZone: 'UTC' },
      end: { dateTime: endAt.toISOString(), timeZone: 'UTC' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      colorId: '3', // Sage (green) for followup events
    },
  });

  const eventId = event.data.id!;
  const eventUrl = event.data.htmlLink || `https://calendar.google.com/calendar/r/eventedit`;

  // Save to DB
  await prisma.calendarFollowup.create({
    data: { leadId, title, description, scheduledAt, googleEventId: eventId },
  });

  // Update lead outreach status if not already at a higher state
  await prisma.lead.updateMany({
    where: { id: leadId, outreachStatus: { in: ['NOT_CONTACTED', 'EMAIL_SENT'] } },
    data: { outreachStatus: 'MEETING_SCHEDULED' },
  });

  return { eventId, eventUrl, scheduledAt };
}

export async function listCalendarFollowups(calendarId = 'primary') {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: 'v3', auth });

  const resp = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return resp.data.items || [];
}
