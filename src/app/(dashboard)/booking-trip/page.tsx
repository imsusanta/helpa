import AppointmentsPage from '@/app/(dashboard)/appointments/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Travel-specific route for the shared booking/appointment workflow.
 * The underlying workflow remains in AppointmentsPage so no booking logic is duplicated.
 */
export default function BookingTripPage() {
  return <AppointmentsPage />;
}
