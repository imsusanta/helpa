/**
 * Helpa Real Estate Module — Property Matching Engine
 *
 * Matches structured lead requirements against available property inventory,
 * calculates match quality score, and provides transparent explanations.
 */

import { listProperties, type PropertyRecord } from './property.service';
import { type PropertyRequirement } from './lead.service';

export interface PropertyMatchResult {
  property: PropertyRecord;
  score: number; // 0 to 100
  matchTier: 'Strong Match' | 'Good Match' | 'Partial Match';
  reasons: string[];
}

/**
 * Matches lead requirements against active available property inventory.
 */
export async function matchPropertiesToRequirement(
  accountId: string,
  requirement: PropertyRequirement
): Promise<PropertyMatchResult[]> {
  const allProperties = await listProperties(accountId);
  const available = allProperties.filter((p) => p.status === 'Available');

  const results: PropertyMatchResult[] = [];

  for (const prop of available) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Purpose Match (e.g. Buy vs Rent) - 20 pts
    if (
      !requirement.purpose ||
      prop.purpose.toLowerCase() === requirement.purpose.toLowerCase()
    ) {
      score += 20;
      reasons.push(`✓ Purpose matches (${prop.purpose})`);
    }

    // 2. Location Match - 30 pts
    const reqLoc = requirement.location.toLowerCase();
    const propLoc = prop.location.toLowerCase();
    if (propLoc.includes(reqLoc) || reqLoc.includes(propLoc)) {
      score += 30;
      reasons.push(`✓ Location matches (${prop.location})`);
    }

    // 3. Budget Match - 25 pts
    if (requirement.maxBudget) {
      const budgetInINR =
        requirement.maxBudget <= 1000
          ? requirement.maxBudget * 100000
          : requirement.maxBudget;
      if (prop.price <= budgetInINR) {
        score += 25;
        reasons.push(
          `✓ Price within budget (${prop.priceDisplay} ≤ ₹${requirement.maxBudget}L)`
        );
      }
    } else {
      score += 25;
    }

    // 4. Bedrooms Match - 15 pts
    if (requirement.bedrooms) {
      const reqBhk = requirement.bedrooms.replace(/\s+/g, '').toLowerCase();
      const propBhk = (prop.bedrooms || '').replace(/\s+/g, '').toLowerCase();
      if (reqBhk === propBhk || propBhk.includes(reqBhk)) {
        score += 15;
        reasons.push(`✓ ${prop.bedrooms} configuration matches`);
      }
    } else {
      score += 15;
    }

    // 5. Possession / Move-in Match - 10 pts
    if (requirement.possession && prop.possession) {
      if (
        requirement.possession.toLowerCase() === prop.possession.toLowerCase()
      ) {
        score += 10;
        reasons.push(`✓ ${prop.possession} preference matches`);
      }
    } else {
      score += 10;
    }

    const matchTier: PropertyMatchResult['matchTier'] =
      score >= 85
        ? 'Strong Match'
        : score >= 65
          ? 'Good Match'
          : 'Partial Match';

    results.push({
      property: prop,
      score,
      matchTier,
      reasons,
    });
  }

  // Sort descending by match score
  return results.sort((a, b) => b.score - a.score);
}
