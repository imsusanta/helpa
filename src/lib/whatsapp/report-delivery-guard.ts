const REPORT_TERMS =
  /\b(?:lab report|blood report|medical report|test report|reports?|cbc|mri|x\s?ray|ct scan|pathology|urine test|blood test|glucose|thyroid|lft|kft|h(?:a?e)moglobin|platelets?|pdf)\b/i;

const INDIC_REPORT_TERMS =
  /(?:রিপোর্ট|রিপোট|টেস্ট|পরীক্ষা|রক্ত|ব্লাড|প্যাথোলজি|रिपोर्ट|जांच|खून|ब्लड|रिजल्ट)/i;

/**
 * Returns true only when the patient's message explicitly refers to a lab or
 * diagnostic report. Short action words such as "do", "din", "chai", or the
 * generic word "status" are deliberately excluded because they also occur in
 * ordinary appointment conversations (for example, "doctor").
 */
export function isExplicitLabReportRequest(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[_-]+/g, ' ').trim();
  return REPORT_TERMS.test(normalized) || INDIC_REPORT_TERMS.test(normalized);
}

/** Identifies the automatic AI lab-report attachment shape. */
export function isLikelyAiLabReportDocument(args: {
  filename?: string;
  caption?: string;
}): boolean {
  const filename = args.filename?.trim() || '';
  const caption = args.caption?.trim() || '';

  return (
    /_report\.pdf$/i.test(filename) &&
    /^here is your completed .+ report\.?$/i.test(caption)
  );
}
