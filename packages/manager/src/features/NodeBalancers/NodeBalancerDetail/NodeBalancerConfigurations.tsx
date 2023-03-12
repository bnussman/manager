import {
  createNodeBalancerConfigNode,
  deleteNodeBalancerConfigNode,
  getNodeBalancerConfigNodes,
  NodeBalancerConfig,
  NodeBalancerConfigNode,
  updateNodeBalancerConfigNode,
} from '@linode/api-v4/lib/nodebalancers';
import { APIError } from '@linode/api-v4/lib/types';
import {
  append,
  clone,
  compose,
  defaultTo,
  Lens,
  lensPath,
  over,
  set,
  view,
} from 'ramda';
import * as React from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import Accordion from 'src/components/Accordion';
import ActionsPanel from 'src/components/ActionsPanel';
import Button from 'src/components/Button';
import ConfirmationDialog from 'src/components/ConfirmationDialog';
import { makeStyles, Theme } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import Grid from 'src/components/Grid';
import {
  getAllNodeBalancerConfigs,
  useAllNodeBalancerConfigsQuery,
  useNodebalancerConfigCreateMutation,
  useNodebalancerConfigDeleteMutation,
  useNodebalancerConfigUpdateMutation,
  useNodeBalancerQuery,
} from 'src/queries/nodebalancers';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import NodeBalancerConfigPanel from '../NodeBalancerConfigPanel';
import { lensFrom } from '../NodeBalancerCreate';
import { NodeBalancerConfigNodeFields } from '../types';
import {
  clampNumericString,
  createNewNodeBalancerConfig,
  createNewNodeBalancerConfigNode,
  NodeBalancerConfigFieldsWithStatus,
  nodeForRequest,
  parseAddress,
  parseAddresses,
  transformConfigsForRequest,
} from '../utils';

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  port: {
    marginRight: theme.spacing(2),
  },
  nbStatuses: {
    display: 'block',
    [theme.breakpoints.up('sm')]: {
      display: 'inline',
    },
  },
  button: {
    [theme.breakpoints.down('lg')]: {
      marginLeft: theme.spacing(),
    },
  },
}));

interface MatchProps {
  nodeBalancerId?: string;
  configId?: string;
}

const formatNodesStatus = (nodes: NodeBalancerConfigNodeFields[]) => {
  const statuses = nodes.reduce(
    (acc, node) => {
      if (node.status) {
        acc[node.status]++;
      }
      return acc;
    },
    { UP: 0, DOWN: 0, unknown: 0 }
  );

  return `Backend status: ${statuses.UP} up, ${statuses.DOWN} down${
    statuses.unknown ? `, ${statuses.unknown} unknown` : ''
  }`;
};

const defaultDeleteConfigConfirmDialogState = {
  submitting: false,
  open: false,
  errors: undefined,
  idxToDelete: undefined,
  portToDelete: undefined,
};

const defaultDeleteNodeConfirmDialogState = {
  submitting: false,
  open: false,
  errors: undefined,
  configIdxToDelete: undefined,
  nodeIdxToDelete: undefined,
};

const defaultFieldsStates = {
  configs: [createNewNodeBalancerConfig(true)],
};

