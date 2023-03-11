import { APIError } from '@linode/api-v4/lib/types';
import {
  append,
  clone,
  compose,
  defaultTo,
  Lens,
  lensPath,
  over,
  pathOr,
  set,
  view,
} from 'ramda';
import * as React from 'react';
import ActionsPanel from 'src/components/ActionsPanel';
import Breadcrumb from 'src/components/Breadcrumb';
import Button from 'src/components/Button';
import CheckoutBar, { DisplaySectionList } from 'src/components/CheckoutBar';
import ConfirmationDialog from 'src/components/ConfirmationDialog';
import Paper from 'src/components/core/Paper';
import { makeStyles, Theme } from 'src/components/core/styles';
import Typography from 'src/components/core/Typography';
import { DocumentTitleSegment } from 'src/components/DocumentTitle';
import Grid from 'src/components/Grid';
import LabelAndTagsPanel from 'src/components/LabelAndTagsPanel';
import Notice from 'src/components/Notice';
import SelectRegionPanel from 'src/components/SelectRegionPanel';
import { Tag } from 'src/components/TagsInput';
import { dcDisplayCountry } from 'src/constants';
import { hasGrant } from 'src/features/Profile/permissionsHelpers';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import { isEURegion } from 'src/utilities/formatRegion';
import { sendCreateNodeBalancerEvent } from 'src/utilities/ga';
import getAPIErrorFor from 'src/utilities/getAPIErrorFor';
import { Agreements, signAgreement } from '@linode/api-v4/lib/account';
import EUAgreementCheckbox from '../Account/Agreements/EUAgreementCheckbox';
import NodeBalancerConfigPanel from './NodeBalancerConfigPanel';
import {
  createNewNodeBalancerConfig,
  createNewNodeBalancerConfigNode,
  NodeBalancerConfigFieldsWithStatus,
  transformConfigsForRequest,
} from './utils';
import { queryClient, simpleMutationHandlers } from 'src/queries/base';
import {
  queryKey,
  reportAgreementSigningError,
  useAccountAgreements,
} from 'src/queries/accountAgreements';
import { useGrants, useProfile } from 'src/queries/profile';
import { useRegionsQuery } from 'src/queries/regions';
import { useHistory } from 'react-router-dom';
import { useNodebalancerCreateMutation } from 'src/queries/nodebalancers';

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    marginTop: theme.spacing(3),
  },
  sidebar: {
    [theme.breakpoints.up('md')]: {
      marginTop: '60px !important',
    },
    [theme.breakpoints.down('lg')]: {
      '&.MuiGrid-item': {
        paddingLeft: 0,
        paddingRight: 0,
      },
    },
  },
}));

interface NodeBalancerFieldsState {
  label?: string;
  region?: string;
  tags?: string[];
  configs: (NodeBalancerConfigFieldsWithStatus & { errors?: any })[];
}

const errorResources = {
  label: 'label',
  region: 'region',
  address: 'address',
  tags: 'tags',
};

const defaultDeleteConfigConfirmDialogState = {
  submitting: false,
  open: false,
  errors: undefined,
  idxToDelete: -1,
};

const defaultFieldsStates = {
  configs: [createNewNodeBalancerConfig(true)],
};

