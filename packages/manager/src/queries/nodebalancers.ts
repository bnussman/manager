import {
  deleteNodeBalancer,
  getNodeBalancer,
  getNodeBalancerConfigs,
  getNodeBalancers,
  getNodeBalancerStats,
  NodeBalancer,
  NodeBalancerConfig,
  NodeBalancerStats,
  updateNodeBalancer,
} from '@linode/api-v4/lib/nodebalancers';
import { APIError, ResourcePage } from '@linode/api-v4/lib/types';
import { DateTime } from 'luxon';
import { useMutation, useQuery } from 'react-query';
import { parseAPIDate } from 'src/utilities/date';
import { getAll } from 'src/utilities/getAll';
import { queryClient } from './base';

const queryKey = 'nodebalancers';
export const NODEBALANCER_STATS_NOT_READY_API_MESSAGE =
  'Stats are unavailable at this time.';

const getIsTooEarlyForStats = (created?: string) => {
  if (!created) {
    return false;
  }

  return parseAPIDate(created) > DateTime.local().minus({ minutes: 5 });
};

export const useNodeBalancerStats = (id: number, created?: string) => {
  return useQuery<NodeBalancerStats, APIError[]>(
    [`${queryKey}-stats`, id],
    getIsTooEarlyForStats(created)
      ? () =>
          Promise.reject([{ reason: NODEBALANCER_STATS_NOT_READY_API_MESSAGE }])
      : () => getNodeBalancerStats(id),
    // We need to disable retries because the API will
    // error if stats are not ready. If the default retry policy
    // is used, a "stats not ready" state can't be shown because the
    // query is still trying to request.
    { refetchInterval: 20000, retry: false }
  );
};

export const useNodeBalancersQuery = (params: any, filter: any) =>
  useQuery<ResourcePage<NodeBalancer>, APIError[]>(
    [queryKey, params, filter],
    () => getNodeBalancers(params, filter),
    { keepPreviousData: true }
  );

export const useNodeBalancerQuery = (id: number) =>
  useQuery<NodeBalancer, APIError[]>([queryKey, id], () => getNodeBalancer(id));

export const useNodebalancerUpdateMutation = (id: number) =>
  useMutation<NodeBalancer, APIError[], Partial<NodeBalancer>>(
    (data) => updateNodeBalancer(id, data),
    {
      onSuccess() {
        queryClient.invalidateQueries([queryKey]);
      },
    }
  );

export const useNodebalancerDeleteMutation = (id: number) =>
  useMutation<{}, APIError[]>(() => deleteNodeBalancer(id), {
    onSuccess() {
      queryClient.invalidateQueries([queryKey]);
    },
  });

export const useAllNodeBalancerConfigsQuery = (id: number) =>
  useQuery<NodeBalancerConfig[], APIError[]>([queryKey, id, 'configs'], () =>
    getAllNodeBalancerConfigs(id)
  );

const getAllNodeBalancerConfigs = (id: number) =>
  getAll<NodeBalancerConfig>((params) =>
    getNodeBalancerConfigs(id, params)
  )().then((data) => data.data);
