import { createKubeClusterSchema } from '@linode/validation/lib/kubernetes.schema';
import { API_ROOT } from 'src/constants';
import Request, {
  setData,
  setMethod,
  setParams,
  setURL,
  setXFilter,
} from 'src/request';
import { ResourcePage as Page } from '../types';
import {
  CreateKubeClusterPayload,
  KubeConfigResponse,
  KubernetesCluster,
  KubernetesEndpointResponse,
  KubernetesVersion,
  LKEPlan,
} from './types';

/**
 * getKubernetesClusters
 *
 * Gets a list of a user's Kubernetes clusters
 */
export const getKubernetesClusters = (params?: any, filters?: any) =>
  Request<Page<KubernetesCluster>>(
    setMethod('GET'),
    setParams(params),
    setXFilter(filters),
    setURL(`${API_ROOT}/lke/clusters`)
  );

/**
 * getKubernetesCluster
 *
 * Return details about a single Kubernetes cluster
 */
export const getKubernetesCluster = (clusterID: number) =>
  Request<KubernetesCluster>(
    setMethod('GET'),
    setURL(`${API_ROOT}/lke/clusters/${clusterID}`)
  );

/**
 * createKubernetesClusters
 *
 * Create a new Cluster.
 */
export const createKubernetesCluster = (data: CreateKubeClusterPayload) =>
  Request<KubernetesCluster>(
    setMethod('POST'),
    setURL(`${API_ROOT}/lke/clusters`),
    setData(data, createKubeClusterSchema)
  );

/**
 * updateKubernetesCluster
 *
 * Create a new Cluster.
 */
export const updateKubernetesCluster = (
  clusterID: number,
  data: Partial<KubernetesCluster>
) =>
  Request<KubernetesCluster>(
    setMethod('PUT'),
    setURL(`${API_ROOT}/lke/clusters/${clusterID}`),
    setData(data)
  );

/**
 * deleteKubernetesCluster
 *
 * Delete the specified Cluster.
 */
export const deleteKubernetesCluster = (clusterID: number) =>
  Request<{}>(
    setMethod('DELETE'),
    setURL(`${API_ROOT}/lke/clusters/${clusterID}`)
  );

/** getKubeConfig
 *
 * Returns a base64 encoded string of a cluster's kubeconfig.yaml
 *
 * @param clusterId
 */

export const getKubeConfig = (clusterId: number) =>
  Request<KubeConfigResponse>(
    setMethod('GET'),
    setURL(`${API_ROOT}/lke/clusters/${clusterId}/kubeconfig`)
  );

/** getKubernetesVersions
 *
 * Returns a paginated list of available Kubernetes versions.
 *
 */

export const getKubernetesVersions = (params?: any, filters?: any) =>
  Request<Page<KubernetesVersion>>(
    setMethod('GET'),
    setXFilter(filters),
    setParams(params),
    setURL(`${API_ROOT}/lke/versions`)
  );

/** getKubernetesVersion
 *
 * Returns a single Kubernetes version by ID.
 *
 */

export const getKubernetesVersion = (versionID: string) =>
  Request<KubernetesVersion>(
    setMethod('GET'),
    setURL(`${API_ROOT}/lke/versions/${versionID}`)
  );

/** getKubernetesClusterEndpoint
 *
 * Returns the endpoint URL for a single Kubernetes cluster by ID.
 *
 */

export const getKubernetesClusterEndpoints = (clusterID: number) =>
  Request<Page<KubernetesEndpointResponse>>(
    setMethod('GET'),
    setURL(`${API_ROOT}/lke/clusters/${clusterID}/api-endpoints`)
  );

/** recycleClusterNodes
 *
 * Recycle all nodes in the target cluster (across all node pools)
 *
 */

export const recycleClusterNodes = (clusterID: number) =>
  Request<{}>(
    setMethod('POST'),
    setURL(`${API_ROOT}/lke/clusters/${clusterID}/recycle`)
  );

/**
 * getLKETypes
 *
 * @returns a page of LKE plan types
 */
export const getLKETypes = (params?: any) =>
  Request<Page<LKEPlan>>(
    setMethod('GET'),
    setParams(params),
    setURL(`${API_ROOT}/lke/types`)
  );

/**
 * getLKEType
 *
 * @param id {string} the id of a LKE plan
 * @returns the information for the requested LKE plan
 */
export const getLKEType = (id: string) =>
  Request<LKEPlan>(setMethod('GET'), setURL(`${API_ROOT}/lke/types/${id}`));