const NodeBalancerConfigurations = () => {
  const classes = useStyles();
  const { nodeBalancerId, configId } = useParams<MatchProps>();
  const id = Number(nodeBalancerId);

  const { data } = useAllNodeBalancerConfigsQuery(id);
  const { data: nodebalancer } = useNodeBalancerQuery(id);

  const {
    mutateAsync: createNodeBalancerConfig,
  } = useNodebalancerConfigCreateMutation(id);
  const {
    mutateAsync: deleteNodeBalancerConfig,
  } = useNodebalancerConfigDeleteMutation(id);
  const {
    mutateAsync: updateNodeBalancerConfig,
  } = useNodebalancerConfigUpdateMutation(id);

  const [configs, setConfigs] = React.useState(data ?? []);
  const [configErrors, setConfigErrors] = React.useState<APIError[][]>([]);

  const [configSubmitting, setConfigSubmitting] = React.useState<boolean[]>([]);
  const [panelMessages, setPanelMessages] = React.useState<string[]>([]);
  const [panelNodeMessages, setPanelNodeMessages] = React.useState<string[]>(
    []
  );

  React.useEffect(() => {
    setConfigs(data ?? []);
  }, [data]);
  /*
   * If the following is set to true, then the last element of each of the above
   * arrays is related to this unsaved config.
   */
  const [hasUnsavedConfig, setHasUnsavedConfig] = React.useState<boolean>(
    false
  );
  const [
    deleteConfigConfirmDialog,
    setDeleteConfigConfirmDialog,
  ] = React.useState<{
    open: boolean;
    submitting: boolean;
    errors?: APIError[];
    idxToDelete?: number;
    portToDelete?: number;
  }>(defaultDeleteNodeConfirmDialogState);

  const resetSubmitting = (configIdx: number) => {
    // reset submitting
    const newSubmitting = clone(configSubmitting ?? []);
    newSubmitting[configIdx] = false;
    setConfigSubmitting(newSubmitting);
  };

  const clearNodeErrors = (configIdx: number) => {
    // Build paths to all node errors
    const paths = configs[configIdx].nodes.map((nodes, idxN) => {
      return ['nodes', idxN, 'errors'];
    });
    if (paths.length === 0) {
      return;
    }
    /* Map those paths to an array of updater functions */
    const setFns = paths.map((eachPath: any[]) => {
      return set(lensPath([configIdx, ...eachPath]), []);
    });
    /* Apply all of those update functions at once to state */
    setConfigs((compose as any)(...setFns));
  };

  const fieldErrorsToNodePathErrors = (errors: APIError[]) => {
    /* Return objects with this shape
        {
          path: [0, 'errors'],
          error: {
            field: 'label',
            reason: 'label cannot be blank"
          }
        }
    */
    return errors.reduce((acc: any, error: APIError) => {
      /**
       * Regex conditions are as follows:
       *
       * must match "nodes["
       * must have a digit 0-9
       * then have "]"
       * must end with ".anywordhere"
       */
      const match = /^nodes\[(\d+)\].(\w+)$/.exec(error.field!);
      if (match && match[1] && match[2]) {
        return [
          ...acc,
          {
            path: [+match[1], 'errors'],
            error: {
              field: match[2],
              reason: error.reason,
            },
          },
        ];
      }
      return acc;
    }, []);
  };

  const setNodeErrors = (configIdx: number, error: APIError[]) => {
    /* Map the objects with this shape
        {
          path: [0, 'errors'],
          error: {
            field: 'label',
            reason: 'label cannot be blank"
          }
        }
      to an array of functions that will append the error at the
      given path in the config state
    */
    const nodePathErrors = fieldErrorsToNodePathErrors(error);

    if (nodePathErrors.length === 0) {
      return;
    }

    const setFns = nodePathErrors.map((nodePathError: any) => {
      return compose(
        over(
          lensPath([configIdx, 'nodes', ...nodePathError.path]),
          append(nodePathError.error)
        ),
        defaultTo([]) as () => Array<{}>
      );
    });

    // Apply the error updater functions with a compose
    setConfigs((compose as any)(...setFns));
  };

  const saveConfigUpdatePath = (
    idx: number,
    config: NodeBalancerConfigFieldsWithStatus,
    configPayload: NodeBalancerConfigFieldsWithStatus
  ) => {
    /* Update a config and its nodes simultaneously */
    if (!nodeBalancerId) {
      return;
    }
    if (!config || !config.id) {
      return;
    }

    const nodeBalUpdate = updateNodeBalancerConfig({
      configId: config.id,
      ...configPayload,
    })
      .then((nodeBalancerConfig) => {
        // update config data
        const newConfigs = clone(configs);
        newConfigs[idx] = { ...nodeBalancerConfig, nodes: [] };
        const newNodes = clone(configs[idx].nodes);
        //    while maintaining node data
        newConfigs[idx].nodes = newNodes;

        // reset errors
        const newErrors = clone(configErrors ?? []);
        newErrors[idx] = [];

        // reset submitting
        const newSubmitting = clone(configSubmitting ?? []);
        newSubmitting[idx] = false;

        setConfigs(newConfigs);
        setConfigErrors(newErrors);
        setConfigSubmitting(newSubmitting);
        /* Return true as a Promise for the sake of aggregating results */
        return true;
      })
      .catch((errorResponse) => {
        // update errors
        const errors = getAPIErrorOrDefault(errorResponse);
        const newErrors = clone(configErrors ?? []);
        newErrors[idx] = errors || [];
        setConfigErrors(newErrors);
        resetSubmitting(idx);
        /* Return false as a Promise for the sake of aggregating results */
        return false;
      });

    // These Node operations execute while the config update request is being made
    const nodeUpdates = config.nodes.map((node, nodeIdx) => {
      if (node.modifyStatus === 'delete') {
        return deleteNode(idx, nodeIdx);
      }
      if (node.modifyStatus === 'new') {
        return createNode(idx, nodeIdx);
      }
      if (node.modifyStatus === 'update') {
        return updateNode(idx, nodeIdx);
      }
      return new Promise((resolve) => resolve(undefined));
    });

    /* Set the success message if all of the requests succeed */
    Promise.all([nodeBalUpdate, ...nodeUpdates] as any)
      .then((responseVals) => {
        const [nodeBalSuccess, ...nodeResults] = responseVals;
        if (nodeBalSuccess) {
          // replace Config success message with a new one
          const newMessages = [];
          newMessages[idx] = 'NodeBalancer Configuration updated successfully';
          setPanelMessages(newMessages);
        }
        const filteredNodeResults = nodeResults.filter(
          (el) => el !== undefined
        );
        if (filteredNodeResults.length) {
          const nodeSuccess = filteredNodeResults.reduce(
            (acc: boolean, val: boolean) => {
              return acc && val;
            },
            true
          );
          if (nodeSuccess) {
            // replace Node success message with a new one
            const newMessages = [];
            newMessages[idx] = 'All Nodes updated successfully';
            setPanelNodeMessages(newMessages);
          }
        }
        resetSubmitting(idx);
      })
      .catch((_) => {
        resetSubmitting(idx);
      });
  };

  const saveConfigNewPath = (
    idx: number,
    config: NodeBalancerConfigFieldsWithStatus,
    configPayload: NodeBalancerConfigFieldsWithStatus
  ) => {
    /*
     * Create a config and then its nodes.
     * If the config creation succeeds here, the UpdatePath will be used upon
     * subsequent saves.
     */
    if (!nodeBalancerId) {
      return;
    }

    createNodeBalancerConfig(configPayload)
      .then((nodeBalancerConfig) => {
        // update config data
        const newConfigs = clone(configs ?? []);
        newConfigs[idx] = { ...nodeBalancerConfig, nodes: [] };
        const newNodes = clone(configs[idx].nodes);
        //    while maintaining node data
        newConfigs[idx].nodes = newNodes;

        // reset errors
        const newErrors = clone(configErrors ?? []);
        newErrors[idx] = [];

        setConfigs(newConfigs);
        setConfigErrors(newErrors);

        // replace success message with a new one
        const newMessages = [];
        newMessages[idx] =
          'New NodeBalancer Configuration created successfully';
        setPanelMessages(newMessages);

        // Allow the user to add yet another config
        setHasUnsavedConfig(false);

        // Execute Node operations now that the config has been created
        const nodeUpdates = config.nodes.map((node, nodeIdx) => {
          if (node.modifyStatus !== 'delete') {
            /* All of the Nodes are new since the config was just created */
            return createNode(idx, nodeIdx);
          }
          return new Promise((resolve) => resolve(true));
        });

        /* Set the success message if all of the requests succeed */
        Promise.all([...nodeUpdates] as any)
          .then((responseVals) => {
            const success = responseVals.reduce(
              (acc: boolean, val: boolean) => {
                return acc && val;
              },
              true
            );
            if (success) {
              // replace success message with a new one
              const newNodeMessages = [];
              newNodeMessages[idx] = 'All Nodes created successfully';
              setPanelNodeMessages(newNodeMessages);
            }
            resetSubmitting(idx);
          })
          .catch((_) => {
            resetSubmitting(idx);
          });
      })
      .catch((errorResponse) => {
        // update errors
        const errors = getAPIErrorOrDefault(errorResponse);
        const newErrors = clone(configErrors ?? []);
        newErrors[idx] = errors || [];
        setNodeErrors(idx, newErrors[idx]);
        setConfigErrors(newErrors);
        // reset submitting
        resetSubmitting(idx);
      });
  };

  const clearMessages = () => {
    // clear any success messages
    setPanelMessages([]);
    setPanelNodeMessages([]);
  };

  const saveConfig = (idx: number) => {
    const config = configs[idx];

    const configPayload: NodeBalancerConfigFieldsWithStatus = transformConfigsForRequest(
      [config]
    )[0];

    // clear node errors for this config if there are any
    clearNodeErrors(idx);

    clearMessages();

    const newSubmitting = clone(configSubmitting ?? []);
    newSubmitting[idx] = true;
    setConfigSubmitting(newSubmitting);

    if (config.modifyStatus !== 'new') {
      // If updating Config, perform the update and Node operations simultaneously.
      saveConfigUpdatePath(idx, config, configPayload);
    } else {
      // If it's a new Config, perform the update and Node operations sequentially.
      saveConfigNewPath(idx, config, configPayload);
    }
  };

  const deleteConfig = () => {
    const idxToDelete = deleteConfigConfirmDialog.idxToDelete;
    if (idxToDelete === undefined) {
      return;
    }

    // remove an unsaved config from state
    const config = configs[idxToDelete];
    if (config.modifyStatus === 'new') {
      const newConfigs = clone(configs ?? []);
      newConfigs.splice(idxToDelete, 1);
      setConfigs(newConfigs);
      setDeleteConfigConfirmDialog(defaultDeleteNodeConfirmDialogState);
      setHasUnsavedConfig(false);
      return;
    }

    setDeleteConfigConfirmDialog((prev) => ({
      ...prev,
      submitting: true,
      errors: undefined,
    }));

    setDeleteConfigConfirmDialog((prev) => ({
      ...prev,
      errors: undefined,
      submitting: true,
    }));
    if (!nodeBalancerId) {
      return;
    }
    if (!config || !config.id) {
      return;
    }

    // actually delete a real config
    deleteNodeBalancerConfig({ configId: config.id })
      .then((_) => {
        // update config data
        const newConfigs = clone(configs);
        newConfigs.splice(idxToDelete, 1);
        setConfigs(newConfigs);
        setDeleteConfigConfirmDialog(defaultDeleteConfigConfirmDialogState);
      })
      .catch((err) => {
        return setDeleteConfigConfirmDialog((prev) => ({
          ...prev,
          submitting: false,
          errors: err,
        }));
      });
  };

  const updateNodeErrors = (
    configIdx: number,
    nodeIdx: number,
    errors: APIError[]
  ) => {
    setConfigs(set(lensPath([configIdx, 'nodes', nodeIdx, 'errors']), errors));
  };

  const removeNode = (configIdx: number) => (nodeIdx: number) => {
    clearMessages();
    if (configs[configIdx].nodes[nodeIdx].id !== undefined) {
      /* If the node has an ID, mark it for deletion when the user saves the config */
      setConfigs(
        set(lensPath([configIdx, 'nodes', nodeIdx, 'modifyStatus']), 'delete')
      );
    } else {
      /* If the node doesn't have an ID, remove it from state immediately */
      setConfigs(
        over(lensPath([configIdx, 'nodes']), (nodes) =>
          nodes.filter((n: any, idx: number) => idx !== nodeIdx)
        )
      );
    }
  };

  const deleteNode = (configIdx: number, nodeIdx: number) => {
    if (!nodeBalancerId) {
      return;
    }

    if (!configs) {
      return;
    }

    const config = configs[configIdx];
    if (!config || !config.id) {
      return;
    }
    const node = config.nodes[nodeIdx];
    if (!node || !node.id) {
      return;
    }

    return deleteNodeBalancerConfigNode(
      Number(nodeBalancerId),
      config.id,
      node.id
    )
      .then(() => {
        setConfigs(
          over(lensPath([configIdx!, 'nodes']), (nodes) =>
            nodes.filter((n: any, idx: number) => idx !== nodeIdx!)
          )
        );
        /* Return true as a Promise for the sake of aggregating results */
        return true;
      })
      .catch((_) => {
        /* Return false as a Promise for the sake of aggregating results */
        return false;
        /* @todo:
            place an error on the node and set toDelete to undefined
        */
      });
  };

  const handleNodeSuccess = (
    responseNode: NodeBalancerConfigNode,
    configIdx: number,
    nodeIdx: number
  ) => {
    /* Set the new Node data including the ID
      This also clears the errors and modified status. */
    setConfigs(
      set(lensPath([configIdx, 'nodes', nodeIdx]), parseAddress(responseNode))
    );
    /* Return true as a Promise for the sake of aggregating results */
    return true;
  };

  const handleNodeFailure = (
    errResponse: APIError[],
    configIdx: number,
    nodeIdx: number
  ) => {
    /* Set errors for this node */
    const errors = getAPIErrorOrDefault(errResponse);
    updateNodeErrors(configIdx, nodeIdx, errors);
    /* Return false as a Promise for the sake of aggregating results */
    return false;
  };

  const addNode = (configIdx: number) => () => {
    setConfigs(
      set(
        lensPath([configIdx, 'nodes']),
        append(createNewNodeBalancerConfigNode())(configs[configIdx].nodes)
      )
    );
  };

  const createNode = (configIdx: number, nodeIdx: number) => {
    const config = configs[configIdx];
    const node = configs[configIdx].nodes[nodeIdx];

    const nodeData = nodeForRequest(node);

    if (!nodeBalancerId) {
      return;
    }
    if (!config || !config.id) {
      return;
    }

    return createNodeBalancerConfigNode(
      Number(nodeBalancerId),
      config.id,
      nodeData
    )
      .then((responseNode) =>
        handleNodeSuccess(responseNode, configIdx, nodeIdx)
      )
      .catch((errResponse) =>
        handleNodeFailure(errResponse, configIdx, nodeIdx)
      );
  };

  const setNodeValue = (
    cidx: number,
    nodeidx: number,
    key: string,
    value: any
  ) => {
    clearMessages();
    /* Check if the node is new */
    const { modifyStatus } = configs[cidx].nodes[nodeidx];
    /* If it's not new or for deletion set it to be updated */
    if (!(modifyStatus === 'new' || modifyStatus === 'delete')) {
      setConfigs(
        set(lensPath([cidx, 'nodes', nodeidx, 'modifyStatus']), 'update')
      );
    }
    /* Set the { key: value } pair requested */
    setConfigs(set(lensPath([cidx, 'nodes', nodeidx, key]), value));
  };

  const updateNode = (configIdx: number, nodeIdx: number) => {
    const config = configs[configIdx];
    const node = configs[configIdx].nodes[nodeIdx];

    const nodeData = nodeForRequest(node);

    if (!nodeBalancerId) {
      return;
    }
    if (!config || !config.id) {
      return;
    }
    if (!node || !node.id) {
      return;
    }

    return updateNodeBalancerConfigNode(
      Number(nodeBalancerId),
      config.id,
      node.id,
      nodeData
    )
      .then((responseNode) =>
        handleNodeSuccess(responseNode, configIdx, nodeIdx)
      )
      .catch((errResponse) =>
        handleNodeFailure(errResponse, configIdx, nodeIdx)
      );
  };

  const addNodeBalancerConfig = () => {
    setConfigs(append(createNewNodeBalancerConfig(false), configs));
    setConfigErrors(append([], configErrors ?? []));
    setConfigSubmitting(append(false, configSubmitting ?? []));
    setHasUnsavedConfig(true);
  };

  const onNodeLabelChange = (configIdx: number) => (
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'label', value);

  const onNodeAddressChange = (configIdx: number) => (
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'address', value);

  const onNodePortChange = (configIdx: number) => (
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'port', value);

  const onNodeWeightChange = (configIdx: number) => (
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'weight', value);

  const onNodeModeChange = (configIdx: number) => (
    nodeIdx: number,
    value: string
  ) => {
    setNodeValue(configIdx, nodeIdx, 'mode', value);
  };

  const afterProtocolUpdate = (L: { [key: string]: Lens }) => () => {
    setConfigs(
      // @ts-expect-error okay
      compose(set(L.sslCertificateLens, ''), set(L.privateKeyLens, ''))
    );
  };

  const afterHealthCheckTypeUpdate = (L: { [key: string]: Lens }) => () => {
    setConfigs(
      compose(
        set(L.checkBodyLens, defaultFieldsStates.configs[0].check_body),
        set(
          L.healthCheckAttemptsLens,
          defaultFieldsStates.configs[0].check_attempts
        ),
        // @ts-expect-error okay
        set(
          L.healthCheckIntervalLens,
          defaultFieldsStates.configs[0].check_interval
        ),
        set(
          L.healthCheckTimeoutLens,
          defaultFieldsStates.configs[0].check_timeout
        )
      )
    );
  };

  const onCloseConfirmation = () =>
    setDeleteConfigConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));

  const confirmationConfigError = () =>
    (deleteConfigConfirmDialog.errors || []).map((e) => e.reason).join(',');

  const updateState = (
    lens: Lens,
    L?: { [key: string]: Lens },
    callback?: (L: { [key: string]: Lens }) => () => void
  ) => (value: any) => {
    clearMessages();
    setConfigs(set(lens, value));
    if (L && callback) {
      callback(L);
    }
  };

  const updateStateWithClamp = (
    lens: Lens,
    L?: { [key: string]: Lens },
    callback?: (L: { [key: string]: Lens }) => () => void
  ) => (value: any) => {
    const clampedValue = clampNumericString(0, Number.MAX_SAFE_INTEGER)(value);
    updateState(lens, L, callback)(clampedValue);
  };

  const onSaveConfig = (idx: number) => () => saveConfig(idx);

  const onDeleteConfig = (idx: number, port: number) => () => {
    setDeleteConfigConfirmDialog((prev) => ({
      ...defaultDeleteConfigConfirmDialogState,
      open: true,
      idxToDelete: idx,
      portToDelete: port,
    }));
  };

  const renderConfig = (
    panelMessages: string[],
    configErrors: any[],
    configSubmitting: any[]
  ) => (
    config: NodeBalancerConfig & {
      nodes: NodeBalancerConfigNode[];
    },
    idx: number
  ) => {
    const isNewConfig = hasUnsavedConfig && idx === configs.length - 1;

    const lensTo = lensFrom([idx]);

    // Check whether config is expended based on the URL
    const expandedConfigId = configId;
    const isExpanded = expandedConfigId
      ? parseInt(expandedConfigId, 10) === config.id
      : false;

    const L = {
      algorithmLens: lensTo(['algorithm']),
      checkPassiveLens: lensTo(['check_passive']),
      checkBodyLens: lensTo(['check_body']),
      checkPathLens: lensTo(['check_path']),
      portLens: lensTo(['port']),
      protocolLens: lensTo(['protocol']),
      proxyProtocolLens: lensTo(['proxy_protocol']),
      healthCheckTypeLens: lensTo(['check']),
      healthCheckAttemptsLens: lensTo(['check_attempts']),
      healthCheckIntervalLens: lensTo(['check_interval']),
      healthCheckTimeoutLens: lensTo(['check_timeout']),
      sessionStickinessLens: lensTo(['stickiness']),
      sslCertificateLens: lensTo(['ssl_cert']),
      privateKeyLens: lensTo(['ssl_key']),
    };

    return (
      <Accordion
        key={`nb-config-${idx}`}
        updateFor={[
          idx,
          config,
          configSubmitting[idx],
          configErrors[idx],
          panelMessages[idx],
          panelNodeMessages[idx],
          classes,
        ]}
        defaultExpanded={isNewConfig || isExpanded}
        success={panelMessages[idx]}
        heading={
          <React.Fragment>
            <span className={classes.port}>
              Port {config.port !== undefined ? config.port : ''}
            </span>
            <Typography className={classes.nbStatuses} component="span">
              {formatNodesStatus(config.nodes)}
            </Typography>
          </React.Fragment>
        }
      >
        <NodeBalancerConfigPanel
          nodeBalancerRegion={nodebalancer?.region}
          forEdit
          configIdx={idx}
          onSave={onSaveConfig(idx)}
          submitting={configSubmitting[idx]}
          onDelete={onDeleteConfig(idx, config.port)}
          errors={configErrors[idx]}
          nodeMessage={panelNodeMessages[idx]}
          algorithm={view(L.algorithmLens, configs)}
          onAlgorithmChange={updateState(L.algorithmLens)}
          checkPassive={view(L.checkPassiveLens, configs)}
          onCheckPassiveChange={updateState(L.checkPassiveLens)}
          checkBody={view(L.checkBodyLens, configs)}
          onCheckBodyChange={updateState(L.checkBodyLens)}
          checkPath={view(L.checkPathLens, configs)}
          onCheckPathChange={updateState(L.checkPathLens)}
          port={view(L.portLens, configs)}
          onPortChange={updateState(L.portLens)}
          protocol={view(L.protocolLens, configs)}
          proxyProtocol={view(L.proxyProtocolLens, configs)}
          onProtocolChange={updateState(L.protocolLens, L, afterProtocolUpdate)}
          onProxyProtocolChange={updateState(L.proxyProtocolLens)}
          healthCheckType={view(L.healthCheckTypeLens, configs)}
          onHealthCheckTypeChange={updateState(
            L.healthCheckTypeLens,
            L,
            afterHealthCheckTypeUpdate
          )}
          healthCheckAttempts={view(L.healthCheckAttemptsLens, configs)}
          onHealthCheckAttemptsChange={updateStateWithClamp(
            L.healthCheckAttemptsLens
          )}
          healthCheckInterval={view(L.healthCheckIntervalLens, configs)}
          onHealthCheckIntervalChange={updateStateWithClamp(
            L.healthCheckIntervalLens
          )}
          healthCheckTimeout={view(L.healthCheckTimeoutLens, configs)}
          onHealthCheckTimeoutChange={updateStateWithClamp(
            L.healthCheckTimeoutLens
          )}
          sessionStickiness={view(L.sessionStickinessLens, configs)}
          onSessionStickinessChange={updateState(L.sessionStickinessLens)}
          sslCertificate={view(L.sslCertificateLens, configs)}
          onSslCertificateChange={updateState(L.sslCertificateLens)}
          privateKey={view(L.privateKeyLens, configs)}
          onPrivateKeyChange={updateState(L.privateKeyLens)}
          nodes={config.nodes}
          addNode={addNode(idx)}
          removeNode={removeNode(idx)}
          onNodeLabelChange={onNodeLabelChange(idx)}
          onNodeAddressChange={onNodeAddressChange(idx)}
          onNodePortChange={onNodePortChange(idx)}
          onNodeWeightChange={onNodeWeightChange(idx)}
          onNodeModeChange={onNodeModeChange(idx)}
        />
      </Accordion>
    );
  };

  const renderConfigConfirmationActions = ({
    onClose,
  }: {
    onClose: () => void;
  }) => (
    <ActionsPanel style={{ padding: 0 }}>
      <Button
        buttonType="secondary"
        onClick={onClose}
        className="cancel"
        data-qa-cancel-cancel
      >
        Cancel
      </Button>
      <Button
        buttonType="primary"
        onClick={deleteConfig}
        loading={deleteConfigConfirmDialog.submitting}
        data-qa-confirm-cancel
      >
        Delete
      </Button>
    </ActionsPanel>
  );

  return (
    <div>
      <DocumentTitleSegment
        segment={`${nodebalancer?.label} - Configurations`}
      />
      {Array.isArray(configs) &&
        configs.map(
          renderConfig(panelMessages, configErrors, configSubmitting)
        )}

      {!hasUnsavedConfig && (
        <Grid item style={{ marginTop: 16 }}>
          <Button
            buttonType="outlined"
            className={classes.button}
            onClick={() => addNodeBalancerConfig()}
            data-qa-add-config
          >
            {configs.length === 0
              ? 'Add a Configuration'
              : 'Add Another Configuration'}
          </Button>
        </Grid>
      )}

      <ConfirmationDialog
        onClose={onCloseConfirmation}
        title={
          typeof deleteConfigConfirmDialog.portToDelete !== 'undefined'
            ? `Delete this configuration on port ${deleteConfigConfirmDialog.portToDelete}?`
            : 'Delete this configuration?'
        }
        error={confirmationConfigError()}
        actions={renderConfigConfirmationActions}
        open={deleteConfigConfirmDialog.open}
      >
        <Typography>
          Are you sure you want to delete this NodeBalancer Configuration?
        </Typography>
      </ConfirmationDialog>
    </div>
  );
};

export default NodeBalancerConfigurations;
