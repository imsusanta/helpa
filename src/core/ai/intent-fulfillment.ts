/**
 * Compatibility export for existing Core AI consumers.
 *
 * The implementation lives in the shared application layer so industry
 * modules do not import Core AI and create a circular dependency.
 */
export {
  INTENT_FULFILLMENT_POLICY_MARKER,
  withIntentFulfillmentPolicy,
} from '@/lib/ai/intent-fulfillment';
