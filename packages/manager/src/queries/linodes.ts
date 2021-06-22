import { Linode, getLinodes } from '@linode/api-v4/lib/linodes';
import { APIError } from '@linode/api-v4/lib/types';
import { useQuery } from 'react-query';
import { getAll } from 'src/utilities/getAll';
import { listToItemsByID, queryPresets } from './base';

const getLinodesRequest = (passedParams: any = {}, passedFilter: any = {}) =>
  getLinodes(passedParams, passedFilter).then((data) => ({
    linodes: listToItemsByID(data.data),
    results: data.results,
  }));

const queryKey = 'linode';

interface LinodeData {
  results: number;
  linodes: Record<string, Linode>;
}

export const useLinodesQuery = (
  params: any = {},
  filter: any = {},
  enabled: boolean = true
) => {
  return useQuery<LinodeData, APIError[]>(
    [queryKey, params, filter],
    () => getLinodesRequest(params, filter),
    { ...queryPresets.longLived, enabled }
  );
};

const getAllLinodesRequest = (passedParams: any = {}, passedFilter: any = {}) =>
  getAll<Linode>((params, filter) =>
    getLinodes({ ...params, ...passedParams }, { ...filter, ...passedFilter })
  )().then((data) => ({
    linodes: listToItemsByID(data.data),
    results: data.results,
  }));

export const useAllLinodesQuery = (
  params: any = {},
  filter: any = {},
  enabled: boolean = true
) => {
  return useQuery<LinodeData, APIError[]>(
    [queryKey + '-all', params, filter],
    () => getAllLinodesRequest(params, filter),
    { ...queryPresets.longLived, enabled }
  );
};
