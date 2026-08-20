export function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function normalizeCredentialInput(value: unknown): string {
  let normalized = String(value ?? '');
  normalized = normalized.replace(/[\r\n\t]/g, ' ').replace(/\u00a0/g, ' ');
  normalized = stripSurroundingQuotes(normalized);
  return normalized.trim();
}

export function validateAccessToken(value: unknown): string {
  const token = normalizeCredentialInput(value);
  if (!token) {
    throw new Error('Access Token is required.');
  }
  if (/[\x80-\uFFFF]/.test(token)) {
    throw new Error(
      'Access Token contains invalid characters. Copy the token directly from Meta and paste it without quotes, spaces, or line breaks.'
    );
  }
  if (/[\r\n\t]/.test(token)) {
    throw new Error(
      'Access Token contains invalid whitespace. Copy the token directly from Meta and paste it without spaces or line breaks.'
    );
  }
  return token;
}

export function validatePhoneNumberId(value: unknown): string {
  const phoneNumberId = normalizeCredentialInput(value);
  if (!phoneNumberId) {
    throw new Error('Phone Number ID is required.');
  }
  if (!/^\d+$/.test(phoneNumberId)) {
    throw new Error('Phone Number ID must contain digits only.');
  }
  return phoneNumberId;
}

export function validateWabaId(value: unknown): string {
  const wabaId = normalizeCredentialInput(value);
  if (!wabaId) {
    throw new Error('WABA ID is required.');
  }
  if (!/^\d+$/.test(wabaId)) {
    throw new Error('WhatsApp Business Account ID must contain digits only.');
  }
  return wabaId;
}
