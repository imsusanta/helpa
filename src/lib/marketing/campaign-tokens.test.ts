import { describe, expect, it } from 'vitest';
import { applyCampaignTokens } from './campaign-tokens';

describe('applyCampaignTokens', () => {
  it('substitutes the generic {{Name}} token the cron used to miss', () => {
    // Regression: scheduled sends delivered "Hi {{Name}}" verbatim.
    expect(
      applyCampaignTokens('Hi {{Name}}, your trip is confirmed!', {
        contactName: 'Ayesha',
      })
    ).toBe('Hi Ayesha, your trip is confirmed!');
  });

  it('substitutes every industry alias for the recipient name', () => {
    const body =
      '{{PatientName}}|{{StudentName}}|{{CustomerName}}|{{GuestName}}|{{TravellerName}}|{{ClientName}}';
    expect(applyCampaignTokens(body, { contactName: 'Rita' })).toBe(
      'Rita|Rita|Rita|Rita|Rita|Rita'
    );
  });

  it('substitutes business aliases with the workspace name', () => {
    expect(
      applyCampaignTokens(
        '{{HospitalName}} / {{BusinessName}} / {{AgencyName}}',
        {
          businessName: 'Wanderlust Travels',
        }
      )
    ).toBe('Wanderlust Travels / Wanderlust Travels / Wanderlust Travels');
  });

  it('tolerates inner whitespace in tokens', () => {
    expect(applyCampaignTokens('Hi {{ Name }}!', { contactName: 'Sam' })).toBe(
      'Hi Sam!'
    );
  });

  it('falls back to a neutral greeting when the contact has no name', () => {
    expect(applyCampaignTokens('Hi {{Name}}', { contactName: '   ' })).toBe(
      'Hi there'
    );
    expect(
      applyCampaignTokens('Hi {{Name}}', {
        contactName: null,
        fallbackName: 'Traveller',
      })
    ).toBe('Hi Traveller');
  });

  it('leaves unknown tokens intact rather than blanking them', () => {
    expect(
      applyCampaignTokens('Depart {{Date}} from {{Location}}', {
        contactName: 'Sam',
      })
    ).toBe('Depart {{Date}} from {{Location}}');
  });

  it('handles empty bodies', () => {
    expect(applyCampaignTokens(null, {})).toBe('');
    expect(applyCampaignTokens(undefined, {})).toBe('');
  });
});
