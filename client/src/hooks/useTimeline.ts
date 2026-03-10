import { useQuery } from '@tanstack/react-query';
import { availabilityApi } from '../api/endpoints';

export function useTimeline(date: string, zoneId?: number) {
  return useQuery({
    queryKey: ['timeline', { date, zoneId }],
    queryFn: () => availabilityApi.timeline(date, zoneId),
    enabled: !!date,
  });
}
