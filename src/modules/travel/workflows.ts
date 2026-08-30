import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    seedKey: 'traveler_intake_greeting',
    name: 'Traveler Intake Greeting',
    description: 'Auto-greets traveler inquiries.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Travel Agency! ✈ How can we help you plan your next trip?',
        },
      },
    ],
  },
  {
    seedKey: 'tour_package_enquiry',
    name: 'Tour Package Enquiry',
    description:
      'Collect destination, dates, and party size for tour package questions.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'package',
        'tour package',
        'trip',
        'holiday',
        'itinerary',
        'destination',
        'honeymoon',
        'group tour',
      ],
      match_type: 'contains',
    },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Happy to help with a tour package. Please share your destination (or say "any"), travel dates, and how many people are travelling. We will match you to a package from our list — we never invent prices or hotels.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  {
    seedKey: 'quote_follow_up',
    name: 'Quote Follow-up',
    description: 'Follow up on a new travel lead after 3 days.',
    trigger_type: 'lead_created',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'wait',
        step_config: { amount: 3, unit: 'days' },
      },
      {
        step_type: 'send_message',
        step_config: {
          text: 'Hi! Just checking in on your holiday quote. Do you have any questions about the itinerary, dates, or inclusions? Happy to adjust the package from our list.',
        },
      },
    ],
  },
  {
    seedKey: 'trip_booking_confirmation',
    name: 'Trip Booking Confirmation',
    description: 'Confirm a tour booking and send a short trip checklist.',
    trigger_type: 'appointment_created',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Your tour booking is confirmed. Please keep your ID/passport ready and review the itinerary we shared. Reply here if you need to change dates or traveller names.',
        },
      },
    ],
  },
  {
    seedKey: 'trip_departure_reminder',
    name: 'Trip Departure Reminder',
    description: 'Remind travellers 24 hours before departure.',
    trigger_type: 'appointment_reminder',
    trigger_config: { before_minutes: 1440 },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Reminder: your trip starts tomorrow. Please reconfirm pickup time, carry ID/passport, and check the packing list in your itinerary. Reply here if anything has changed.',
        },
      },
    ],
  },
];
