import type {
  RankedTourPackage,
  TourPackageDeparture,
  TourPackageDetail,
  TourPackagePricing,
  TravelerRequirements,
} from './types';

const DESTINATION_ALIASES: Record<string, string> = {
  kashmir: 'kashmir',
  srinagar: 'kashmir',
  gulmarg: 'kashmir',
  pahalgam: 'kashmir',
  darjeeling: 'darjeeling',
  gangtok: 'sikkim',
  sikkim: 'sikkim',
  goa: 'goa',
  manali: 'manali',
  shimla: 'shimla',
  ladakh: 'ladakh',
  leh: 'ladakh',
  kerala: 'kerala',
  munnar: 'kerala',
  andaman: 'andaman',
  meghalaya: 'meghalaya',
  shillong: 'meghalaya',
  sundarban: 'sundarban',
  sundarbans: 'sundarban',
  puri: 'puri',
  jaipur: 'rajasthan',
  rajasthan: 'rajasthan',
  himachal: 'himachal',
  ooty: 'ooty',
  dubai: 'dubai',
  thailand: 'thailand',
  bali: 'bali',
  singapore: 'singapore',
  malaysia: 'malaysia',
  bhutan: 'bhutan',
  nepal: 'nepal',
  northeast: 'northeast',
};

const PACKAGE_TYPE_ALIASES: Array<{ match: RegExp; value: string }> = [
  { match: /\b(family|poribar|paribar)\b/i, value: 'Family' },
  { match: /\b(honeymoon|newly\s*wed)\b/i, value: 'Honeymoon' },
  { match: /\b(group|group\s*tour)\b/i, value: 'Group' },
  { match: /\b(adventure|trekking|trek)\b/i, value: 'Adventure' },
  { match: /\b(beach|samudra|sea\s*beach)\b/i, value: 'Beach' },
  { match: /\b(pilgrim|tirtha)\b/i, value: 'Pilgrimage' },
  { match: /\b(corporate|office\s*trip)\b/i, value: 'Corporate' },
  { match: /\b(leisure|holiday|vacation)\b/i, value: 'Leisure' },
];

const MONTHS: Array<{ match: RegExp; month: number }> = [
  { match: /\bjan(?:uary)?\b/i, month: 1 },
  { match: /\bfeb(?:ruary)?\b/i, month: 2 },
  { match: /\bmar(?:ch)?\b/i, month: 3 },
  { match: /\bapr(?:il)?\b/i, month: 4 },
  { match: /\bmay\b/i, month: 5 },
  { match: /\bjun(?:e)?\b/i, month: 6 },
  { match: /\bjul(?:y)?\b/i, month: 7 },
  { match: /\baug(?:ust)?\b/i, month: 8 },
  { match: /\bsep(?:t(?:ember)?)?\b/i, month: 9 },
  { match: /\boct(?:ober)?\b/i, month: 10 },
  { match: /\bnov(?:ember)?\b/i, month: 11 },
  { match: /\bdec(?:ember)?\b/i, month: 12 },
];

const PACKAGE_INTENT_RE =
  /\b(package|packages|tour|trip|itinerary|destination|hotel|inclusion|exclusion|departure|available|availability|budget|diner|din(?:er)?|night|nights|adult|adults|child|children|family|honeymoon|beach|koto|ache|chai|jete|suggest)\b/i;

function normalize(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[₹$,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function destinationKey(value: string | null | undefined): string {
  const normalized = normalize(value);
  if (!normalized) return '';
  return DESTINATION_ALIASES[normalized] || normalized;
}

function parseAmountFromSource(source: string): number | null {
  if (!source) return null;

  const lakh = source.match(
    /(?:budget\s*)?(\d+(?:\.\d+)?)\s*(?:lakh|lac|lacs|lakhs|\bl\b)/i
  );
  if (lakh) return Math.round(Number(lakh[1]) * 100000);

  const thousand = source.match(
    /(?:budget\s*)?(\d+(?:\.\d+)?)\s*(?:k|thousand|hajar)/i
  );
  if (thousand) return Math.round(Number(thousand[1]) * 1000);

  const labeled = source.match(
    /(?:budget|price|koto|within|under|max(?:imum)?)\s*(?:is|=|:|er)?\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})/i
  );
  if (labeled) return Number(labeled[1].replace(/[,\s]/g, ''));

  const compact = source.match(
    /(?:₹|rs\.?|inr)\s*(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})/i
  );
  if (compact) return Number(compact[1].replace(/[,\s]/g, ''));

  return null;
}

export function parseBudgetAmount(text: string): number | null {
  if (!text) return null;
  return parseAmountFromSource(text) ?? parseAmountFromSource(normalize(text));
}

export function parseDurationDays(text: string): {
  days: number | null;
  nights: number | null;
} {
  const daysMatch = text.match(
    /(\d{1,2})\s*(?:days?|diner|din(?:er)?|দিন(?:ের)?)/i
  );
  const nightsMatch = text.match(/(\d{1,2})\s*(?:nights?|rat|রাত)/i);
  const days = daysMatch ? Number(daysMatch[1]) : null;
  const nights = nightsMatch ? Number(nightsMatch[1]) : null;
  return {
    days: days && days > 0 ? days : nights ? nights + 1 : null,
    nights: nights && nights > 0 ? nights : days ? Math.max(0, days - 1) : null,
  };
}

