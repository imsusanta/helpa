/**
 * Helpa Real Estate Module — Agent Service
 *
 * Real Estate Agent directory, location assignments, and site visit scheduling availability.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface RealEstateAgentRecord {
  id: string;
  accountId: string;
  name: string;
  role: string; // e.g. "Senior Property Consultant", "Area Specialist"
  specialization: string;
  assignedLocations: string[]; // e.g. ["New Town", "Salt Lake", "Rajarhat"]
  phone: string;
  email?: string;
  status: 'Available' | 'Busy' | 'On Leave' | 'Inactive';
}

export async function listRealEstateAgents(
  accountId: string,
  location?: string
): Promise<RealEstateAgentRecord[]> {
  const db = getAdminClient();
  let query = db.from('staff').select('*').eq('account_id', accountId);

  if (location) {
    query = query.ilike('specialization', `%${location}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    return [
      {
        id: 'agent-amit-01',
        accountId,
        name: 'Amit Roy',
        role: 'Senior Property Consultant',
        specialization: 'Residential Apartments & Villas (New Town & Salt Lake)',
        assignedLocations: ['New Town', 'Salt Lake', 'Action Area 1'],
        phone: '+919876500001',
        status: 'Available',
      },
      {
        id: 'agent-priya-02',
        accountId,
        name: 'Priya Sen',
        role: 'Commercial & Rental Specialist',
        specialization: 'Commercial Office Space & Riverfront Properties (Howrah & Central)',
        assignedLocations: ['Howrah', 'Park Street', 'Sector 5'],
        phone: '+919876500002',
        status: 'Available',
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    role: r.role || 'Property Agent',
    specialization: r.specialization || 'Residential Properties',
    assignedLocations: r.working_days || ['New Town', 'Salt Lake'],
    phone: r.phone || '+919000000000',
    email: r.email,
    status: (r.status as RealEstateAgentRecord['status']) || 'Available',
  }));
}

/**
 * Calculates available site visit slots for an agent on a specific date.
 */
export async function getAgentSiteVisitSlots({
  accountId,
  agentName,
  dateStr,
}: {
  accountId: string;
  agentName?: string;
  dateStr: string;
}): Promise<string[]> {
  const db = getAdminClient();

  const { data: existingVisits } = await db
    .from('appointments')
    .select('*')
    .eq('account_id', accountId)
    .eq('appointment_date', dateStr)
    .neq('status', 'Cancelled');

  const bookedSlots = new Set<string>();
  if (existingVisits) {
    for (const visit of existingVisits) {
      if (!agentName || (visit.notes && visit.notes.includes(agentName))) {
        bookedSlots.add(visit.appointment_time);
      }
    }
  }

  const standardVisitSlots = [
    '10:00 AM',
    '11:30 AM',
    '02:00 PM',
    '03:30 PM',
    '05:00 PM',
  ];

  return standardVisitSlots.filter((slot) => !bookedSlots.has(slot));
}
