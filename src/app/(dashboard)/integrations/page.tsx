'use client';

import { IntegrationsClient } from '@/components/integrations/integrations-client';

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Integrations & Connected Channels
        </h1>
        <p className="text-sm text-slate-500">
          Connect WhatsApp, Instagram, Facebook Messenger, and lead capture
          tools to centralize your conversations in one inbox.
        </p>
      </div>

      <IntegrationsClient />
    </div>
  );
}
