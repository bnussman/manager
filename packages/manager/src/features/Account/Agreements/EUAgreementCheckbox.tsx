import * as React from 'react';
import CheckBox from 'src/components/CheckBox';
import Box from 'src/components/core/Box';
import Tooltip from 'src/components/core/Tooltip';
import Typography from 'src/components/core/Typography';
import Link from 'src/components/Link';

interface Props {
  className?: string;
  disabled?: boolean;
  tooltip?: string;
  centerCheckbox?: boolean;
  checked: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    checked: boolean
  ) => void;
}

const EUAgreementCheckbox: React.FC<Props> = (props) => {
  const {
    checked,
    onChange,
    className,
    centerCheckbox,
    tooltip,
    disabled,
  } = props;

  const checkboxStyle = centerCheckbox
    ? { marginLeft: -8 }
    : { marginLeft: -8, marginTop: -5 };

  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems={centerCheckbox ? 'center' : 'flex-start'}
      className={className}
    >
      {disabled && tooltip ? (
        <Tooltip title={tooltip}>
          <div>
            <CheckBox
              checked={checked}
              onChange={onChange}
              disabled={disabled}
              style={checkboxStyle}
            />
          </div>
        </Tooltip>
      ) : (
        <CheckBox
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          style={checkboxStyle}
        />
      )}
      <Typography>
        I have read and agree to the{' '}
        <Link to="https://www.linode.com/legal-privacy/">
          Linode Privacy Policy
        </Link>{' '}
        and{' '}
        <Link to="https://www.linode.com/eu-model/">
          EU Standard Contractual Clauses
        </Link>
        , which govern the cross-border transfer of data relating to the
        European Economic Area.
      </Typography>
    </Box>
  );
};

export default EUAgreementCheckbox;
