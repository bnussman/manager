import React, { useEffect } from 'react';
import { useClientToken } from 'src/queries/accountPayment';
import { makeStyles, Theme } from 'src/components/core/styles';
import HelpIcon from 'src/components/HelpIcon';
import CircleProgress from 'src/components/CircleProgress';
import {
  BraintreePayPalButtons,
  FUNDING,
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
}));

export const PayPalChip: React.FC = () => {
  const { data, isLoading, error } = useClientToken();
  const [{ options }, dispatch] = usePayPalScriptReducer();
  const classes = useStyles();

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
          'data-client-token': data?.client_token,
          // vault: true,
          // billingAgreementDescription: 'Your agreement description',
          ...options,
        },
      });
    }
  }, [data]);

  if (error) {
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
    <BraintreePayPalButtons
      style={{ height: 25 }}
      fundingSource={FUNDING.PAYPAL}
      createBillingAgreement={async () => {
        return '';
      }}
      onApprove={(data, actions) => {
        return actions.braintree.tokenizePayment(data).then((payload) => {
          console.log(payload, data);
        });
      }}
    />
  );
};