export function parseTravelerCounts(text: string): {
  adults: number | null;
  children: number | null;
} {
  const adultsMatch = text.match(/(\d{1,2})\s*(?:adults?|jon\s*adult)/i);
  const childrenMatch = text.match(/(\d{1,2})\s*(?:child(?:ren)?|kids?)/i);
  return {
    adults: adultsMatch ? Number(adultsMatch[1]) : null,
    children: childrenMatch ? Number(childrenMatch[1]) : null,
  };
}

export function parseTravelDate(
  text: string,
  now = new Date()
): { month: number | null; date: string | null } {
  let month: number | null = null;
  for (const entry of MONTHS) {
    if (entry.match.test(text)) {
      month = entry.month;
      break;
    }
  }

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    return { month: Number(iso[1].slice(5, 7)), date: iso[1] };
  }

  const dayMonth = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );
  const monthDay = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );

  const monthToken = dayMonth?.[2] || monthDay?.[1];
  const dayToken = dayMonth?.[1] || monthDay?.[2];
  if (monthToken && dayToken) {
    const resolvedMonth =
      MONTHS.find((entry) => entry.match.test(monthToken))?.month || month;
    if (resolvedMonth) {
      const year = now.getFullYear();
      const candidate = new Date(
        Date.UTC(year, resolvedMonth - 1, Number(dayToken))
      );
      const useNextYear =
        candidate.getTime() + 86400000 <
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const finalYear = useNextYear ? year + 1 : year;
      const date = `${finalYear}-${String(resolvedMonth).padStart(2, '0')}-${String(Number(dayToken)).padStart(2, '0')}`;
      return { month: resolvedMonth, date };
    }
  }

  return { month, date: null };
}

