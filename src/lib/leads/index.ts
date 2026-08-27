export type {
  FollowupPolicy,
  FollowupStatus,
  FollowupStopReason,
  InboundLeadContext,
  LeadDetectionResult,
  LeadIntentLevel,
  LeadScoreLabel,
  OutboundGuardDecision,
  QualificationField,
  QualificationSnapshot,
} from '@/lib/leads/types';
export {
  DEFAULT_FOLLOWUP_POLICY,
  FOLLOWUP_STATUSES,
  LEAD_LAYER_EVENTS,
} from '@/lib/leads/types';
export {
  detectionFromInsights,
  heuristicDetection,
  looksLikeBusinessEnquiry,
  looksLikeGreeting,
  validateLeadDetection,
} from '@/lib/leads/lead-detection.service';
export {
  buildQualificationSnapshot,
  computeLeadScore,
  qualificationFieldsForIndustry,
  qualificationPromptHint,
} from '@/lib/leads/lead-qualification.service';
export { detectStopIntent } from '@/lib/leads/stop-intent';
export {
  applyDetectionToLead,
  handleCustomerReply,
  processInboundLeadDetection,
} from '@/lib/leads/inbound-lead-layer';
export {
  findActiveLead,
  upsertLeadFromDetection,
} from '@/lib/leads/lead-conversion.service';
export {
  cancelScheduledFollowups,
  pauseFollowupsForConversation,
  processDueLeadFollowups,
  scheduleLeadReminder,
  stopFollowupsForLead,
} from '@/lib/leads/lead-followup.service';
export {
  evaluateDelayedOutboundGuard,
  evaluateGuardSnapshot,
} from '@/lib/leads/followup-guard.service';
