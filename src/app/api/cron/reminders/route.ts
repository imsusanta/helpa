import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { engineSendButtons } from '@/lib/automations/meta-send';

function fillTemplate(templateStr: string, variables: Record<string, string>): string {
  let result = templateStr;
  for (const [key, val] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
}

export async function GET(request: Request) {
  try {
    // Basic authorization check: verify auth token if configured, or allow local run
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = supabaseAdmin();
    const now = new Date();

    // 1. Fetch accounts with reminders enabled
    const { data: accounts, error: accountsErr } = await db
      .from('accounts')
      .select('id, name, reminder_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_custom_time, reminder_template, reminder_business_hours');

    if (accountsErr) {
      throw new Error(`Failed to load accounts: ${accountsErr.message}`);
    }

    let totalSent24h = 0;
    let totalSent2h = 0;
    const errors: string[] = [];

    const activeAccounts = accounts.filter(acc => acc.reminder_enabled);

    for (const account of activeAccounts) {
      // Check business hours if configured
      const bh = account.reminder_business_hours || {};
      if (bh.enabled) {
        // Indian Standard Time / Standard server time check
        const currentLocalTime = now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata' // standard local time zone for user
        });
        if (currentLocalTime < bh.start || currentLocalTime > bh.end) {
          console.log(`[Cron Reminders] Skipping account ${account.name} - current time ${currentLocalTime} is outside business hours ${bh.start}-${bh.end}`);
          continue;
        }
      }

      // 2. Fetch appointments for this account that are pending, scheduled, or already reminder sent
      // Look for appointments scheduled today, tomorrow, or the day after
      const todayStr = now.toISOString().split('T')[0];
      const maxDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const maxDateStr = maxDate.toISOString().split('T')[0];

      const { data: appts, error: apptsErr } = await db
        .from('appointments')
        .select(`
          id,
          account_id,
          patient_id,
          doctor_id,
          department,
          appointment_date,
          appointment_time,
          status,
          token_number,
          reminder_24h_sent,
          reminder_2h_sent,
          doctor:hospital_doctors(id, name, department)
        `)
        .eq('account_id', account.id)
        .in('status', ['pending', 'Scheduled', 'Reminder Sent', 'pending-confirmation']) // cover initial states
        .gte('appointment_date', todayStr)
        .lte('appointment_date', maxDateStr);

      if (apptsErr) {
        console.error(`[Cron Reminders] Error loading appointments for account ${account.id}:`, apptsErr);
        continue;
      }

      for (const appt of appts) {
        // Parse date and time (standard Date parsing)
        const apptDateStr = `${appt.appointment_date}T${appt.appointment_time}`;
        const apptDateTime = new Date(apptDateStr);
        const diffMs = apptDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Fetch patient contact details
        const { data: contact, error: contactErr } = await db
          .from('contacts')
          .select('id, name, phone')
          .eq('id', appt.patient_id)
          .single();

        if (contactErr || !contact || !contact.phone) {
          continue;
        }

        let reminderLabel = '';
        let triggerSend = false;
        let is24h = false;

        // Custom time check (if configured on account)
        const customMinutes = account.reminder_custom_time;

        if (diffHours > 0 && diffHours <= 2) {
          // Send 2h reminder
          if (!appt.reminder_2h_sent && account.reminder_2h_enabled) {
            triggerSend = true;
            is24h = false;
            reminderLabel = 'in 2 hours';
          }
        } else if (diffHours > 2 && diffHours <= 24) {
          // Send 24h reminder
          if (!appt.reminder_24h_sent && account.reminder_24h_enabled) {
            triggerSend = true;
            is24h = true;
            reminderLabel = 'tomorrow';
          }
        }

        if (triggerSend) {
          try {
            // Find or create conversation row for message linkage
            let { data: conv } = await db
              .from('conversations')
              .select('id')
              .eq('contact_id', appt.patient_id)
              .eq('account_id', appt.account_id)
              .maybeSingle();

            if (!conv) {
              const { data: newConv, error: newConvErr } = await db
                .from('conversations')
                .insert({
                  account_id: appt.account_id,
                  contact_id: appt.patient_id,
                  status: 'open',
                })
                .select('id')
                .single();

              if (newConvErr || !newConv) {
                console.error(`[Cron Reminders] Failed to create conversation for contact ${appt.patient_id}:`, newConvErr);
                continue;
              }
              conv = newConv;
            }

            // Fill template variables
            const docData = appt.doctor as any;
            const docName = (Array.isArray(docData) ? docData[0]?.name : docData?.name) || 'Assigned Doctor';
            const dept = appt.department || (Array.isArray(docData) ? docData[0]?.department : docData?.department) || 'General';
            
            const bodyText = fillTemplate(account.reminder_template, {
              PatientName: contact.name || contact.phone,
              HospitalName: account.name || 'Hospital Receptionist',
              DoctorName: docName,
              Department: dept,
              AppointmentDate: appt.appointment_date,
              AppointmentTime: appt.appointment_time.substring(0, 5),
              TokenNumber: appt.token_number || 'N/A',
              ReminderTime: reminderLabel,
            });

            // Send WhatsApp interactive buttons message
            await engineSendButtons({
              accountId: appt.account_id,
              userId: '00000000-0000-0000-0000-000000000000', // system user id representation
              conversationId: conv.id,
              contactId: appt.patient_id,
              bodyText,
              buttons: [
                { id: `rem_confirm_${appt.id}`, title: 'Confirm' },
                { id: `rem_resched_${appt.id}`, title: 'Reschedule' },
                { id: `rem_cancel_${appt.id}`, title: 'Cancel' },
              ],
            });

            // Record inside contact timeline (contact_notes)
            await db.from('contact_notes').insert({
              account_id: appt.account_id,
              contact_id: appt.patient_id,
              note_text: `[Timeline] Appointment Reminder Sent (${reminderLabel}) for Dr. ${docName} on ${appt.appointment_date} at ${appt.appointment_time.substring(0, 5)}.`,
            });

            // Update reminder sent status in database
            const updates: Record<string, any> = {
              status: 'Reminder Sent'
            };
            if (is24h) {
              updates.reminder_24h_sent = true;
              totalSent24h++;
            } else {
              updates.reminder_2h_sent = true;
              totalSent2h++;
            }

            await db.from('appointments').update(updates).eq('id', appt.id);
            console.log(`[Cron Reminders] Successfully dispatched ${reminderLabel} reminder for appt ${appt.id}`);
          } catch (err: any) {
            console.error(`[Cron Reminders] Failed to dispatch reminder for appt ${appt.id}:`, err);
            errors.push(`Appt ${appt.id}: ${err.message || err}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent_24h: totalSent24h,
      sent_2h: totalSent2h,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[Cron Reminders] Fatal handler crash:', err);
    return NextResponse.json({ error: err.message || err }, { status: 500 });
  }
}
