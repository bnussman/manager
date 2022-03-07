import { APIWarning } from '@linode/api-v4';
export type SetSuccess = (
  message: string | null,
  paymentWasMade?: boolean,
  warning?: APIWarning[]
) => void;
