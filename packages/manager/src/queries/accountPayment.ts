import { getPaymentMethods, PaymentMethod } from '@linode/api-v4/lib/account';
import { APIError, ResourcePage } from '@linode/api-v4/lib/types';
import { useQuery } from 'react-query';
import { queryPresets } from './base';

const queryKey = 'account-payment-methods';

export const useAccountPaymentMethodsQuery = (params?: any) => {
  return useQuery<ResourcePage<PaymentMethod>, APIError[]>(
    [queryKey, params?.page, params?.page_size],
    () => getPaymentMethods(params),
    {
      ...queryPresets.longLived,
    }
  );
};
