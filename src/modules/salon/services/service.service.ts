/**
 * Helpa Salon Module — Service Catalog Service
 *
 * Treatment menu, service duration, and configurable pricing structure.
 */

import { getAdminClient } from '@/lib/db/server';

export type SalonServiceCategory =
  | 'Hair'
  | 'Hair Color'
  | 'Facial'
  | 'Skin Care'
  | 'Nails'
  | 'Makeup'
  | 'Spa'
  | 'Bridal'
  | 'Grooming'
  | 'Other';

export interface SalonServiceRecord {
  id: string;
  accountId: string;
  name: string;
  category: SalonServiceCategory;
  description?: string;
  durationMinutes: number; // e.g. 45
  price: number; // e.g. 500
  pricingType: 'Fixed' | 'Starting From' | 'Custom Quote';
  assignedStaffNames?: string[];
  status: 'Active' | 'Paused' | 'Archived';
  followUpDaysInterval?: number; // e.g. 30 days for Haircut, 45 for Hair Color
}

export async function listSalonServices(
  accountId: string,
  category?: string
): Promise<SalonServiceRecord[]> {
  const db = getAdminClient();
  let query = db.from('services').select('*').eq('account_id', accountId);

  if (category) {
    query = query.ilike('category', `%${category}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return sample salon treatment menu
    return [
      {
        id: 'srv-haircut-01',
        accountId,
        name: 'Haircut & Styling',
        category: 'Hair',
        description:
          'Customized precision haircut with wash and blow-dry styling.',
        durationMinutes: 45,
        price: 500,
        pricingType: 'Fixed',
        assignedStaffNames: ['Amit Roy', 'Neha Sen'],
        status: 'Active',
        followUpDaysInterval: 30,
      },
      {
        id: 'srv-haircolor-02',
        accountId,
        name: 'Global Hair Coloring & Highlights',
        category: 'Hair Color',
        description: 'Premium ammonia-free permanent color with gloss finish.',
        durationMinutes: 120,
        price: 2500,
        pricingType: 'Starting From',
        assignedStaffNames: ['Neha Sen'],
        status: 'Active',
        followUpDaysInterval: 45,
      },
      {
        id: 'srv-facial-03',
        accountId,
        name: 'Hydra-Glow Brightening Facial',
        category: 'Facial',
        description:
          'Deep pore cleansing, exfoliation, and instant hydration booster.',
        durationMinutes: 60,
        price: 1200,
        pricingType: 'Fixed',
        assignedStaffNames: ['Riya Das'],
        status: 'Active',
        followUpDaysInterval: 30,
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    category: (r.category as SalonServiceCategory) || 'Hair',
    description: r.description,
    durationMinutes: r.duration || 45,
    price: r.price || 500,
    pricingType:
      (r.pricing_type as SalonServiceRecord['pricingType']) || 'Fixed',
    assignedStaffNames: r.assigned_staff || [],
    status: r.status || 'Active',
    followUpDaysInterval: r.followup_days || 30,
  }));
}

export async function findSalonServiceByName(
  accountId: string,
  searchQuery: string
): Promise<SalonServiceRecord | undefined> {
  const services = await listSalonServices(accountId);
  const q = searchQuery.toLowerCase().trim();

  return services.find(
    (s) =>
      s.status === 'Active' &&
      (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
  );
}
