import {
  TRAVEL_BOOKING_CONFIRM_BUTTON_ID,
  TRAVEL_BOOKING_LATER_BUTTON_ID,
} from '@/lib/travel/booking-confirm';
import { WorkflowSeed } from '../types';

export const workflowsConfig: WorkflowSeed[] = [
  {
    seedKey: 'traveler_intake_greeting',
    name: 'Traveler Intake Greeting',
    description: 'Welcome travel enquiries and start trip planning.',
    trigger_type: 'first_inbound_message',
    trigger_config: {},
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Welcome to our Travel Agency! How can we help you plan your next trip? Tell us the destination, travel dates, and number of guests.',
        },
      },
    ],
  },
  {
    seedKey: 'travel_package_enquiry',
    name: 'Tour Package Enquiry',
    description:
      'When a traveller asks about a package, itinerary, or destination, collect trip details for the AI consultant.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'tour package',
        'package details',
        'package price',
        'itinerary',
        'destination',
        'trip package',
        'honeymoon package',
        'family trip',
      ],
      match_type: 'contains',
    },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Happy to help with a Tour Package. Please share destination, travel month or dates, number of adults/children, and budget. I will match a real package from our catalog.',
        },
      },
    ],
  },
  {
    seedKey: 'travel_booking_confirm',
    name: 'Booking Confirm',
    description:
      'Sends the Booking Confirm template with a Confirm Booking button. Tapping the button creates the trip booking.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'booking confirm',
        'confirm booking',
        'confirm this booking',
        'confirm this trip',
        'book this package',
        'booking confirmation',
        'confirm the booking',
      ],
      match_type: 'contains',
    },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'Please confirm this Travel Booking:\n\nPackage: {{ travel.package_name }}\nTravel date: {{ travel.date }}\nGuests: {{ travel.guests }}\nTotal: {{ travel.total_price }}\n\nTap Confirm Booking to complete. If you do not see the button, reply 1.',
          travel_booking_confirm: true,
          buttons: [
            { id: TRAVEL_BOOKING_CONFIRM_BUTTON_ID, title: 'Confirm Booking' },
            { id: TRAVEL_BOOKING_LATER_BUTTON_ID, title: 'Not yet' },
          ],
        },
      },
    ],
  },
  {
    seedKey: 'travel_payment_followup',
    name: 'Travel Payment Follow-up',
    description:
      'When a traveller asks about payment or advance, collect payment details and assign the chat.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: [
        'payment',
        'pay now',
        'advance',
        'invoice',
        'token amount',
        'booking amount',
      ],
      match_type: 'contains',
    },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'We can share the payment details for this Travel Booking. Please confirm the package name and whether you want to pay the advance or the full amount. Our team will send the official payment link.',
        },
      },
      {
        step_type: 'assign_conversation',
        step_config: { mode: 'round_robin' },
      },
    ],
  },
  {
    seedKey: 'travel_documents_reminder',
    name: 'Travel Documents Reminder',
    description:
      'Reminds travellers what documents are needed for visa, tickets, and departure.',
    trigger_type: 'keyword_match',
    trigger_config: {
      keywords: ['visa', 'passport', 'documents', 'ticket', 'travel documents'],
      match_type: 'contains',
    },
    is_active: true,
    steps: [
      {
        step_type: 'send_message',
        step_config: {
          text: 'For this trip please keep these ready: valid passport, visa (if required), traveller names as on passport, and any medical or travel insurance papers. Reply with the destination and travel date if you want a package-specific checklist.',
        },
      },
    ],
  },
];
