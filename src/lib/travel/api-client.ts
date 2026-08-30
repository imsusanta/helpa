import { salesApi } from '@/lib/sales/api-client';
import type { TourPackage, TourPackageDetail, TourPackageWriteInput } from './types';

export function travelPackagesApi<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  return salesApi<T>(path, options);
}

export function fetchTourPackages(query?: {
  search?: string;
  status?: string;
  destination?: string;
}): Promise<TourPackage[]> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.status) params.set('status', query.status);
  if (query?.destination) params.set('destination', query.destination);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return travelPackagesApi<TourPackage[]>(`/api/travel/tour-packages${suffix}`);
}

export function fetchTourPackage(id: string): Promise<TourPackageDetail> {
  return travelPackagesApi<TourPackageDetail>(`/api/travel/tour-packages/${id}`);
}

export function createTourPackageRequest(
  input: TourPackageWriteInput
): Promise<TourPackageDetail> {
  return travelPackagesApi<TourPackageDetail>('/api/travel/tour-packages', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTourPackageRequest(
  id: string,
  input: TourPackageWriteInput
): Promise<TourPackageDetail> {
  return travelPackagesApi<TourPackageDetail>(`/api/travel/tour-packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setTourPackageStatusRequest(
  id: string,
  status: 'active' | 'inactive'
): Promise<TourPackage> {
  return travelPackagesApi<TourPackage>(`/api/travel/tour-packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ statusOnly: true, status }),
  });
}

export function deleteTourPackageRequest(id: string): Promise<{ id: string }> {
  return travelPackagesApi<{ id: string }>(`/api/travel/tour-packages/${id}`, {
    method: 'DELETE',
  });
}
