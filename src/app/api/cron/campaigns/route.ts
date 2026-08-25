import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/db/server';
import {
  engineSendText,
  engineSendDocument,
} from '@/lib/automations/meta-send';
import { authorizeCronRequest } from '@/lib/cron/security';

// Helper to calculate next recurring date
function getNextRecurringDate(
  currentDateStr: string,
  recurrence: 'weekly' | 'monthly' | 'yearly'
): Date {
  const d = new Date(currentDateStr);
  if (recurrence === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurrence === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (recurrence === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

export async function GET(request: Request) {
  const authorization = authorizeCronRequest(request);
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status }
    );
  }

  console.log('[Cron Campaigns] Executing cron automation triggers...');

  const db = getAdminClient();
  let totalDispatched = 0;
  let totalAutomatedReviews = 0;
  let totalAutomatedFollowups = 0;
  const errors: string[] = [];

  try {
    // ════════════════════════════════════════════════════════════
    // 1. DISPATCH SCHEDULED CAMPAIGNS & HANDLE RECURRENCE
    // ════════════════════════════════════════════════════════════
    const { data: scheduledCampaigns } = await db
      .from('broadcasts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (scheduledCampaigns && scheduledCampaigns.length > 0) {
      console.log(
        `[Cron Campaigns] Found ${scheduledCampaigns.length} scheduled campaigns to send.`
      );

      for (const campaign of scheduledCampaigns) {
        try {
          if (!campaign.account_id) {
            await db
              .from('broadcasts')
              .update({ status: 'failed', failed_count: 1 })
              .eq('id', campaign.id);
            errors.push(`Campaign ${campaign.id}: missing account_id`);
            continue;
          }

          const campaignAccountId = String(campaign.account_id);

          // Set to sending
          await db
            .from('broadcasts')
            .update({ status: 'sending' })
            .eq('id', campaign.id)
            .eq('account_id', campaignAccountId);

          // Get the audience filter settings
          const filter = (campaign.audience_filter || {}) as Record<
            string,
            unknown
          >;
          let patientIds: string[] = [];

          // Preferred path: audience snapshot frozen at schedule time by
          // the wizard (scheduled_contact_ids). Covers every audience
          // type — tags, custom fields, CSV upserts — which the dynamic
          // resolver below cannot handle.
          const snapIds = Array.isArray(filter.scheduled_contact_ids)
            ? (filter.scheduled_contact_ids as unknown[]).filter(
                (v): v is string => typeof v === 'string' && v.length > 0
              )
            : [];

          // Server-side audience resolution (fallback for legacy rows
          // without a snapshot)
          if (snapIds.length > 0) {
            patientIds = snapIds;
          } else if (filter.type === 'all') {
            const { data } = await db
              .from('contacts')
              .select('id')
              .eq('account_id', campaignAccountId);
            patientIds = (data || []).map((c) => c.id);
          } else if (filter.type === 'new_patients') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const { data } = await db
              .from('contacts')
              .select('id')
              .eq('account_id', campaignAccountId)
              .gte('created_at', thirtyDaysAgo.toISOString());
            patientIds = (data || []).map((c) => c.id);
          } else if (filter.type === 'returning_patients') {
            const { data: appts } = await db
              .from('appointments')
              .select('patient_id')
              .eq('account_id', campaignAccountId);
            const counts: Record<string, number> = {};
            appts?.forEach((r) => {
              counts[r.patient_id] = (counts[r.patient_id] || 0) + 1;
            });
            patientIds = Object.keys(counts).filter((id) => counts[id] >= 2);
          } else if (filter.type === 'upcoming_appointments') {
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: appts } = await db
              .from('appointments')
              .select('patient_id')
              .eq('account_id', campaignAccountId)
              .gte('appointment_date', todayStr);
            patientIds = [
              ...new Set(
                (appts || []).map((a: { patient_id: string }) =>
                  String(a.patient_id)
                )
              ),
            ] as string[];
          } else if (filter.type === 'missed_appointments') {
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: appts } = await db
              .from('appointments')
              .select('patient_id')
              .eq('account_id', campaignAccountId)
              .or(
                `status.eq.no_show,status.eq.Cancelled,and(status.eq.pending,appointment_date.lt.${todayStr})`
              );
            patientIds = [
              ...new Set(
                (appts || []).map((a: { patient_id: string }) =>
                  String(a.patient_id)
                )
              ),
            ] as string[];
          } else if (filter.type === 'due_followup') {
            const { data: pats } = await db
              .from('patients')
              .select('id')
              .eq('account_id', campaignAccountId);
            patientIds = (pats || []).map((p) => p.id);
          } else if (filter.type === 'by_department' && filter.department) {
            const { data: pats } = await db
              .from('patients')
              .select('id')
              .eq('account_id', campaignAccountId)
              .eq('department', filter.department);
            patientIds = (pats || []).map((p) => p.id);
          } else if (filter.type === 'by_doctor' && filter.doctorId) {
            const { data: pats } = await db
              .from('patients')
              .select('id')
              .eq('account_id', campaignAccountId)
              .eq('assigned_doctor_id', filter.doctorId);
            patientIds = (pats || []).map((p) => p.id);
          } else if (filter.type === 'by_gender' && filter.gender) {
            const { data: pats } = await db
              .from('patients')
              .select('id')
              .eq('account_id', campaignAccountId)
              .eq('gender', filter.gender);
            patientIds = (pats || []).map((p) => p.id);
          } else if (filter.type === 'by_age') {
            const nowYear = new Date().getFullYear();
            let query = db
              .from('patients')
              .select('id')
              .eq('account_id', campaignAccountId);
            if (filter.ageMin !== undefined) {
              const maxDob = new Date();
              maxDob.setFullYear(nowYear - Number(filter.ageMin));
              query = query.lte(
                'date_of_birth',
                maxDob.toISOString().split('T')[0]
              );
            }
            if (filter.ageMax !== undefined) {
              const minDob = new Date();
              minDob.setFullYear(nowYear - Number(filter.ageMax));
              query = query.gte(
                'date_of_birth',
                minDob.toISOString().split('T')[0]
              );
            }
            const { data: pats } = await query;
            patientIds = (pats || []).map((p) => p.id);
          }

          if (patientIds.length === 0) {
            await db
              .from('broadcasts')
              .update({ status: 'failed', failed_count: 1 })
              .eq('id', campaign.id)
              .eq('account_id', campaignAccountId);
            continue;
          }

          // Fetch recipient contacts belonging to this campaign's tenant only.
          const { data: contacts } = await db
            .from('contacts')
            .select('*')
            .eq('account_id', campaignAccountId)
            .in('id', patientIds);
          if (!contacts || contacts.length === 0) {
            await db
              .from('broadcasts')
              .update({ status: 'failed', failed_count: 1 })
              .eq('id', campaign.id)
              .eq('account_id', campaignAccountId);
            continue;
          }

          // Insert broadcast_recipients rows
          const recRows = contacts.map((c) => ({
            broadcast_id: campaign.id,
            contact_id: c.id,
            status: 'pending' as const,
          }));
          await db.from('broadcast_recipients').insert(recRows);

          // Retrieve account's WhatsApp API configurations
          const { data: account } = await db
            .from('accounts')
            .select('name')
            .eq('id', campaign.account_id)
            .single();

          // Dispatch loop
          let sentCount = 0;
          let failedCount = 0;
          for (const contact of contacts) {
            try {
              // Find or create conversation
              let { data: conv } = await db
                .from('conversations')
                .select('id')
                .eq('account_id', campaignAccountId)
                .eq('contact_id', contact.id)
                .maybeSingle();
              if (!conv) {
                const { data: newConv } = await db
                  .from('conversations')
                  .insert({
                    account_id: campaignAccountId,
                    contact_id: contact.id,
                    status: 'open',
                  })
                  .select('id')
                  .single();
                conv = newConv;
              }

              if (!conv) continue;

              // Compose message body
              let textBody = campaign.message_body || '';
              textBody = textBody.replace(
                /\{\{PatientName\}\}/g,
                contact.name || 'Patient'
              );
              textBody = textBody.replace(
                /\{\{HospitalName\}\}/g,
                account?.name || 'Hospital'
              );

              if (campaign.cta_type === 'appointment') {
                textBody += '\n\nReply *BOOK* to book an appointment.';
              } else if (campaign.cta_type === 'review' && campaign.cta_url) {
                textBody += `\n\nClick here to leave a review: ${campaign.cta_url}`;
              } else if (campaign.cta_type === 'url' && campaign.cta_url) {
                textBody += `\n\nVisit: ${campaign.cta_url}`;
              }

              // Send PDF/Image attachment if specified
              if (campaign.attachment_url) {
                await engineSendDocument({
                  accountId: campaignAccountId,
                  userId: '00000000-0000-0000-0000-000000000000',
                  conversationId: conv.id,
                  contactId: contact.id,
                  documentUrl: campaign.attachment_url,
                  filename: `${campaign.name.replace(/\s+/g, '_')}_Attachment`,
                  caption: textBody,
                });
              } else {
                await engineSendText({
                  accountId: campaignAccountId,
                  userId: '00000000-0000-0000-0000-000000000000',
                  conversationId: conv.id,
                  contactId: contact.id,
                  text: textBody,
                });
              }

              // Update recipient log
              await db
                .from('broadcast_recipients')
                .update({ status: 'sent' })
                .eq('broadcast_id', campaign.id)
                .eq('contact_id', contact.id);
              sentCount++;
            } catch (sendErr) {
              console.error(
                `[Cron Campaigns] Failed sending to contact ${contact.id}:`,
                sendErr
              );
              failedCount++;
            }
          }

          // Complete Campaign status
          await db
            .from('broadcasts')
            .update({
              status: 'sent',
              total_recipients: contacts.length,
              sent_count: sentCount,
              failed_count: failedCount,
            })
            .eq('id', campaign.id)
            .eq('account_id', campaignAccountId);

          totalDispatched++;

          // Handle Recurrence Clones
          if (campaign.recurrence && campaign.recurrence !== 'none') {
            const nextScheduled = getNextRecurringDate(
              campaign.scheduled_at,
              campaign.recurrence
            );
            const cloneCampaign = {
              account_id: campaign.account_id,
              user_id: campaign.user_id,
              name: campaign.name,
              template_name: campaign.template_name,
              template_language: campaign.template_language,
              template_variables: campaign.template_variables,
              audience_filter: campaign.audience_filter,
              status: 'scheduled' as const,
              total_recipients: 0,
              sent_count: 0,
              delivered_count: 0,
              read_count: 0,
              replied_count: 0,
              failed_count: 0,
              category: campaign.category,
              message_body: campaign.message_body,
              attachment_url: campaign.attachment_url,
              attachment_type: campaign.attachment_type,
              cta_type: campaign.cta_type,
              cta_text: campaign.cta_text,
              cta_url: campaign.cta_url,
              recurrence: campaign.recurrence,
              scheduled_at: nextScheduled.toISOString(),
              ai_suggested: campaign.ai_suggested,
            };

            await db.from('broadcasts').insert(cloneCampaign);
            console.log(
              `[Cron Campaigns] Cloned and rescheduled campaign "${campaign.name}" for ${nextScheduled.toISOString()}`
            );
          }
        } catch (campErr: unknown) {
          console.error(
            `[Cron Campaigns] Failed executing campaign ${campaign.id}:`,
            campErr
          );
          errors.push(
            `Campaign ${campaign.id}: ${(campErr as Error).message || String(campErr)}`
          );
          await db
            .from('broadcasts')
            .update({ status: 'failed' })
            .eq('id', campaign.id)
            .eq('account_id', campaign.account_id);
        }
      }
    }

    // ════════════════════════════════════════════════════════════
    // 2. AUTOMATED REVIEW REQUEST CAMPAIGNS
    // ════════════════════════════════════════════════════════════
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayAppts } = await db
      .from('appointments')
      .select(
        'id, patient_id, doctor_id, appointment_date, account_id, doctor:hospital_doctors(name)'
      )
      .eq('appointment_date', yesterdayStr)
      .eq('status', 'Completed')
      .eq('review_request_sent', false);

    if (yesterdayAppts && yesterdayAppts.length > 0) {
      console.log(
        `[Cron Campaigns] Sending review requests for ${yesterdayAppts.length} completed appointments.`
      );
      for (const appt of yesterdayAppts) {
        try {
          if (!appt.account_id) continue;
          const { data: contact } = await db
            .from('contacts')
            .select('*')
            .eq('id', appt.patient_id)
            .eq('account_id', appt.account_id)
            .maybeSingle();
          const { data: account } = await db
            .from('accounts')
            .select('name, review_link')
            .eq('id', appt.account_id)
            .single();

          if (contact && contact.phone) {
            let { data: conv } = await db
              .from('conversations')
              .select('id')
              .eq('account_id', appt.account_id)
              .eq('contact_id', contact.id)
              .maybeSingle();
            if (!conv) {
              const { data: newConv } = await db
                .from('conversations')
                .insert({
                  account_id: appt.account_id,
                  contact_id: contact.id,
                  status: 'open',
                })
                .select('id')
                .single();
              conv = newConv;
            }

            if (conv) {
              const docData = appt.doctor as
                { name?: string } | { name?: string }[] | null;
              const docName =
                (Array.isArray(docData) ? docData[0]?.name : docData?.name) ||
                'your doctor';
              const reviewLink = account?.review_link || 'https://google.com';

              const feedbackMsg = `Hi ${contact.name || 'there'}, thank you for visiting Dr. ${docName} at ${account?.name || 'our hospital'} yesterday.

We hope you had a comfortable experience! Could you please share your valuable feedback by leaving us a review? It only takes 1 minute:

⭐ Review Link: ${reviewLink}

Your support helps us serve you better!`;

              await engineSendText({
                accountId: appt.account_id,
                userId: '00000000-0000-0000-0000-000000000000',
                conversationId: conv.id,
                contactId: contact.id,
                text: feedbackMsg,
              });

              // Create timeline log
              await db.from('contact_notes').insert({
                account_id: appt.account_id,
                contact_id: contact.id,
                note_text: `[Automated Review Campaign] Sent review request for yesterday's appointment with Dr. ${docName}.`,
              });

              totalAutomatedReviews++;
            }
          }

          // Mark review request sent
          await db
            .from('appointments')
            .update({ review_request_sent: true })
            .eq('id', appt.id)
            .eq('account_id', appt.account_id);
        } catch (apptErr) {
          console.error(
            `[Cron Campaigns] Review campaign error on appt ${appt.id}:`,
            apptErr
          );
        }
      }
    }

    // ════════════════════════════════════════════════════════════
    // 3. AUTOMATED 6-MONTH INACTIVE PATIENT FOLLOW-UPS
    // ════════════════════════════════════════════════════════════
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Find patients whose last_followup_sent_at is null or older than 30 days
    // and who registered exactly 6 months ago (or no visits since)
    const { data: inactivePatients } = await db
      .from('patients')
      .select('id, account_id, last_followup_sent_at, contact:contacts(*)')
      .lt('created_at', sixMonthsAgo.toISOString())
      .or(
        `last_followup_sent_at.is.null,last_followup_sent_at.lt.${sixMonthsAgo.toISOString()}`
      );

    if (inactivePatients && inactivePatients.length > 0) {
      console.log(
        `[Cron Campaigns] Reviewing ${inactivePatients.length} inactive patients for follow-ups.`
      );
      for (const patient of inactivePatients) {
        try {
          const contact = (
            Array.isArray(patient.contact)
              ? patient.contact[0]
              : patient.contact
          ) as { id: string; name?: string; phone?: string } | null;
          if (contact && contact.phone && patient.account_id) {
            // Confirm they don't have any appointments in the last 6 months
            const { count } = await db
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', patient.account_id)
              .eq('patient_id', patient.id)
              .gte('appointment_date', sixMonthsAgoStr);

            if (count === 0) {
              // Trigger follow-up text invitation
              let { data: conv } = await db
                .from('conversations')
                .select('id')
                .eq('account_id', patient.account_id)
                .eq('contact_id', contact.id)
                .maybeSingle();
              if (!conv) {
                const { data: newConv } = await db
                  .from('conversations')
                  .insert({
                    account_id: patient.account_id,
                    contact_id: contact.id,
                    status: 'open',
                  })
                  .select('id')
                  .single();
                conv = newConv;
              }

              if (conv) {
                const { data: account } = await db
                  .from('accounts')
                  .select('name')
                  .eq('id', patient.account_id)
                  .single();
                const inviteMsg = `Hi ${contact.name || 'there'}, it has been 6 months since your last consultation at ${account?.name || 'our clinic'}.

Keeping up with routine check-ups is essential for preventive wellness and long-term health. 

Would you like to schedule a follow-up consultation?

💬 Reply *BOOK* to speak with our AI Receptionist and reserve your slot immediately.`;

                await engineSendText({
                  accountId: patient.account_id,
                  userId: '00000000-0000-0000-0000-000000000000',
                  conversationId: conv.id,
                  contactId: contact.id,
                  text: inviteMsg,
                });

                // Update timeline note
                await db.from('contact_notes').insert({
                  account_id: patient.account_id,
                  contact_id: contact.id,
                  note_text: `[Automated Follow-up Campaign] Sent 6-month preventive check-up invitation.`,
                });

                totalAutomatedFollowups++;
              }

              // Update last followup timestamp
              await db
                .from('patients')
                .update({ last_followup_sent_at: new Date().toISOString() })
                .eq('id', patient.id)
                .eq('account_id', patient.account_id);
            }
          }
        } catch (patErr) {
          console.error(
            `[Cron Campaigns] Followup campaign error on patient ${patient.id}:`,
            patErr
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      campaigns_dispatched: totalDispatched,
      automated_reviews_sent: totalAutomatedReviews,
      automated_followups_sent: totalAutomatedFollowups,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    console.error('[Cron Campaigns] Fatal cron error:', err);
    return NextResponse.json(
      { error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
