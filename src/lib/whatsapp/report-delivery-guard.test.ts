import { describe, expect, it } from 'vitest';

import {
  isExplicitLabReportRequest,
  isLikelyAiLabReportDocument,
} from './report-delivery-guard';

describe('lab report delivery guard', () => {
  it('does not treat doctor booking messages as report requests', () => {
    expect(
      isExplicitLabReportRequest('I want to book a doctor appointment')
    ).toBe(false);
    expect(isExplicitLabReportRequest('Doctor appointment status please')).toBe(
      false
    );
    expect(isExplicitLabReportRequest('appointment booking kore din')).toBe(
      false
    );
  });

  it('recognises explicit report requests in supported languages', () => {
    expect(isExplicitLabReportRequest('Please send my blood report PDF')).toBe(
      true
    );
    expect(isExplicitLabReportRequest('আমার রিপোর্ট পাঠান')).toBe(true);
    expect(isExplicitLabReportRequest('मेरी ब्लड रिपोर्ट भेजिए')).toBe(true);
    expect(isExplicitLabReportRequest('report_download_123')).toBe(true);
  });

  it('only identifies the AI lab-report attachment shape', () => {
    expect(
      isLikelyAiLabReportDocument({
        filename: 'CBC_Report.pdf',
        caption: 'Here is your completed CBC report.',
      })
    ).toBe(true);
    expect(
      isLikelyAiLabReportDocument({
        filename: 'Appointment_Ticket.pdf',
        caption: 'Your appointment ticket',
      })
    ).toBe(false);
  });
});
