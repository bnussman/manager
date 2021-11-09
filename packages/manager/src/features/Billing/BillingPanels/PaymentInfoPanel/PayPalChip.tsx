import React, { useEffect } from 'react';
import { useClientToken } from 'src/queries/accountPayment';
import { makeStyles, Theme } from 'src/components/core/styles';
import HelpIcon from 'src/components/HelpIcon';
import CircleProgress from 'src/components/CircleProgress';
import { queryClient } from 'src/queries/base';
import { queryKey as accountPaymentKey } from 'src/queries/accountPayment';
import { addPaymentMethod } from '@linode/api-v4/lib/account/payments';
import { useSnackbar } from 'notistack';
import { APIError } from '@linode/api-v4/lib/types';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import classNames from 'classnames';
import { reportException } from 'src/exceptionReporting';
import {
  OnApproveBraintreeData,
  BraintreePayPalButtons,
  CreateBillingAgreementActions,
  FUNDING,
  OnApproveBraintreeActions,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js';

const useStyles = makeStyles((theme: Theme) => ({
  errorIcon: {
    color: theme.color.red,
    marginRight: -20,
    '&:hover': {
      color: theme.color.red,
      opacity: 0.7,
    },
    '& svg': {
      height: 28,
      width: 28,
    },
  },
  disabled: {
    // Allows us to disable the pointer on the PayPal button because the SDK does not
    pointerEvents: 'none',
  },
  button: {
    marginRight: -8,
  },
}));

interface Props {
  setProcessing: (processing: boolean) => void;
  onClose: () => void;
  disabled: boolean;
}

export const PayPalChip: React.FC<Props> = (props) => {
  const { onClose, disabled, setProcessing } = props;
  const { data, isLoading, error: clientTokenError } = useClientToken();
  const [{ options }, dispatch] = usePayPalScriptReducer();
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    /**
     * When the Braintree client token is received,
     * set the PayPal context only if the token has changed.
     * The '!==' statements makes sure we don't re-render
     * when this component is re-mounted.
     */
    if (
      data?.client_token &&
      options['data-client-token'] !== data.client_token
    ) {
      dispatch({
        type: 'resetOptions',
        value: {
          ...options,
          'data-client-token': data?.client_token,
          vault: true,
          commit: false,
          intent: 'tokenize',
        },
      });
    }
    // Intentionally only run this effect when client token data changes. We don't need to run
    // when the PayPal options change because we set them here with dispatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const createBillingAgreement = (
    _: Record<string, unknown>,
    actions: CreateBillingAgreementActions
  ) =>
    actions.braintree.createPayment({
      flow: 'vault',
    });

  const onApprove = async (
    data: OnApproveBraintreeData,
    actions: OnApproveBraintreeActions
  ) => {
    setProcessing(true);

    return actions.braintree
      .tokenizePayment(data)
      .then((payload) => onNonce(payload.nonce));
  };

  const onNonce = (nonce: string) => {
    addPaymentMethod({
      type: 'payment_method_nonce',
      data: { nonce },
      is_default: true,
    })
      .then(() => {
        queryClient.invalidateQueries(`${accountPaymentKey}-all`);

        onClose();

        enqueueSnackbar('Successfully added PayPal', {
          variant: 'success',
        });
      })
      .catch((errors: APIError[]) => {
        setProcessing(false);

        const error = getAPIErrorOrDefault(
          errors,
          'Unable to add payment method'
        )[0].reason;

        enqueueSnackbar(error, { variant: 'error' });

        reportException(error, {
          message: "Failed to add PayPal as a payment method with Linode's API",
        });
      });
  };

  const onError = (error: unknown) => {
    reportException(
      'A PayPal error occurred preventing a user from adding PayPal as a payment method.',
      { error }
    );
  };

  if (clientTokenError) {
    return (
      <HelpIcon
        className={classes.errorIcon}
        isError={true}
        size={35}
        text="Error loading PayPal."
      />
    );
  }

  if (isLoading || !options['data-client-token']) {
    return <CircleProgress mini />;
  }

  return (
    <div
      className={classNames({
        [classes.button]: true,
        [classes.disabled]: disabled,
      })}
    >
      <BraintreePayPalButtons
        disabled={disabled}
        style={{ height: 25 }}
        fundingSource={FUNDING.PAYPAL}
        createBillingAgreement={createBillingAgreement}
        onApprove={onApprove}
        onError={onError}
      />
    </div>
  );
};
