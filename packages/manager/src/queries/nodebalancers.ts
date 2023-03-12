import {
  createNodeBalancer,
  createNodeBalancerConfig,
  CreateNodeBalancerConfig,
  CreateNodeBalancerPayload,
  deleteNodeBalancer,
  deleteNodeBalancerConfig,
  getNodeBalancer,
  getNodeBalancerConfigs,
  getNodeBalancers,
  getNodeBalancerStats,
  NodeBalancer,
  NodeBalancerConfig,
  NodeBalancerStats,
  updateNodeBalancer,
  updateNodeBalancerConfig,
} from '@linode/api-v4/lib/nodebalancers';
import { APIError, ResourcePage } from '@linode/api-v4/lib/types';
import { DateTime } from 'luxon';
import { useMutation, useQuery } from 'react-query';
import { parseAPIDate } from 'src/utilities/date';
import { getAll } from 'src/utilities/getAll';
import {
  itemInListCreationHandler,
  itemInListMutationHandler,
  queryClient,
  updateInPaginatedStore,
} from './base';

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
    [queryKey, 'list', params, filter],
    () => getNodeBalancers(params, filter),
    { keepPreviousData: true }
  );

export const useNodeBalancerQuery = (id: number) =>
  useQuery<NodeBalancer, APIError[]>([queryKey, id], () => getNodeBalancer(id));

export const useNodebalancerUpdateMutation = (id: number) =>
  useMutation<NodeBalancer, APIError[], Partial<NodeBalancer>>(
    (data) => updateNodeBalancer(id, data),
    {
      onSuccess(data) {
        queryClient.setQueryData([queryKey, id], data);
        updateInPaginatedStore([queryKey, 'list'], id, data);
      },
    }
  );

export const useNodebalancerDeleteMutation = (id: number) =>
  useMutation<{}, APIError[]>(() => deleteNodeBalancer(id), {
    onSuccess() {
      queryClient.invalidateQueries([queryKey, 'list']);
      queryClient.removeQueries([queryKey, id]);
    },
  });

export const useNodebalancerCreateMutation = () =>
  useMutation<NodeBalancer, APIError[], CreateNodeBalancerPayload>(
    createNodeBalancer,
    {
      onSuccess(data) {
        queryClient.invalidateQueries([queryKey, 'list']);
        queryClient.setQueryData([queryKey, data.id], data);
      },
    }
  );

export const useNodebalancerConfigCreateMutation = (id: number) =>
  useMutation<NodeBalancerConfig, APIError[], CreateNodeBalancerConfig>(
    (data) => createNodeBalancerConfig(id, data),
    itemInListCreationHandler([queryKey, id, 'configs'])
  );

export const useNodebalancerConfigUpdateMutation = (nodebalancerId: number) =>
  useMutation<
    NodeBalancerConfig,
    APIError[],
    Partial<CreateNodeBalancerConfig> & { configId: number }
  >(
    ({ configId, ...data }) =>
      updateNodeBalancerConfig(nodebalancerId, configId, data),
    itemInListMutationHandler([queryKey, nodebalancerId, 'configs'])
  );

export const useNodebalancerConfigDeleteMutation = (nodebalancerId: number) =>
  useMutation<{}, APIError[], { configId: number }>(
    ({ configId }) => deleteNodeBalancerConfig(nodebalancerId, configId),
    {
      onSuccess(_, vars) {
        queryClient.setQueryData<NodeBalancerConfig[]>(
          [queryKey, nodebalancerId, 'configs'],
          (oldData) => {
            return (oldData ?? []).filter(
              (config) => config.id !== vars.configId
            );
          }
        );
      },
    }
  );

export const useAllNodeBalancerConfigsQuery = (id: number) =>
  useQuery<NodeBalancerConfig[], APIError[]>([queryKey, id, 'configs'], () =>
    getAllNodeBalancerConfigs(id)
  );

export const getAllNodeBalancerConfigs = (id: number) =>
  getAll<NodeBalancerConfig>((params) =>
    getNodeBalancerConfigs(id, params)
  )().then((data) => data.data);

export const getAllNodeBalancers = () =>
  getAll<NodeBalancer>((params) => getNodeBalancers(params))().then(
    (data) => data.data
  );

// So sad. Please don't use
export const useAllNodeBalancersQuery = (enabled = true) =>
  useQuery<NodeBalancer[], APIError[]>([queryKey, 'all'], getAllNodeBalancers, {
    enabled,
  });