const NodeBalancerCreate = () => {
  const classes = useStyles();
  const { data: profile } = useProfile();
  const { data: grants } = useGrants();
  const { data: agreements } = useAccountAgreements();
  const { data: regions } = useRegionsQuery();
  const history = useHistory();
  const { mutateAsync, isLoading, error } = useNodebalancerCreateMutation();

  const [signedAgreement, setSignedAgreement] = React.useState(false);
  const [
    nodeBalancerFields,
    setNodeBalancerFields,
  ] = React.useState<NodeBalancerFieldsState>(defaultFieldsStates);
  const [
    deleteConfigConfirmDialog,
    setDeleteConfigConfirmDialog,
  ] = React.useState<{
    open: boolean;
    submitting: boolean;
    errors?: APIError[];
    idxToDelete?: number;
  }>(defaultDeleteConfigConfirmDialogState);

  const disabled =
    Boolean(profile?.restricted) && !hasGrant('add_nodebalancers', grants);

  const addNodeBalancer = () => {
    if (disabled) {
      return;
    }

    setNodeBalancerFields((prev) => ({
      ...prev,
      configs: [...prev.configs, createNewNodeBalancerConfig()],
    }));
  };

  const addNodeBalancerConfigNode = (configIdx: number) => () =>
    setNodeBalancerFields(
      over(
        lensPath(['configs', configIdx, 'nodes']),
        append(createNewNodeBalancerConfigNode())
      )
    );

  const removeNodeBalancerConfigNode = (configIdx: number) => (
    nodeIdx: number
  ) =>
    setNodeBalancerFields(
      over(lensPath(['configs', configIdx, 'nodes']), (nodes) =>
        nodes.filter((n: any, idx: number) => idx !== nodeIdx)
      )
    );

  const setNodeValue = (
    cidx: number,
    nodeidx: number,
    key: string,
    value: any
  ) =>
    setNodeBalancerFields(
      set(lensPath(['configs', cidx, 'nodes', nodeidx, key]), value)
    );

  const onNodeLabelChange = (
    configIdx: number,
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'label', value);

  const onNodeAddressChange = (
    configIdx: number,
    nodeIdx: number,
    value: string
  ) => {
    setNodeValue(configIdx, nodeIdx, 'address', value);
  };

  const onNodePortChange = (
    configIdx: number,
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'port', value);

  const onNodeWeightChange = (
    configIdx: number,
    nodeIdx: number,
    value: string
  ) => setNodeValue(configIdx, nodeIdx, 'weight', value);

  const afterProtocolUpdate = (L: { [key: string]: Lens }) => () => {
    setNodeBalancerFields(
      // @ts-expect-error okay
      compose(set(L.sslCertificateLens, ''), set(L.privateKeyLens, ''))
    );
  };

  const afterHealthCheckTypeUpdate = (L: { [key: string]: Lens }) => () => {
    setNodeBalancerFields(
      // @ts-expect-error okay
      compose(
        set(L.checkPathLens, defaultFieldsStates.configs[0].check_path),
        set(L.checkBodyLens, defaultFieldsStates.configs[0].check_body),
        set(
          L.healthCheckAttemptsLens,
          defaultFieldsStates.configs[0].check_attempts
        ) as () => any,
        set(
          L.healthCheckIntervalLens,
          defaultFieldsStates.configs[0].check_interval
        ),
        set(
          L.healthCheckTimeoutLens,
          defaultFieldsStates.configs[0].check_timeout
        ) as () => any
      )
    );
  };

  const clearNodeErrors = () => {
    // Build paths for all config errors.
    const configPaths = nodeBalancerFields.configs.map((config, idxC) => {
      return ['configs', idxC, 'errors'];
    });

    // Build paths to all node errors
    const nodePaths = nodeBalancerFields.configs.map((config, idxC) => {
      return config.nodes.map((nodes, idxN) => {
        return ['configs', idxC, 'nodes', idxN, 'errors'];
      });
    });

    const paths = [
      ...configPaths,
      ...nodePaths.reduce((acc, pathArr) => [...acc, ...pathArr], []),
    ];

    if (paths.length === 0) {
      return;
    }

    /* Map those paths to an array of updater functions */
    const setFns = paths.map((path: any[]) => {
      return set(lensPath([...path]), []);
    });
    /* Apply all of those update functions at once to state */
    setNodeBalancerFields((compose as any)(...setFns));
  };

  const setNodeErrors = (errors: APIError[]) => {
    /* Map the objects with this shape
        {
          path: ['configs', 2, 'nodes', 0, 'errors'],
          error: {
            field: 'label',
            reason: 'label cannot be blank"
          }
        }
      to an array of functions that will append the error at the
      given path in the config state
    */
    const nodePathErrors = fieldErrorsToNodePathErrors(errors);

    const setFns = nodePathErrors.map((nodePathError: any) => {
      return compose(
        over(lensPath([...nodePathError.path]), append(nodePathError.error)),
        defaultTo([]) as () => Array<{}>
      );
    });

    // Apply the error updater functions with a compose
    setNodeBalancerFields((compose as any)(...setFns));
  };

  const updateState = (
    lens: Lens,
    L?: { [key: string]: Lens },
    callback?: (L: { [key: string]: Lens }) => () => void
  ) => (value: any) => {
    setNodeBalancerFields(set(lens, value));

    if (L && callback) {
      callback(L);
    }
  };

  const createNodeBalancer = () => {
    /* transform node data for the requests */
    const nodeBalancerRequestData = clone(nodeBalancerFields);
    nodeBalancerRequestData.configs = transformConfigsForRequest(
      nodeBalancerRequestData.configs
    );

    /* Clear node errors */
    clearNodeErrors();

    mutateAsync(nodeBalancerRequestData)
      .then((nodeBalancer) => {
        history.push(`/nodebalancers/${nodeBalancer.id}/summary`);
        // GA Event
        sendCreateNodeBalancerEvent(
          `${nodeBalancer.label}: ${nodeBalancer.region}`
        );
        if (signedAgreement) {
          queryClient.executeMutation<{}, APIError[], Partial<Agreements>>({
            variables: { eu_model: true, privacy_policy: true },
            mutationFn: signAgreement,
            mutationKey: queryKey,
            onError: reportAgreementSigningError,
            ...simpleMutationHandlers(queryKey),
          });
        }
      })
      .catch((errorResponse) => {
        const errors = getAPIErrorOrDefault(errorResponse);
        setNodeErrors(
          errors.map((e: APIError) => ({
            ...e,
            ...(e.field && { field: e.field.replace(/(\[|\]\.)/g, '_') }),
          }))
        );
      });
  };

  const onDeleteConfig = (configIdx: number) => () =>
    setDeleteConfigConfirmDialog({
      ...defaultDeleteConfigConfirmDialogState,
      open: true,
      idxToDelete: configIdx,
    });

  const onRemoveConfig = () => {
    const idxToDelete = deleteConfigConfirmDialog.idxToDelete;

    /* remove the config */
    setNodeBalancerFields((prev) => ({
      ...prev,
      configs: prev.configs.filter(
        (config: NodeBalancerConfigFieldsWithStatus, idx: number) => {
          return idx !== idxToDelete;
        }
      ),
    }));

    /* clear the submitting indicator */
    setDeleteConfigConfirmDialog(defaultDeleteConfigConfirmDialogState);
  };

  const labelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodeBalancerFields((prev) => ({
      ...prev,
      label: e.target.value,
    }));
  };

  const tagsChange = (tags: Tag[]) => {
    setNodeBalancerFields((prev) => ({
      ...prev,
      tags: tags.map((tag) => tag.value),
    }));
  };

  const resetNodeAddresses = () => {
    /** Reset the IP addresses of all nodes at once */
    const { configs } = nodeBalancerFields;
    const newConfigs = configs.reduce((accum, thisConfig) => {
      return [
        ...accum,
        {
          ...thisConfig,
          nodes: [
            ...thisConfig.nodes.map((thisNode) => {
              return { ...thisNode, address: '' };
            }),
          ],
        },
      ];
    }, []);
    setNodeBalancerFields((prev) => ({
      ...prev,
      configs: newConfigs,
    }));
  };

  const regionChange = (region: string) => {
    // No change; no need to update the state.
    setNodeBalancerFields((prev) => ({
      ...prev,
      region,
    }));
    // We just changed the region so any selected IP addresses are likely invalid
    resetNodeAddresses();
  };

  const onCloseConfirmation = () =>
    setDeleteConfigConfirmDialog(clone(defaultDeleteConfigConfirmDialogState));

  const confirmationConfigError = () =>
    (deleteConfigConfirmDialog.errors || []).map((e) => e.reason).join(',');

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
        onClick={onRemoveConfig}
        loading={deleteConfigConfirmDialog.submitting}
        data-qa-confirm-cancel
      >
        Delete
      </Button>
    </ActionsPanel>
  );

  const hasErrorFor = getAPIErrorFor(errorResources, error ?? undefined);
  const generalError = hasErrorFor('none');

  const showAgreement = Boolean(
    isEURegion(nodeBalancerFields.region) &&
      !profile?.restricted &&
      !agreements?.eu_model
  );

  const { region } = nodeBalancerFields;
  let displaySections;
  if (region) {
    const foundRegion = regions?.find((r) => r.id === region);
    if (foundRegion) {
      displaySections = [
        {
          title: dcDisplayCountry[foundRegion.id],
          details: foundRegion.display,
        },
      ];
    } else {
      displaySections = [{ title: 'Unknown Region' }];
    }
  }

  return (
    <React.Fragment>
      <DocumentTitleSegment segment="Create a NodeBalancer" />
      <Grid container className="m0">
        <Grid item className={`mlMain p0`}>
          <Breadcrumb
            pathname="/nodebalancers/create"
            data-qa-create-nodebalancer-header
          />
          {generalError && !disabled && (
            <Notice spacingTop={8} error>
              {generalError}
            </Notice>
          )}
          {disabled && (
            <Notice
              text={
                "You don't have permissions to create a new NodeBalancer. Please contact an account administrator for details."
              }
              error={true}
              spacingTop={16}
              important
            />
          )}
          <LabelAndTagsPanel
            data-qa-label-input
            labelFieldProps={{
              errorText: hasErrorFor('label'),
              label: 'NodeBalancer Label',
              onChange: labelChange,
              value: nodeBalancerFields.label || '',
              disabled,
            }}
            tagsInputProps={{
              value: nodeBalancerFields.tags
                ? nodeBalancerFields.tags.map((tag) => ({
                    label: tag,
                    value: tag,
                  }))
                : [],
              onChange: tagsChange,
              tagError: hasErrorFor('tags'),
              disabled,
            }}
          />
          <SelectRegionPanel
            regions={regions ?? []}
            error={hasErrorFor('region')}
            selectedID={nodeBalancerFields.region}
            handleSelection={regionChange}
            disabled={disabled}
          />
          <Grid item xs={12}>
            <Typography variant="h2" className={classes.title}>
              NodeBalancer Settings
            </Typography>
          </Grid>
          <Grid
            container
            justifyContent="space-between"
            alignItems="flex-end"
            style={{ marginTop: 8 }}
            data-qa-nodebalancer-settings-section
          >
            {nodeBalancerFields.configs.map((nodeBalancerConfig, idx) => {
              const lensTo = lensFrom(['configs', idx]);

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
                <Paper
                  key={idx}
                  style={{ padding: 24, margin: 8, width: '100%' }}
                >
                  <NodeBalancerConfigPanel
                    nodeBalancerRegion={nodeBalancerFields.region}
                    errors={nodeBalancerConfig.errors}
                    configIdx={idx}
                    algorithm={view(L.algorithmLens, nodeBalancerFields)}
                    onAlgorithmChange={updateState(L.algorithmLens)}
                    checkPassive={view(L.checkPassiveLens, nodeBalancerFields)}
                    onCheckPassiveChange={updateState(L.checkPassiveLens)}
                    checkBody={view(L.checkBodyLens, nodeBalancerFields)}
                    onCheckBodyChange={updateState(L.checkBodyLens)}
                    checkPath={view(L.checkPathLens, nodeBalancerFields)}
                    onCheckPathChange={updateState(L.checkPathLens)}
                    port={view(L.portLens, nodeBalancerFields)}
                    onPortChange={updateState(L.portLens)}
                    protocol={view(L.protocolLens, nodeBalancerFields)}
                    proxyProtocol={view(
                      L.proxyProtocolLens,
                      nodeBalancerFields
                    )}
                    onProtocolChange={updateState(
                      L.protocolLens,
                      L,
                      afterProtocolUpdate
                    )}
                    onProxyProtocolChange={updateState(L.proxyProtocolLens)}
                    healthCheckType={view(
                      L.healthCheckTypeLens,
                      nodeBalancerFields
                    )}
                    onHealthCheckTypeChange={updateState(
                      L.healthCheckTypeLens,
                      L,
                      afterHealthCheckTypeUpdate
                    )}
                    healthCheckAttempts={view(
                      L.healthCheckAttemptsLens,
                      nodeBalancerFields
                    )}
                    onHealthCheckAttemptsChange={updateState(
                      L.healthCheckAttemptsLens
                    )}
                    healthCheckInterval={view(
                      L.healthCheckIntervalLens,
                      nodeBalancerFields
                    )}
                    onHealthCheckIntervalChange={updateState(
                      L.healthCheckIntervalLens
                    )}
                    healthCheckTimeout={view(
                      L.healthCheckTimeoutLens,
                      nodeBalancerFields
                    )}
                    onHealthCheckTimeoutChange={updateState(
                      L.healthCheckTimeoutLens
                    )}
                    sessionStickiness={view(
                      L.sessionStickinessLens,
                      nodeBalancerFields
                    )}
                    onSessionStickinessChange={updateState(
                      L.sessionStickinessLens
                    )}
                    sslCertificate={view(
                      L.sslCertificateLens,
                      nodeBalancerFields
                    )}
                    onSslCertificateChange={updateState(L.sslCertificateLens)}
                    privateKey={view(L.privateKeyLens, nodeBalancerFields)}
                    onPrivateKeyChange={updateState(L.privateKeyLens)}
                    nodes={nodeBalancerFields.configs[idx].nodes}
                    addNode={addNodeBalancerConfigNode(idx)}
                    removeNode={removeNodeBalancerConfigNode(idx)}
                    onNodeLabelChange={(nodeIndex, value) =>
                      onNodeLabelChange(idx, nodeIndex, value)
                    }
                    onNodeAddressChange={(nodeIndex, value) =>
                      onNodeAddressChange(idx, nodeIndex, value)
                    }
                    onNodePortChange={(nodeIndex, value) =>
                      onNodePortChange(idx, nodeIndex, value)
                    }
                    onNodeWeightChange={(nodeIndex, value) =>
                      onNodeWeightChange(idx, nodeIndex, value)
                    }
                    onDelete={onDeleteConfig(idx)}
                    disabled={disabled}
                  />
                </Paper>
              );
            })}
            <Grid item>
              <Button
                buttonType="secondary"
                onClick={addNodeBalancer}
                data-qa-add-config
                disabled={disabled}
              >
                Add another Configuration
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item className={`mlSidebar ${classes.sidebar}`}>
          <CheckoutBar
            heading={`${nodeBalancerFields.label || 'NodeBalancer'} Summary`}
            onDeploy={createNodeBalancer}
            calculatedPrice={10}
            disabled={
              isLoading || disabled || (showAgreement && !signedAgreement)
            }
            submitText="Create NodeBalancer"
            agreement={
              showAgreement ? (
                <EUAgreementCheckbox
                  checked={signedAgreement}
                  onChange={(e) => setSignedAgreement(e.target.checked)}
                />
              ) : undefined
            }
          >
            <DisplaySectionList displaySections={displaySections} />
          </CheckoutBar>
        </Grid>
      </Grid>

      <ConfirmationDialog
        onClose={onCloseConfirmation}
        title={'Delete this configuration?'}
        error={confirmationConfigError()}
        actions={renderConfigConfirmationActions}
        open={deleteConfigConfirmDialog.open}
      >
        <Typography>
          Are you sure you want to delete this NodeBalancer Configuration?
        </Typography>
      </ConfirmationDialog>
    </React.Fragment>
  );
};

