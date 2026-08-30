import { TourPackagesClient } from './tour-packages-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PackagesPage() {
  return <TourPackagesClient />;
}
