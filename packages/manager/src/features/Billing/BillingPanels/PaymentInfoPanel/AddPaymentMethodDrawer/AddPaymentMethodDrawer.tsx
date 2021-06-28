import * as React from 'react';
import Divider from 'src/components/core/Divider';
import { makeStyles } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import Drawer from 'src/components/Drawer';
import Grid from 'src/components/Grid';
import GooglePayChip from '../GooglePayChip';

interface Props {
  open: boolean;
  onClose: () => void;
}

const useStyles = makeStyles(() => ({
  root: {
    marginTop: '4px',
  },
}));

export const AddPaymentMethodDrawer: React.FC<Props> = (props) => {
  const { onClose, open } = props;
  const classes = useStyles();

  return (
    <Drawer title="Add a Payment Method" open={open} onClose={onClose}>
      <Divider />
      <Grid container spacing={1} className={classes.root}>
        <Grid item xs={12} sm container alignItems="center">
          <Grid item xs container direction="column" spacing={1}>
            <Grid item xs>
              <Typography variant="h3">Google Pay</Typography>
            </Grid>
            <Grid item xs>
              <Typography>
                You&apos;ll be taken to Google Pay to complete sign up.
              </Typography>
            </Grid>
          </Grid>
          <Grid item>
            <GooglePayChip onAdd={onClose} />
          </Grid>
        </Grid>
      </Grid>
    </Drawer>
  );
};

export default AddPaymentMethodDrawer;
