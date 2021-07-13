import { APIWarning } from '@linode/api-v4/lib/types';
import { PaymentMethod } from '@linode/api-v4';
import * as classnames from 'classnames';
import * as React from 'react';
import makeAsyncScriptLoader from 'react-async-script';
import { compose } from 'recompose';
import { v4 } from 'uuid';
import { useSnackbar } from 'notistack';
import Divider from 'src/components/core/Divider';
import { makeStyles, Theme } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import Currency from 'src/components/Currency';
import Drawer from 'src/components/Drawer';
import ErrorState from 'src/components/ErrorState';
import Grid from 'src/components/Grid';
import Notice from 'src/components/Notice';
import SupportLink from 'src/components/SupportLink';
import TextField from 'src/components/TextField';
import AccountContainer, {
  DispatchProps as AccountDispatchProps,
} from 'src/containers/account.container';
import useFlags from 'src/hooks/useFlags';
import CreditCardPayment from './CreditCardPayment';
import PayPal, { paypalScriptSrc } from './Paypal';
import { SetSuccess } from './types';
import GooglePayButton from './GooglePayButton';
import LinearProgress from 'src/components/LinearProgress';

// @TODO: remove unused code and feature flag logic once google pay is released
const useStyles = makeStyles((theme: Theme) => ({
  root: {},
  currentBalance: {
    fontSize: '1.1rem',
    marginBottom: theme.spacing(4),
  },
  credit: {
    color: '#02b159',
  },
  header: {
    fontSize: '1.1rem',
    marginBottom: theme.spacing(4),
  },
  progress: {
    marginBottom: 18,
    width: '100%',
    height: 5,
  },
}));

interface Props {
  open: boolean;
  paymentMethods: PaymentMethod[] | undefined;
  onClose: () => void;
}

interface AccountContextProps {
  accountLoading: boolean;
  balance: false | number;
}

export type CombinedProps = Props & AccountContextProps & AccountDispatchProps;

export const getMinimumPayment = (balance: number | false) => {
  if (!balance || balance <= 0) {
    return '5.00';
  }
  /**
   * We follow the API's validation logic:
   *
   * If balance > 5 then min payment is $5
   * If balance < 5 but > 0, min payment is their balance
   * If balance < 0 then min payment is $5
   */
  return Math.min(5, balance).toFixed(2);
};

const AsyncPaypal = makeAsyncScriptLoader(paypalScriptSrc())(PayPal);

