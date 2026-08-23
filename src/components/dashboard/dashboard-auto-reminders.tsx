'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Clock, Send, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { resolveIndustryAlias } from '@/modules/terminology';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Automation } from '@/types';

interface IndustryReminderTemplate {
  key: string;
  name: string;
  when: string;
  action: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  defaultMessage: string;
}

const TEMPLATES_BY_INDUSTRY: Record<string, IndustryReminderTemplate[]> = {
  hospital_clinic: [
    {
      key: 'clinic_confirm',
      name: 'Appointment Confirmation',
      when: 'An appointment is booked',
      action:
        'Sends a WhatsApp confirmation with doctor details and token number.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Namaste! Your consultation has been confirmed. Please arrive 10 minutes prior.',
    },
    {
      key: 'clinic_remind',
      name: 'Appointment Reminder',
      when: '24 hours before an appointment',
      action: 'Sends a reminder with appointment time and clinic location.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Reminder: You have an upcoming consultation tomorrow. Reply 1 to confirm.',
    },
    {
      key: 'clinic_followup',
      name: 'Follow-up Reminder',
      when: 'After a consultation',
      action: 'Reminds the patient about their recommended doctor follow-up.',
      trigger_type: 'appointment_completed',
      trigger_config: { delay_minutes: 120 },
      defaultMessage:
        'Thank you for visiting today. Please remember to take prescribed medications.',
    },
  ],
  travel: [
    {
      key: 'travel_instant',
      name: 'Instant Package Response',
      when: 'A customer asks about a tour package',
      action: 'Sends package details, itinerary, and pricing automatically.',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      defaultMessage:
        'Hello! Here are the details and inclusions for our popular holiday packages.',
    },
    {
      key: 'travel_quote_followup',
      name: 'Quote Follow-up',
      when: 'A customer receives a quote but has not confirmed',
      action: 'Sends a friendly follow-up after 3 days.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Hi! Just checking in to see if you have any questions about your holiday quotation.',
    },
    {
      key: 'travel_confirm',
      name: 'Booking Confirmation',
      when: 'A tour booking is confirmed',
      action: 'Sends confirmation and important trip checklist.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Your tour booking is confirmed! We have attached your trip itinerary.',
    },
  ],
  salon: [
    {
      key: 'salon_confirm',
      name: 'Appointment Confirmation',
      when: 'A service appointment is booked',
      action: 'Sends confirmation automatically.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Your salon appointment has been booked. We look forward to seeing you!',
    },
    {
      key: 'salon_remind',
      name: 'Appointment Reminder',
      when: '24 hours before the appointment',
      action: 'Sends a reminder to the customer.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Reminder: You have a salon appointment tomorrow at our studio.',
    },
    {
      key: 'salon_return',
      name: 'Return Visit Reminder',
      when: '15 days after a service',
      action: 'Invites the customer to book their next grooming visit.',
      trigger_type: 'appointment_completed',
      trigger_config: { delay_minutes: 21600 },
      defaultMessage:
        'Hope you loved your previous styling! Ready for your next fresh look?',
    },
  ],
  coaching: [
    {
      key: 'coaching_demo',
      name: 'Demo Class Confirmation',
      when: 'A demo class is booked',
      action: 'Sends date, time, and class details.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Your free demo class is scheduled. Here is the class schedule and classroom link.',
    },
    {
      key: 'coaching_fee',
      name: 'Fee Reminder',
      when: 'A fee payment is due',
      action: 'Sends a polite payment reminder.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Gentle reminder: Monthly tuition fee is due this week. Thank you!',
    },
    {
      key: 'coaching_followup',
      name: 'Admission Follow-up',
      when: 'A student enquires but does not enroll',
      action: 'Follows up automatically with batch information.',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      defaultMessage:
        'New batch admissions are closing soon. Would you like to reserve a seat?',
    },
  ],
  real_estate: [
    {
      key: 'real_estate_prop',
      name: 'Property Details',
      when: 'A buyer enquires about a property',
      action: 'Sends property details and floor plans automatically.',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      defaultMessage:
        'Thank you for your interest! Here are the brochure and floor plan details.',
    },
    {
      key: 'real_estate_visit',
      name: 'Site Visit Reminder',
      when: 'A site visit is scheduled',
      action: 'Sends visit time, project location, and agent contact.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Your site visit is scheduled for tomorrow. Here are the Google Maps directions.',
    },
    {
      key: 'real_estate_followup',
      name: 'Buyer Follow-up',
      when: 'A buyer has not responded',
      action: 'Follows up automatically after a reasonable period.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Hello! Did you have any questions regarding the property options we shared?',
    },
  ],
  restaurant: [
    {
      key: 'restaurant_confirm',
      name: 'Reservation Confirmation',
      when: 'A table is reserved',
      action: 'Sends confirmation automatically with party size and time.',
      trigger_type: 'appointment_created',
      trigger_config: {},
      defaultMessage:
        'Your table reservation is confirmed! We look forward to hosting you.',
    },
    {
      key: 'restaurant_remind',
      name: 'Reservation Reminder',
      when: '2 hours before the reservation',
      action: 'Sends a reminder to the guest.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Your dining table is ready for tonight. Please let us know if your party size changes.',
    },
    {
      key: 'restaurant_feedback',
      name: 'Feedback Request',
      when: 'After a completed visit',
      action: 'Asks the guest for feedback and review.',
      trigger_type: 'appointment_completed',
      trigger_config: { delay_minutes: 120 },
      defaultMessage:
        'Thank you for dining with us! How was your experience tonight?',
    },
  ],
  general: [
    {
      key: 'general_welcome',
      name: 'Welcome Greeting',
      when: 'A new customer messages your WhatsApp',
      action: 'Sends an instant warm greeting and menu of services.',
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      defaultMessage:
        'Namaste! Welcome to our business. How can we help you today?',
    },
    {
      key: 'general_remind',
      name: 'Appointment Reminder',
      when: '24 hours before a scheduled meeting',
      action: 'Sends a reminder with appointment details.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      defaultMessage:
        'Reminder: You have an upcoming appointment scheduled with us tomorrow.',
    },
    {
      key: 'general_followup',
      name: 'Customer Follow-up',
      when: 'After service completion',
      action: 'Follows up with customer for feedback.',
      trigger_type: 'appointment_completed',
      trigger_config: { delay_minutes: 120 },
      defaultMessage:
        'Thank you for choosing us! Please let us know if you need anything else.',
    },
  ],
};