/* @todo: move to own file */
export const lensFrom = (p1: (string | number)[]) => (
  p2: (string | number)[]
) => lensPath([...p1, ...p2]);

const getPathAndFieldFromFieldString = (value: string) => {
  let field = value;
  let path: any[] = [];

  const configRegExp = new RegExp(/configs_(\d+)_/);
  const configMatch = configRegExp.exec(value);
  if (configMatch && configMatch[1]) {
    path = [...path, 'configs', +configMatch[1]];
    field = field.replace(configRegExp, '');
  }

  const nodeRegExp = new RegExp(/nodes_(\d+)_/);
  const nodeMatch = nodeRegExp.exec(value);
  if (nodeMatch && nodeMatch[1]) {
    path = [...path, 'nodes', +nodeMatch[1]];
    field = field.replace(nodeRegExp, '');
  }
  return { field, path };
};

export interface FieldAndPath {
  field: string;
  path: any[];
}

export const fieldErrorsToNodePathErrors = (errors: APIError[]) => {
  /**
   * Potentials;
   *  JOI error config_0_nodes_0_address
   *  API error config[0].nodes[0].address
   */

  /* Return objects with this shape
      {
        path: ['configs', 2, 'nodes', 0, 'errors'],
        error: {
          field: 'label',
          reason: 'label cannot be blank"
        }
      }
  */
  return errors.reduce((acc: any, error: APIError) => {
    const errorFields = pathOr('', ['field'], error).split('|');
    const pathErrors: FieldAndPath[] = errorFields.map((field: string) =>
      getPathAndFieldFromFieldString(field)
    );

    if (!pathErrors.length) {
      return acc;
    }

    return [
      ...acc,
      ...pathErrors.map((err: FieldAndPath) => {
        return {
          error: {
            field: err.field,
            reason: error.reason,
          },
          path: [...err.path, 'errors'],
        };
      }),
    ];
  }, []);
};

export default NodeBalancerCreate;
