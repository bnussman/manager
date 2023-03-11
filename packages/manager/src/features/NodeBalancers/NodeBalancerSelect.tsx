import * as React from 'react';
import { NodeBalancer } from '@linode/api-v4/lib/nodebalancers';
import EnhancedSelect, { Item } from 'src/components/EnhancedSelect/Select';
import { Props as TextFieldProps } from 'src/components/TextField';
import { useAllNodeBalancersQuery } from 'src/queries/nodebalancers';
import { getErrorStringOrDefault } from 'src/utilities/errorUtils';

interface Props {
  generalError?: string;
  nodeBalancerError?: string;
  selectedNodeBalancer: number | null;
  disabled?: boolean;
  region?: string;
  handleChange: (nodeBalancer: NodeBalancer) => void;
  textFieldProps?: TextFieldProps;
}

const nodeBalancersToItems = (nodeBalancers: NodeBalancer[]): Item<number>[] =>
  nodeBalancers.map((thisNodeBalancer) => ({
    value: thisNodeBalancer.id,
    label: thisNodeBalancer.label,
    data: thisNodeBalancer,
  }));

const nodeBalancerFromItems = (
  nodeBalancers: Item<number>[],
  nodeBalancerId: number | null
) => {
  if (!nodeBalancerId) {
    return;
  }
  return nodeBalancers.find(
    (thisNodeBalancer) => thisNodeBalancer.value === nodeBalancerId
  );
};

const NodeBalancerSelect = (props: Props) => {
  const {
    disabled,
    generalError,
    handleChange,
    nodeBalancerError,
    region,
    selectedNodeBalancer,
  } = props;

  const { data, isLoading, error } = useAllNodeBalancersQuery();

  const filteredData = region
    ? data?.filter((thisNodeBalancer) => thisNodeBalancer.region === region)
    : data;

  const options = nodeBalancersToItems(filteredData ?? []);

  const noOptionsMessage =
    !nodeBalancerError && !isLoading && options.length === 0
      ? 'You have no NodeBalancers to choose from'
      : 'No Options';

  return (
    <EnhancedSelect
      label="NodeBalancer"
      placeholder="Select a NodeBalancer"
      value={nodeBalancerFromItems(options, selectedNodeBalancer)}
      options={options}
      disabled={disabled}
      isLoading={isLoading}
      onChange={(selected: Item<number>) => {
        return handleChange(selected.data);
      }}
      errorText={getErrorStringOrDefault(
        generalError || nodeBalancerError || error?.[0].reason || ''
      )}
      isClearable={false}
      textFieldProps={props.textFieldProps}
      noOptionsMessage={() => noOptionsMessage}
    />
  );
};

export default NodeBalancerSelect;
