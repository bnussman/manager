import { allocateIPAddress } from '@linode/api-v4';

export const allocatePublicIP = (linodeId: number) =>
  allocateIPAddress(linodeId, { type: 'ipv4', public: true });

export const allocatePrivateIP = (linodeId: number) =>
  allocateIPAddress(linodeId, { type: 'ipv4', public: false });