export function DashboardAutoReminders() {
  const { account, canEditSettings } = useAuth();
  const industryKey = resolveIndustryAlias(account?.industry);
  const templates =
    TEMPLATES_BY_INDUSTRY[industryKey] || TEMPLATES_BY_INDUSTRY.general;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] =
    useState<IndustryReminderTemplate | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'enable' | 'disable' | null
  >(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations');
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  function getMatchingAutomation(template: IndustryReminderTemplate) {
    return automations.find(
      (a) =>
        a.name.toLowerCase() === template.name.toLowerCase() ||
        a.trigger_type === template.trigger_type
    );
  }

  function handlePromptToggle(
    template: IndustryReminderTemplate,
    currentlyActive: boolean
  ) {
    if (!canEditSettings) {
      toast.error('Only administrators can modify auto-reminders.');
      return;
    }
    setSelectedTemplate(template);
    setPendingAction(currentlyActive ? 'disable' : 'enable');
  }

  async function handleConfirmToggle() {
    if (!selectedTemplate || !pendingAction) return;
    const template = selectedTemplate;
    const action = pendingAction;
    setBusyKey(template.key);
    setSelectedTemplate(null);
    setPendingAction(null);

    try {
      const existing = getMatchingAutomation(template);

      if (existing) {
        // Toggle existing record
        const nextActive = action === 'enable';
        const res = await fetch(`/api/automations/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: nextActive }),
        });

        if (res.ok) {
          toast.success(
            nextActive
              ? `✓ ${template.name} is now active`
              : `${template.name} paused`
          );
          await loadAutomations();
        } else {
          toast.error('Failed to update reminder status');
        }
      } else if (action === 'enable') {
        // Create and seed new automation
        const res = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: template.name,
            description: template.action,
            trigger_type: template.trigger_type,
            trigger_config: template.trigger_config,
            is_active: true,
            steps: [
              {
                step_type: 'send_message',
                step_config: { text: template.defaultMessage },
              },
            ],
          }),
        });

        if (res.ok) {
          toast.success(`✓ ${template.name} is now active`);
          await loadAutomations();
        } else {
          toast.error('Failed to enable auto-reminder');
        }
      }
    } catch {
      toast.error('Error updating auto-reminder');
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-sm font-bold">
            <Zap className="size-4 text-emerald-500" />
            Save Time with Auto-Reminders
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Turn on ready-made WhatsApp follow-ups that run automatically for
            your business.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => {
          const match = getMatchingAutomation(tpl);
          const isActive = Boolean(match && match.is_active);
          const isBusy = busyKey === tpl.key;

          return (
            <Card
              key={tpl.key}
              className={`border transition-all ${
                isActive
                  ? 'border-emerald-500/30 bg-emerald-500/[0.02] shadow-xs'
                  : 'border-border bg-card'
              }`}
            >
              <CardContent className="flex h-full flex-col justify-between space-y-3 p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                          isActive
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Zap className="size-3.5" />
                      </div>
                      <h3 className="text-foreground text-xs font-bold">
                        {tpl.name}
                      </h3>
                    </div>

                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] ${
                        isActive
                          ? 'border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {isActive ? '● Active' : '○ Off'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="text-muted-foreground flex items-start gap-1 text-[11px]">
                      <Clock className="mt-0.5 size-3 shrink-0 text-zinc-400" />
                      <span>
                        <strong className="font-medium text-zinc-300">
                          When:{' '}
                        </strong>
                        {tpl.when}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-start gap-1 text-[11px]">
                      <Send className="mt-0.5 size-3 shrink-0 text-emerald-400" />
                      <span>
                        <strong className="font-medium text-zinc-300">
                          Helpa:{' '}
                        </strong>
                        {tpl.action}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    size="sm"
                    variant={isActive ? 'outline' : 'default'}
                    onClick={() => handlePromptToggle(tpl, isActive)}
                    disabled={isBusy || !canEditSettings}
                    className={`h-8 w-full text-xs font-bold ${
                      isActive
                        ? 'border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isActive ? (
                      'Turn Off'
                    ) : (
                      'Turn On (1-Click)'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(selectedTemplate)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTemplate(null);
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="bg-popover text-popover-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="size-4 text-emerald-500" />
              {pendingAction === 'enable'
                ? `Turn on ${selectedTemplate?.name}?`
                : `Turn off ${selectedTemplate?.name}?`}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1 text-xs leading-relaxed">
              {pendingAction === 'enable' ? (
                <>
                  Helpa will automatically{' '}
                  <strong className="text-foreground">
                    {selectedTemplate?.action.toLowerCase()}
                  </strong>{' '}
                  when{' '}
                  <strong className="text-foreground">
                    {selectedTemplate?.when.toLowerCase()}
                  </strong>
                  .
                </>
              ) : (
                <>
                  Automatic messages for{' '}
                  <strong className="text-foreground">
                    {selectedTemplate?.name}
                  </strong>{' '}
                  will be paused until you turn them back on.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTemplate(null);
                setPendingAction(null);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmToggle}
              className={`text-xs font-bold text-white ${
                pendingAction === 'enable'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-destructive hover:bg-destructive/90'
              }`}
            >
              {pendingAction === 'enable' ? 'Turn On' : 'Turn Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