export function parseDestination(text: string): string | null {
  const normalized = normalize(text);
  for (const [alias, canonical] of Object.entries(DESTINATION_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(normalized)) {
      return canonical.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  const patterned = text.match(
    /\b([A-Za-z][A-Za-z]+)(?:\s+(?:package|trip|tour|jete|jaabo|jabo))\b/i
  );
  if (patterned) return patterned[1];
  return null;
}

export function detectTourPackageIntent(text: string): boolean {
  return PACKAGE_INTENT_RE.test(text);
}

export function parseTravelerRequirements(
  text: string,
  now = new Date()
): TravelerRequirements {
  const duration = parseDurationDays(text);
  const counts = parseTravelerCounts(text);
  const when = parseTravelDate(text, now);
  const type = PACKAGE_TYPE_ALIASES.find((entry) => entry.match.test(text));
  const inclusion = text.match(
    /\b(hotel|breakfast|private car|transfer|visa|flight|lunch|dinner)\b/i
  );

  const itineraryDay = text.match(
    /\bday\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)?\s*din(?:er)?\b/i
  );

  return {
    destination: parseDestination(text),
    budget: parseBudgetAmount(text),
    durationDays: duration.days,
    durationNights: duration.nights,
    adults: counts.adults,
    children: counts.children,
    packageType: type?.value || null,
    category: /\bbeach\b/i.test(text)
      ? 'Beach'
      : /\bluxury\b/i.test(text)
        ? 'Luxury'
        : /\bbudget\b/i.test(text)
          ? 'Budget'
          : null,
    travelMonth: when.month,
    travelDate: when.date,
    itineraryDay: itineraryDay
      ? Number(itineraryDay[1] || itineraryDay[2])
      : null,
    inclusionQuery: inclusion?.[1] || null,
    query: text.trim(),
    packageIntent: detectTourPackageIntent(text),
  };
}

function inDateRange(
  value: string | null | undefined,
  from: string | null | undefined,
  until: string | null | undefined
): boolean {
  if (!value) return true;
  if (from && value < from) return false;
  if (until && value > until) return false;
  return true;
}

export function isPackageCurrentlyActive(
  pkg: Pick<TourPackageDetail, 'status' | 'valid_from' | 'valid_until'>,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (pkg.status !== 'active') return false;
  if (pkg.valid_from && pkg.valid_from > today) return false;
  if (pkg.valid_until && pkg.valid_until < today) return false;
  return true;
}

export function isDepartureBookable(departure: TourPackageDeparture): boolean {
  if (departure.status !== 'open') return false;
  if (departure.available_seats != null && departure.available_seats <= 0) {
    return false;
  }
  return true;
}

export function resolvePackagePrice(
  pkg: TourPackageDetail,
  requirements: TravelerRequirements
): { price: number | null; currency: string; pricing: TourPackagePricing | null } {
  const occupancyRequested =
    requirements.adults != null || requirements.children != null;

  if (occupancyRequested) {
    const occupancyMatches = pkg.pricing.filter((row) => {
      if (requirements.adults != null && row.adults !== requirements.adults) {
        return false;
      }
      if (
        requirements.children != null &&
        row.children !== requirements.children
      ) {
        return false;
      }
      if (
        requirements.travelDate &&
        !inDateRange(requirements.travelDate, row.valid_from, row.valid_until)
      ) {
        return false;
      }
      return true;
    });

    if (occupancyMatches.length > 0) {
      const cheapest = occupancyMatches.reduce((best, row) =>
        row.price < best.price ? row : best
      );
      return {
        price: cheapest.price,
        currency: cheapest.currency || pkg.currency,
        pricing: cheapest,
      };
    }
  }

  if (pkg.starting_price != null) {
    return {
      price: Number(pkg.starting_price),
      currency: pkg.currency,
      pricing: null,
    };
  }

  if (pkg.pricing.length > 0) {
    const cheapest = pkg.pricing.reduce((best, row) =>
      row.price < best.price ? row : best
    );
    return {
      price: cheapest.price,
      currency: cheapest.currency || pkg.currency,
      pricing: cheapest,
    };
  }

  return { price: null, currency: pkg.currency, pricing: null };
}

function findMatchingDeparture(
  pkg: TourPackageDetail,
  requirements: TravelerRequirements
): TourPackageDeparture | null {
  const open = pkg.departures.filter(isDepartureBookable);
  if (requirements.travelDate) {
    return (
      open.find((row) => row.departure_date === requirements.travelDate) || null
    );
  }
  if (requirements.travelMonth) {
    return (
      open.find((row) => {
        const month = Number(row.departure_date.slice(5, 7));
        return month === requirements.travelMonth;
      }) || null
    );
  }
  return open[0] || null;
}

export function rankTourPackages(
  packages: TourPackageDetail[],
  requirements: TravelerRequirements,
  today = new Date().toISOString().slice(0, 10)
): { matches: RankedTourPackage[]; nearMatches: RankedTourPackage[] } {
  const wantedDestination = destinationKey(requirements.destination);
  const ranked: RankedTourPackage[] = [];

  for (const pkg of packages) {
    if (!isPackageCurrentlyActive(pkg, today)) continue;

    const reasons: string[] = [];
    let score = pkg.featured ? 5 : 0;
    const pkgDestination = destinationKey(pkg.destination);
    const resolved = resolvePackagePrice(pkg, requirements);
    const departure = findMatchingDeparture(pkg, requirements);

    if (wantedDestination) {
      if (pkgDestination === wantedDestination) {
        score += 100;
        reasons.push('Exact destination');
      } else if (
        pkgDestination.includes(wantedDestination) ||
        wantedDestination.includes(pkgDestination) ||
        normalize(pkg.name).includes(wantedDestination)
      ) {
        score += 60;
        reasons.push('Related destination');
      } else {
        continue;
      }
    }

    if (requirements.durationDays != null) {
      const delta = Math.abs(pkg.duration_days - requirements.durationDays);
      if (delta === 0) {
        score += 40;
        reasons.push('Exact duration');
      } else if (delta === 1) {
        score += 20;
        reasons.push('Nearby duration');
      }
    }

    if (requirements.packageType) {
      if (
        normalize(pkg.package_type) === normalize(requirements.packageType) ||
        normalize(pkg.category) === normalize(requirements.packageType)
      ) {
        score += 20;
        reasons.push('Package type');
      }
    }

    if (requirements.inclusionQuery) {
      const haystack = [
        pkg.description,
        ...pkg.inclusions.map((row) => row.item),
        ...pkg.hotels.map((row) => `${row.hotel_name} ${row.meal_plan || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(requirements.inclusionQuery.toLowerCase())) {
        score += 10;
        reasons.push('Requested inclusion');
      }
    }

    if (requirements.travelDate || requirements.travelMonth) {
      if (departure) {
        score += 40;
        reasons.push('Date availability');
      } else if (
        inDateRange(requirements.travelDate, pkg.valid_from, pkg.valid_until)
      ) {
        score += 15;
        reasons.push('Valid in requested period');
      }
    }

    const fitsBudget =
      requirements.budget == null ||
      (resolved.price != null && resolved.price <= requirements.budget);

    if (requirements.budget != null && resolved.price != null && fitsBudget) {
      score += 50;
      reasons.push('Budget fit');
    }

    ranked.push({
      package: pkg,
      score,
      fitsBudget,
      reasons,
      matchedPrice: resolved.price,
      matchedCurrency: resolved.currency,
      matchedPricing: resolved.pricing,
      matchedDeparture: departure,
    });
  }

  ranked.sort((a, b) => b.score - a.score || (a.matchedPrice ?? 0) - (b.matchedPrice ?? 0));

  const matches = ranked.filter((row) => row.fitsBudget);
  const nearMatches = ranked.filter((row) => !row.fitsBudget);
  return { matches, nearMatches };
}

export function formatMoney(
  amount: number | null | undefined,
  currency = 'INR'
): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const value = Number(amount);
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${Math.round(value).toLocaleString('en-IN')}`;
}
