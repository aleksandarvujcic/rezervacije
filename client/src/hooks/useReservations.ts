import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reservationsApi,
  availabilityApi,
  type CreateReservationData,
  type WalkinData,
  type AvailabilityParams,
} from '../api/endpoints';

export function useReservations(
  date?: string,
  status?: string,
  zoneId?: number
) {
  return useQuery({
    queryKey: ['reservations', { date, status, zoneId }],
    queryFn: () =>
      reservationsApi.list({
        date,
        status,
        zone_id: zoneId,
      }),
    enabled: !!date,
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReservationData) => reservationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CreateReservationData> & { status?: string };
    }) => reservationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => reservationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useWalkin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WalkinData) => reservationsApi.walkin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useAvailability(params: AvailabilityParams | null) {
  return useQuery({
    queryKey: ['availability', params],
    queryFn: () => availabilityApi.check(params!),
    enabled: !!params?.date && !!params?.time && !!params?.duration && !!params?.guests,
  });
}
