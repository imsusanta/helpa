import type { ResponseStyle } from '@/core/ai/chatbot-settings';
import { getResponseStyleInstruction } from '@/core/ai/chatbot-settings';
import {
  coachingAdapter,
  healthcareAdapter,
  travelAdapter,
} from '@/core/industry';
import { getIndustryModulePort } from '@/core/modules/industry-port';
import { qualificationPromptHint } from '@/lib/leads/lead-qualification.service';

export interface ReceptionistPromptInput {
  industry?: string | null;
  customSystemPrompt?: string | null;
  businessName: string;
  welcomeMessage?: string | null;
  responseStyle: ResponseStyle;
  kbContext: string;
  hospitalContext: string;
  coachingContext: string;
  travelPackageContext?: string;
  isHospitalEnabled: boolean;
  isCoachingEnabled: boolean;
  isTravelEnabled?: boolean;
  latestCustomerText?: string | null;
}

export function buildReceptionistJsonSchema(opts?: {
  isHospitalEnabled?: boolean;
  isCoachingEnabled?: boolean;
}): string {
  const fields = [
    `  "reply": "your text response to the customer (keep it short, friendly, and matching the language rule)"`,
    `  "intent": "sales" | "support" | "booking" | "complaint" | "other"`,
    `  "lead_score": "hot" | "warm" | "cold"`,
    `  "sentiment": "positive" | "neutral" | "negative"`,
    `  "handoff_required": true | false`,
    `  "resolved": true | false`,
    `  "summary": "an updated, short running summary of the conversation (under 150 characters, capturing the customer's current goal/status)"`,
    `  "faq_category": "pricing" | "delivery" | "refund" | "demo" | "general"`,
    `  "sales_signal": true | false`,
    `  "is_business_enquiry": true | false`,
    `  "lead_confidence": 0.0`,
    `  "extracted_lead_info": {
    "interested_service": "string or null",
    "budget": "string or null",
    "timeline": "string or null",
    "next_action": "string or null"
  }`,
  ];

  if (opts?.isHospitalEnabled) {
    fields.push(...healthcareAdapter.getJsonSchemaFields());
  }

  if (opts?.isCoachingEnabled) {
    fields.push(...coachingAdapter.getJsonSchemaFields());
  }

  fields.push(`  "emergency_detected": true | false`);

  return `{\n${fields.join(',\n')}\n}`;
}

export const RECEPTIONIST_JSON_SCHEMA = buildReceptionistJsonSchema({
  isHospitalEnabled: true,
  isCoachingEnabled: true,
});