export const PaymentDrawer: React.FC<CombinedProps> = (props) => {
  const { accountLoading, balance, paymentMethods, open, onClose } = props;
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();
  const flags = useFlags();

  const showGooglePay = flags.additionalPaymentMethods?.includes('google_pay');

  /**
   * Show actual credit card instead of Google Pay card
   *
   * @TODO: If a user has multiple credit cards and clicks 'Make a Payment' through the
   * payment method actions dropdown, display that credit card instead of the first one
   */
  const creditCard = paymentMethods?.filter(
    (payment) => payment.type === 'credit_card'
  )[0]?.data;

  const [usd, setUSD] = React.useState<string>(getMinimumPayment(balance));
  const [warning, setWarning] = React.useState<APIWarning | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [creditCardKey, setCreditCardKey] = React.useState<string>(v4());
  const [payPalKey, setPayPalKey] = React.useState<string>(v4());
  const [
    isPaypalScriptLoaded,
    setIsPaypalScriptLoaded,
  ] = React.useState<boolean>(false);

  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  React.useEffect(() => {
    setUSD(getMinimumPayment(balance));
  }, [balance]);

  React.useEffect(() => {
    if (open) {
      setWarning(null);
      setErrorMessage(null);
      setIsProcessing(false);
    }
  }, [open]);

  const handleUSDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUSD(e.target.value || '');
  };

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formattedUSD = Number(e.target.value).toFixed(2) || '';
    setUSD(formattedUSD);
  };

  const setSuccess: SetSuccess = (
    message,
    paymentWasMade = false,
    warnings = undefined
  ) => {
    if (paymentWasMade) {
      enqueueSnackbar(message, {
        variant: 'success',
      });
      // Reset everything
      setUSD('0.00');
      setCreditCardKey(v4());
      setPayPalKey(v4());
      props.requestAccount();
      onClose();
    }
    if (warnings && warnings.length > 0) {
      setWarning(warnings[0]);
    }
  };

  const minimumPayment = getMinimumPayment(balance || 0);

  if (!accountLoading && balance === undefined) {
    return (
      <Grid container>
        <ErrorState errorText="You are not authorized to view billing information" />
      </Grid>
    );
  }

  const onScriptLoad = () => {
    setIsPaypalScriptLoaded(true);
  };

  return (
    <Drawer title="Make a Payment" open={open} onClose={onClose}>
      <Grid container>
        <Grid item xs={12}>
          {errorMessage && <Notice error text={errorMessage ?? ''} />}
          {warning ? <Warning warning={warning} /> : null}
          {isProcessing ? (
            <LinearProgress className={classes.progress} />
          ) : null}
          {balance !== false && (
            <Grid item>
              <Typography variant="h3" className={classes.currentBalance}>
                <strong>
                  Current balance:{' '}
                  <span
                    className={classnames({ [classes.credit]: balance < 0 })}
                  >
                    <Currency quantity={Math.abs(balance)} />
                    {balance < 0 ? ' Credit' : ''}
                  </span>
                </strong>
              </Typography>
            </Grid>
          )}
          <Grid item xs={6}>
            <TextField
              label="Payment Amount"
              onChange={handleUSDChange}
              onBlur={handleOnBlur}
              value={usd}
              type="number"
              placeholder={`${minimumPayment} minimum`}
              disabled={isProcessing}
            />
          </Grid>
          <Divider spacingTop={32} spacingBottom={16} />
          <CreditCardPayment
            key={creditCardKey}
            type={creditCard?.card_type}
            lastFour={creditCard?.last_four ?? ''}
            expiry={creditCard?.expiry ?? ''}
            disabled={isProcessing}
            usd={usd}
            minimumPayment={minimumPayment}
            setSuccess={setSuccess}
          />
          <Divider spacingTop={32} spacingBottom={16} />
          {showGooglePay ? (
            <>
              <Grid item>
                <Typography variant="h3" className={classes.header}>
                  <strong>Or pay via:</strong>
                </Typography>
              </Grid>
              <Grid container>
                <Grid item>
                  <AsyncPaypal
                    key={payPalKey}
                    usd={usd}
                    setSuccess={setSuccess}
                    asyncScriptOnLoad={onScriptLoad}
                    isScriptLoaded={isPaypalScriptLoaded}
                    disabled={isProcessing}
                  />
                </Grid>
                <Grid item xs={9} sm={6}>
                  <GooglePayButton
                    transactionInfo={{
                      totalPriceStatus: 'FINAL',
                      currencyCode: 'USD',
                      countryCode: 'US',
                      totalPrice: usd,
                    }}
                    balance={balance}
                    disabled={isProcessing}
                    setSuccess={setSuccess}
                    setError={setErrorMessage}
                    setProcessing={setIsProcessing}
                  />
                </Grid>
              </Grid>
            </>
          ) : (
            <AsyncPaypal
              key={payPalKey}
              usd={usd}
              setSuccess={setSuccess}
              asyncScriptOnLoad={onScriptLoad}
              isScriptLoaded={isPaypalScriptLoaded}
            />
          )}
        </Grid>
      </Grid>
    </Drawer>
  );
};

interface WarningProps {
  warning: APIWarning;
}

const Warning: React.FC<WarningProps> = (props) => {
  const { warning } = props;
  /** The most common API warning includes "please open a Support ticket",
   * which we'd like to be a link.
   */
  const ticketLink = warning.detail.match(/open a support ticket\./i) ? (
    <>
      {warning.detail.replace(/open a support ticket\./i, '')}
      <SupportLink
        text="open a Support ticket"
        title={`Re: ${warning.detail}`}
      />
      .
    </>
  ) : (
    warning.detail
  );
  const message = (
    <>
      {warning.title} {ticketLink}
    </>
  );
  return <Notice warning>{message}</Notice>;
};

const withAccount = AccountContainer(
  (ownProps, { accountLoading, accountData }) => ({
    accountLoading,
    balance: accountData?.balance ?? false,
  })
);

export default compose<CombinedProps, Props>(withAccount)(PaymentDrawer);
