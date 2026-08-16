import { CopilotConfig } from '../types';

export const copilotConfig: CopilotConfig = {
  summaryFields: ['preferred_stylist', 'skin_hair_type', 'last_service_date'],
  quickActions: [
    {
      label: 'Book Service',
      action: 'book_salon_service',
      iconName: 'Calendar',
    },
    {
      label: 'Send Rate Card',
      action: 'send_salon_menu',
      iconName: 'Sparkles',
    },
    {
      label: 'Send Aftercare Tips',
      action: 'send_aftercare_guide',
      iconName: 'FileText',
    },
  ],
};
