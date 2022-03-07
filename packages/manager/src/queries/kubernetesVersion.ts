import {
  getKubernetesVersions,
  KubernetesVersion,
} from '@linode/api-v4';
import { APIError } from '@linode/api-v4';
import { useQuery } from 'react-query';
import { queryPresets } from './base';

const _getVersions = () => {
  return getKubernetesVersions(
    {},
    { '+order_by': 'id', '+order': 'desc' }
  ).then((response) => response.data);
};

export const useKubernetesVersionQuery = () =>
  useQuery<KubernetesVersion[], APIError[]>(
    'k8s_versions',
    _getVersions,
    queryPresets.oneTimeFetch
  );
