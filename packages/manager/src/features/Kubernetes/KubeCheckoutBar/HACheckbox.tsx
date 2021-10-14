import * as React from 'react';
import CheckBox from 'src/components/CheckBox';
import Box from 'src/components/core/Box';
import { makeStyles, Theme } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import DisplayPrice from 'src/components/DisplayPrice';
import Link from 'src/components/Link';
import { HIGH_AVAILABILITY_PRICE } from 'src/constants';

const useStyles = makeStyles((theme: Theme) => ({
  heading: {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(),
    fontSize: '16px',
    fontWeight: 600,
  },
  checkbox: {
    marginTop: -8,
    marginLeft: -8,
  },
  price: {
    marginTop: theme.spacing(),
  },
}));

export interface Props {
  checked: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => void;
}

const HACheckbox: React.FC<Props> = (props) => {
  const { checked, onChange } = props;
  const classes = useStyles();

  return (
    <Box>
      <Box display="flex" flexDirection="row" alignItems="flex-start">
        <CheckBox
          checked={checked}
          onChange={onChange}
          className={classes.checkbox}
          data-testid="ha-checkbox"
        />
        <Box>
          <Typography className={classes.heading}>
            Enable HA Control Plane
          </Typography>
          <Typography>
            A high availability control plane is replicated on multiple master
            nodes to provide a 99.99% uptime SLA for your Kubernetes cluster.
            Recommended for critical production workloads.{' '}
            <Link to="https://www.linode.com/docs/guides/kubernetes/">
              Learn more.
            </Link>
          </Typography>
        </Box>
      </Box>
      <Box className={classes.price}>
        <DisplayPrice
          price={HIGH_AVAILABILITY_PRICE}
          fontSize="16px"
          interval="month"
        />
      </Box>
    </Box>
  );
};

export default HACheckbox;