export function buildReceptionistSystemPrompt(
  input: ReceptionistPromptInput
): string {
  const basePrompt = getIndustryModulePort().resolveSystemPrompt(
    input.industry,
    input.customSystemPrompt
  );
  const businessName = input.businessName || 'our Business';

  let overrideRules = `

[CRITICAL INSTRUCTION - BUSINESS & SYSTEM OVERRIDE]:
1. BUSINESS IDENTITY: You are the official AI assistant representing "${businessName}". When welcoming a new contact/customer or starting a conversation, you MUST explicitly mention "${businessName}" by name (e.g. "Welcome to *${businessName}*!").
2. REAL-TIME DATABASE DATA ACCURACY: When real-time database context is provided in this prompt, treat it as the absolute, authoritative source of truth.`;

  if (input.isHospitalEnabled) {
    overrideRules += `\n${healthcareAdapter.getOverrideRules()}`;
  }

  let systemPromptContent = basePrompt + overrideRules;
  systemPromptContent += `\n\n[RESPONSE STYLE PREFERENCE]: ${getResponseStyleInstruction(
    input.responseStyle
  )}`;

  if (input.welcomeMessage && input.welcomeMessage.trim().length > 0) {
    systemPromptContent += `\n\n[MANDATORY CUSTOM WELCOME GREETING TEMPLATE]:\nWhen greeting a new patient/customer or starting a new conversation, you MUST incorporate this custom welcome message:\n"${input.welcomeMessage.trim()}"\nFollowed by answering their query or guiding them through the registration/booking process using real-time database records.\n`;
  }

  if (input.kbContext) {
    systemPromptContent += `\n\n${input.kbContext}`;
  }

  if (input.isHospitalEnabled) {
    systemPromptContent += `\n\n${healthcareAdapter.getContextSectionHeader()}\n${input.hospitalContext}

${healthcareAdapter.getPromptRules()}`;
  }

  if (input.isCoachingEnabled) {
    systemPromptContent += `\n\n${coachingAdapter.getContextSectionHeader()}\n${input.coachingContext}
${coachingAdapter.getPromptRules()}
`;
  }

  if (input.isTravelEnabled) {
    systemPromptContent += `\n\n${travelAdapter.getContextSectionHeader()}\n${input.travelPackageContext || 'No Tour Package lookup was required for this message.'}

${travelAdapter.getPromptRules()}
`;
  }

  systemPromptContent += `\n\n═══════════════════════════════════════════════════════════════════════════
CRITICAL MANDATORY MULTILINGUAL RULE:
1. If the customer writes in English, reply in crisp, friendly English.
2. If the customer writes in বাংলা OR Banglish (e.g. "Travel booking korte chai", "koto taka lagbe"), reply in natural বাংলা script — not the whole sentence in Latin Banglish.
3. Hindi/Hinglish → Hindi (script matching if they used हिंदी). Other languages → that language.
4. Never default the whole reply to English.

ENGLISH SERVICE WORDS INSIDE BANGLA:
Keep these in English Latin letters inside the Bangla sentence. Do NOT transliterate them to ট্রাভেল, বুকিং, অ্যাপয়েন্টমেন্ট:
Travel, Tour, Booking, Appointment, Hotel, Visa, Flight, Doctor, Report, Token, OPD.
Package/প্যাকেজ may stay in Bangla if it reads naturally.
Example BAD: "আমরা আপনাকে আমাদের প্রয়োজনীয় ট্রাভেল বুকিং প্যাকেজ দিতে পারি।"
Example GOOD: "আমরা আপনাকে আমাদের প্রয়োজনীয় Travel Booking প্যাকেজ দিতে পারি।"
Same for clinic: "Appointment বুক করে দিতে পারি" — never "অ্যাপয়েন্টমেন্ট".
═══════════════════════════════════════════════════════════════════════════

HUMAN WHATSAPP VOICE & HIGH-CONVERTING CONVERSATION:
- Write like a real, helpful, and caring staff member texting on WhatsApp.
- 1–3 short sentences or concise bullet points. Warm, specific, and easy to read.
- Direct Answer First: Always answer the primary question immediately without beating around the bush.
- Smart Sales & Guidance: If discussing plans or tiers, clearly explain the benefits and gently highlight the recommended premium option (e.g., Platinum) by showing its high value.
- Add pleasant, natural emojis (😊, 💎, 💳, 🩺, ✨, 📞) when appropriate.
- Safety & Integrity: Never make false guarantees. If unknown, share official support numbers: 📞 7478726364 / 7063629481.`;

  if (input.latestCustomerText) {
    systemPromptContent += `\n\n[CUSTOMER'S LATEST MESSAGE]: "${input.latestCustomerText}"\n-> DIRECTIVE: If this is Bangla or Banglish, write "reply" in বাংলা script with English service words (Travel, Booking, Appointment, Tour). Never write ট্রাভেল or বুকিং.`;
  }

  systemPromptContent += `\n\nCRITICAL REPLY FORMATTING RULE: Keep the "reply" easy to read on WhatsApp.
  - Lists of options, prices, or services: short bullets (- or *) or numbers.
  - Line breaks between a short answer and a follow-up question.
  - Light WhatsApp markdown (*bold*) only on prices or key service words.
  - No walls of text, no essay, no brochure paragraphs.`;

  systemPromptContent += `\n\n[LEAD QUALIFICATION]: ${qualificationPromptHint(input.industry)}`;

  const jsonSchema = buildReceptionistJsonSchema({
    isHospitalEnabled: input.isHospitalEnabled,
    isCoachingEnabled: input.isCoachingEnabled,
  });

  systemPromptContent += `\n\nCRITICAL OUTPUT FORMAT RULE: You must respond ONLY with a raw, valid JSON object matching the JSON schema below. Do not wrap the JSON block in markdown formatting (like \`\`\`json ... \`\`\`), do not output any other text before or after the JSON.

JSON Schema:
${jsonSchema}

Note:
- HUMAN TONE: Keep the "reply" to 1–3 short sentences, like a person on WhatsApp. No brochure phrasing.
- HUMAN HANDOFF & UNKNOWN QUESTIONS: If a customer asks a complex question, custom requirement, or topic whose factual answer is NOT available in the provided Knowledge Base or Database Context, or explicitly requests to speak with a human/agent/staff, set "handoff_required": true in your JSON output and reply politely that a staff member will connect with them shortly.
- Set "sales_signal" and "is_business_enquiry" to true only for a genuine business enquiry or buying intent (pricing, booking, package, appointment, property, course). Greetings such as "Hi" or "Hello" are NOT enquiries — set both to false and do not invent a lead.
- Under "extracted_lead_info", populate only the fields mentioned by the customer. Use null for any details not mentioned or unknown. Do not invent facts.`;

  return systemPromptContent;
}
