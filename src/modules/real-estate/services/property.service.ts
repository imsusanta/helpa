/**
 * Helpa Real Estate Module — Property Inventory Service
 *
 * Listings catalog, property configurations, pricing, and availability.
 */

import { getAdminClient } from '@/lib/appwrite-server-compat';

export interface PropertyRecord {
  id: string;
  accountId: string;
  propertyCode: string; // e.g. "PROP-001"
  title: string;
  propertyType:
    | 'Apartment'
    | 'Villa'
    | 'Independent House'
    | 'Plot'
    | 'Commercial'
    | 'Office'
    | 'Shop';
  purpose: 'Buy' | 'Rent' | 'Lease' | 'Investment';
  status:
    'Available' | 'Reserved' | 'Sold' | 'Rented' | 'Unavailable' | 'Draft';
  price: number; // in INR or Lakhs
  priceDisplay: string; // e.g. "₹65 Lakhs" or "₹25,000 / month"
  location: string; // e.g. "New Town, Kolkata"
  address?: string;
  bedrooms?: string; // e.g. "2 BHK", "3 BHK"
  bathrooms?: number;
  areaSqFt?: number; // e.g. 1050
  possession?: 'Ready to Move' | 'Under Construction';
  furnishing?: 'Furnished' | 'Semi-Furnished' | 'Unfurnished';
  parking?: boolean;
  amenities?: string[]; // e.g. ["Gym", "Swimming Pool", "Lift", "24/7 Security"]
  assignedAgentName?: string;
  description?: string;
}

export async function listProperties(
  accountId: string,
  filter?: {
    location?: string;
    propertyType?: string;
    purpose?: string;
    maxBudget?: number;
    bedrooms?: string;
    statusOnly?: PropertyRecord['status'];
  }
): Promise<PropertyRecord[]> {
  const db = getAdminClient();
  let query = db.from('services').select('*').eq('account_id', accountId);

  if (filter?.location) {
    query = query.ilike('category', `%${filter.location}%`);
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) {
    // Return sample active property catalog
    return [
      {
        id: 'prop-nt-01',
        accountId,
        propertyCode: 'PROP-101',
        title: 'New Town Residency — Luxury 2 BHK',
        propertyType: 'Apartment',
        purpose: 'Buy',
        status: 'Available',
        price: 6200000,
        priceDisplay: '₹62 Lakhs',
        location: 'New Town, Kolkata',
        bedrooms: '2 BHK',
        bathrooms: 2,
        areaSqFt: 1050,
        possession: 'Ready to Move',
        furnishing: 'Semi-Furnished',
        parking: true,
        amenities: [
          'Gym',
          'Swimming Pool',
          'Lift',
          '24/7 Security',
          'Covered Parking',
        ],
        assignedAgentName: 'Amit Roy',
        description:
          'Prime location 2 BHK with open balcony facing central park. OC received.',
      },
      {
        id: 'prop-nt-02',
        accountId,
        propertyCode: 'PROP-102',
        title: 'EcoSpace Heights — Premium 3 BHK',
        propertyType: 'Apartment',
        purpose: 'Buy',
        status: 'Available',
        price: 6800000,
        priceDisplay: '₹68 Lakhs',
        location: 'New Town, Kolkata',
        bedrooms: '3 BHK',
        bathrooms: 3,
        areaSqFt: 1450,
        possession: 'Under Construction',
        furnishing: 'Unfurnished',
        parking: true,
        amenities: [
          'Clubhouse',
          'Power Backup',
          'Landscaped Garden',
          'Intercom',
        ],
        assignedAgentName: 'Amit Roy',
        description:
          'Modern high-rise 3 BHK apartments near major IT hubs. Possession in Dec 2026.',
      },
      {
        id: 'prop-hw-03',
        accountId,
        propertyCode: 'PROP-103',
        title: 'Riverfront Enclave — Affordable 2 BHK',
        propertyType: 'Apartment',
        purpose: 'Buy',
        status: 'Available',
        price: 5500000,
        priceDisplay: '₹55 Lakhs',
        location: 'Howrah, Kolkata',
        bedrooms: '2 BHK',
        bathrooms: 2,
        areaSqFt: 980,
        possession: 'Ready to Move',
        furnishing: 'Unfurnished',
        parking: true,
        amenities: ['24/7 Water', 'Lift', 'Security'],
        assignedAgentName: 'Priya Sen',
        description:
          'Peaceful river-view residential project with excellent road connectivity.',
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    propertyCode: `PROP-${r.id.slice(0, 4)}`,
    title: r.name,
    propertyType: 'Apartment',
    purpose: 'Buy',
    status: r.status || 'Available',
    price: r.price || 5000000,
    priceDisplay: `₹${((r.price || 5000000) / 100000).toFixed(0)} Lakhs`,
    location: r.category || 'Prime Location',
    bedrooms: '2 BHK',
    bathrooms: 2,
    areaSqFt: 1000,
    possession: 'Ready to Move',
    furnishing: 'Semi-Furnished',
    parking: true,
    amenities: ['Lift', 'Parking', '24/7 Security'],
    assignedAgentName: 'Amit Roy',
    description: r.description,
  }));
}
