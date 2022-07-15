import {
  createDomainRecord,
  Domain,
  DomainRecord,
  DomainType,
  RecordType,
  updateDomainRecord,
} from '@linode/api-v4/lib/domains';
import { APIError } from '@linode/api-v4/lib/types';
import produce from 'immer';
import { cond, defaultTo, equals, path, pathOr, pick } from 'ramda';
import * as React from 'react';
import ActionsPanel from 'src/components/ActionsPanel';
import Button, { ButtonProps } from 'src/components/Button';
import Drawer from 'src/components/Drawer';
import Select, { Item } from 'src/components/EnhancedSelect/Select';
import MultipleIPInput from 'src/components/MultipleIPInput';
import Notice from 'src/components/Notice';
import { default as _TextField } from 'src/components/TextField';
import getAPIErrorsFor from 'src/utilities/getAPIErrorFor';
import {
  ExtendedIP,
  extendedIPToString,
  stringToExtendedIP,
} from 'src/utilities/ipUtils';
import { maybeCastToNumber } from 'src/utilities/maybeCastToNumber';
import {
  getInitialIPs,
  isValidCNAME,
  isValidDomainRecord,
  transferHelperText as helperText,
} from './domainUtils';
import { useFormik } from 'formik';
import { useUpdateDomainMutation } from 'src/queries/domains';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';

interface Props
  extends Partial<Omit<DomainRecord, 'type'>>,
    Partial<Omit<Domain, 'type'>> {
  open: boolean;
  onClose: () => void;
  domainId: number;
  domain: string;
  mode: 'create' | 'edit';
  records: DomainRecord[];
  updateRecords: () => void;

  /**
   * Used to populate fields on edits.
   */
  id?: number;
  type: RecordType | DomainType;
}

interface EditableSharedFields {
  ttl_sec?: number;
}
interface EditableRecordFields extends EditableSharedFields {
  name?: string;
  port?: string;
  priority?: string;
  protocol?: null | string;
  service?: null | string;
  tag?: null | string;
  target?: string;
  weight?: string;
}

interface EditableDomainFields extends EditableSharedFields {
  axfr_ips?: string[];
  description?: string;
  domain?: string;
  expire_sec?: number;
  refresh_sec?: number;
  retry_sec?: number;
  soa_email?: string;
  ttl_sec?: number;
}

interface AdjustedTextFieldProps {
  label: string;
  field: keyof EditableRecordFields | keyof EditableDomainFields;
  min?: number;
  max?: number;
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
}

interface NumberFieldProps extends AdjustedTextFieldProps {
  defaultValue?: number;
}

const DomainRecordDrawer = (props: Props) => {
  const defaultValues = {
    id: props.id,
    name: props.name ?? '',
    port: props.port ?? '80',
    priority: props.priority ?? '10',
    protocol: props.protocol ?? 'tcp',
    service: props.service ?? '',
    tag: props.tag ?? 'issue',
    target: props.target ?? '',
    ttl_sec: props.ttl_sec ?? 0,
    weight: props.weight ?? '5',
    domain: props.domain,
    soa_email: props.soa_email ?? '',
    axfr_ips: getInitialIPs(props.axfr_ips),
    refresh_sec: props.refresh_sec ?? 0,
    retry_sec: props.retry_sec ?? 0,
    expire_sec: props.expire_sec ?? 0,
  };

  const { open, mode, type, records } = props;
  const isCreating = mode === 'create';
  const isDomain = type === 'master' || type === 'slave';

  const onDomainEdit = async () => {
    const { domainId, type } = props;

    setErrors(undefined);

    const data = {
      ...filterDataByType(formik.values, type),
    } as Partial<EditableDomainFields>;

    if (data.axfr_ips) {
      /**
       * Don't submit blank strings to the API.
       * Also trim the resulting array, since '192.0.2.0, 192.0.2.1'
       * will submit ' 192.0.2.1', which is an invalid value.
       */
      data.axfr_ips = data.axfr_ips
        .filter((ip) => ip !== '')
        .map((ip) => ip.trim());
    }

    await updateDomain({ id: domainId, ...data, status: 'active' })
      .then(() => {
        onClose();
      })
      .catch(handleSubmissionErrors);
  };

  const onRecordCreate = async () => {
    const { records, domain, type } = props;
    setErrors(undefined);

    /** Appease TS ensuring we won't use it during Record create. */
    if (type === 'master' || type === 'slave') {
      return;
    }

    const _data = {
      type,
      ...filterDataByType(formik.values, type),
    };

    // Expand @ to the Domain in appropriate fields
    let data = resolveAlias(_data, domain, type);
    // Convert string values to numeric, replacing '' with undefined
    data = castFormValuesToNumeric(data);

    /**
     * Validation
     *
     * This should be done on the API side, but several breaking
     * configurations will currently succeed on their end.
     */
    const _domain = pathOr('', ['name'], data);
    const invalidCNAME =
      data.type === 'CNAME' && !isValidCNAME(_domain, records);

    if (!isValidDomainRecord(_domain, records) || invalidCNAME) {
      const error = {
        field: 'name',
        reason: 'Record conflict - CNAMES must be unique',
      };
      handleSubmissionErrors([error]);
      return;
    }

    await createDomainRecord(props.domainId, data)
      .then(handleRecordSubmissionSuccess)
      .catch(handleSubmissionErrors);
  };

  const onRecordEdit = async () => {
    const { type, id, domain, domainId } = props;
    const fields = formik.values as EditableRecordFields;
    setErrors(undefined);

    /** Appease TS ensuring we won't use it during Record create. */
    if (type === 'master' || type === 'slave' || !id) {
      return;
    }

    const _data = {
      ...filterDataByType(fields, type),
    };

    // Expand @ to the Domain in appropriate fields
    let data = resolveAlias(_data, domain, type);
    // Convert string values to numeric, replacing '' with undefined
    data = castFormValuesToNumeric(data);
    await updateDomainRecord(domainId, id, data)
      .then(handleRecordSubmissionSuccess)
      .catch(handleSubmissionErrors);
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: defaultValues,
    onSubmit: isDomain
      ? onDomainEdit
      : isCreating
      ? onRecordCreate
      : onRecordEdit,
  });

  // Use our own error state because we have so many different mutation states
  const [errors, setErrors] = React.useState<APIError[] | undefined>();

  const { mutateAsync: updateDomain } = useUpdateDomainMutation();

  const updateField = (
    key: keyof EditableRecordFields | keyof EditableDomainFields
  ) => (value: any) => formik.setFieldValue(key, value);

  const setProtocol = updateField('protocol');
  const setTag = updateField('tag');
  const setTTLSec = updateField('ttl_sec');
  const setRefreshSec = updateField('refresh_sec');
  const setRetrySec = updateField('retry_sec');
  const setExpireSec = updateField('expire_sec');

  const errorFields = {
    name: 'name',
    port: 'port',
    priority: 'priority',
    protocol: 'protocol',
    service: 'service',
    tag: 'tag',
    target: 'target',
    ttl_sec: 'ttl_sec',
    type: 'type',
    weight: 'weight',
    domain: 'domain',
    soa_email: 'SOA email address',
    axfr_ips: 'domain transfers',
    refresh_sec: 'refresh rate',
    retry_sec: 'retry rate',
    expire_sec: 'expire rate',
  };

  const handleTransferUpdate = (transferIPs: ExtendedIP[]) => {
    const axfr_ips =
      transferIPs.length > 0 ? transferIPs.map(extendedIPToString) : [''];
    updateField('axfr_ips')(axfr_ips);
  };

  const TextField = ({
    label,
    field,
    helperText,
    placeholder,
    multiline,
  }: AdjustedTextFieldProps) => (
    <_TextField
      name={field}
      id={field}
      label={label}
      errorText={getAPIErrorsFor(errorFields, errors)(field)}
      value={defaultTo(defaultValues[field], formik.values[field])}
      // onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
      //   updateField(field)(e.target.value)
      // }
      onChange={formik.handleChange}
      placeholder={placeholder}
      helperText={helperText}
      multiline={multiline}
      data-qa-target={label}
    />
  );

  const NumberField = ({ label, field, ...rest }: NumberFieldProps) => {
    return (
      <_TextField
        label={label}
        type="number"
        errorText={getAPIErrorsFor(errorFields, errors)(field)}
        value={formik.values[field]}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          updateField(field)(e.target.value)
        }
        data-qa-target={label}
        {...rest}
      />
    );
  };

  const NameOrTargetField = ({
    label,
    field,
    multiline,
  }: {
    label: string;
    field: 'name' | 'target';
    multiline?: boolean;
  }) => {
    const { domain, type } = props;
    const value = formik.values[field];
    const hasAliasToResolve =
      value.indexOf('@') >= 0 && shouldResolve(type, field);
    return (
      <TextField
        field={field}
        label={label}
        multiline={multiline}
        placeholder={
          shouldResolve(type, field) ? 'hostname or @ for root' : undefined
        }
        helperText={hasAliasToResolve ? resolve(value, domain) : undefined}
      />
    );
  };

  const ServiceField = () => <TextField field="service" label="Service" />;

  const PriorityField = (props: {
    label: string;
    min: number;
    max: number;
  }) => <NumberField field="priority" {...props} />;

  const PortField = () => <NumberField field="port" label="Port" />;

  const WeightField = () => <NumberField field="weight" label="Weight" />;

  const TTLField = () => (
    <MSSelect label="TTL" field="ttl_sec" fn={setTTLSec} />
  );

  const DefaultTTLField = () => (
    <MSSelect label="Default TTL" field="ttl_sec" fn={setTTLSec} />
  );

  const RefreshRateField = () => (
    <MSSelect label="Refresh Rate" field="refresh_sec" fn={setRefreshSec} />
  );

  const RetryRateField = () => (
    <MSSelect label="Retry Rate" field="retry_sec" fn={setRetrySec} />
  );

  const ExpireField = () => {
    const rateOptions = [
      { label: 'Default', value: 0 },
      { label: '1 week', value: 604800 },
      { label: '2 weeks', value: 1209600 },
      { label: '4 weeks', value: 2419200 },
    ];

    const defaultRate = rateOptions.find((eachRate) => {
      return (
        eachRate.value ===
        defaultTo(defaultValues.expire_sec, formik.values.expire_sec)
      );
    });

    return (
      <Select
        options={rateOptions}
        label="Expire Rate"
        defaultValue={defaultRate}
        onChange={(e: Item) => setExpireSec(+e.value)}
        isClearable={false}
        textFieldProps={{
          dataAttrs: {
            'data-qa-domain-select': 'Expire Rate',
          },
        }}
      />
    );
  };

  const MSSelect = ({
    label,
    field,
    fn,
  }: {
    label: string;
    field: keyof EditableRecordFields | keyof EditableDomainFields;
    fn: (v: number) => void;
  }) => {
    const MSSelectOptions = [
      { label: 'Default', value: 0 },
      { label: '30 seconds', value: 30 },
      { label: '2 minutes', value: 120 },
      { label: '5 minutes', value: 300 },
      { label: '1 hour', value: 3600 },
      { label: '2 hours', value: 7200 },
      { label: '4 hours', value: 14400 },
      { label: '8 hours', value: 28800 },
      { label: '16 hours', value: 57600 },
      { label: '1 day', value: 86400 },
      { label: '2 days', value: 172800 },
      { label: '4 days', value: 345600 },
      { label: '1 week', value: 604800 },
      { label: '2 weeks', value: 1209600 },
      { label: '4 weeks', value: 2419200 },
    ];

    const defaultOption = MSSelectOptions.find((eachOption) => {
      return (
        eachOption.value ===
        defaultTo(defaultValues[field], formik.values[field])
      );
    });

    return (
      <Select
        options={MSSelectOptions}
        label={label}
        defaultValue={defaultOption}
        onChange={(e: Item) => fn(+e.value)}
        isClearable={false}
        textFieldProps={{
          dataAttrs: {
            'data-qa-domain-select': label,
          },
        }}
      />
    );
  };

  const ProtocolField = () => {
    const protocolOptions = [
      { label: 'tcp', value: 'tcp' },
      { label: 'udp', value: 'udp' },
      { label: 'xmpp', value: 'xmpp' },
      { label: 'tls', value: 'tls' },
      { label: 'smtp', value: 'smtp' },
    ];

    const defaultProtocol = protocolOptions.find((eachProtocol) => {
      return (
        eachProtocol.value ===
        defaultTo(defaultValues.protocol, formik.values.protocol)
      );
    });

    return (
      <Select
        options={protocolOptions}
        label="Protocol"
        defaultValue={defaultProtocol}
        onChange={(e: Item) => setProtocol(e.value)}
        isClearable={false}
        textFieldProps={{
          dataAttrs: {
            'data-qa-domain-select': 'Protocol',
          },
        }}
      />
    );
  };

  const TagField = () => {
    const tagOptions = [
      { label: 'issue', value: 'issue' },
      { label: 'issuewild', value: 'issuewild' },
      { label: 'iodef', value: 'iodef' },
    ];

    const defaultTag = tagOptions.find((eachTag) => {
      return eachTag.value === defaultTo(defaultValues.tag, formik.values.tag);
    });
    return (
      <Select
        label="Tag"
        options={tagOptions}
        defaultValue={defaultTag || tagOptions[0]}
        onChange={(e: Item) => setTag(e.value)}
        isClearable={false}
        textFieldProps={{
          dataAttrs: {
            'data-qa-domain-select': 'caa tag',
          },
        }}
      />
    );
  };

  const DomainTransferField = () => {
    const finalIPs = (formik.values.axfr_ips ?? ['']).map(stringToExtendedIP);
    return (
      <MultipleIPInput
        title="Domain Transfer IPs"
        helperText={helperText}
        error={getAPIErrorsFor(errorFields, errors)('axfr_ips')}
        ips={finalIPs}
        onChange={handleTransferUpdate}
      />
    );
  };

  const handleSubmissionErrors = (errorResponse: APIError[]) => {
    setErrors(getAPIErrorOrDefault(errorResponse));
  };

  const handleRecordSubmissionSuccess = () => {
    props.updateRecords();
    setErrors(undefined);
    onClose();
  };

  const filterDataByType = (
    fields: EditableRecordFields | EditableDomainFields,
    t: RecordType | DomainType
  ): Partial<EditableRecordFields | EditableDomainFields> =>
    cond([
      [
        () => equals('master', t),
        () =>
          pick(
            [
              'domain',
              'soa_email',
              'refresh_sec',
              'retry_sec',
              'expire_sec',
              'ttl_sec',
              'axfr_ips',
            ],
            fields
          ),
      ],
      // [
      //   () => equals('slave', t),
      //   () => pick([], fields),
      // ],
      [() => equals('A', t), () => pick(['name', 'target', 'ttl_sec'], fields)],
      [
        () => equals('AAAA', t),
        () => pick(['name', 'target', 'ttl_sec'], fields),
      ],
      [
        () => equals('CAA', t),
        () => pick(['name', 'tag', 'target', 'ttl_sec'], fields),
      ],
      [
        () => equals('CNAME', t),
        () => pick(['name', 'target', 'ttl_sec'], fields),
      ],
      [
        () => equals('MX', t),
        () => pick(['target', 'priority', 'ttl_sec', 'name'], fields),
      ],
      [
        () => equals('NS', t),
        () => pick(['target', 'name', 'ttl_sec'], fields),
      ],
      [
        () => equals('SRV', t),
        () =>
          pick(
            [
              'service',
              'protocol',
              'priority',
              'port',
              'weight',
              'target',
              'ttl_sec',
            ],
            fields
          ),
      ],
      [
        () => equals('TXT', t),
        () => pick(['name', 'target', 'ttl_sec'], fields),
      ],
    ])();

  const types = {
    master: (
      <>
        <TextField field="domain" label="Domain" />
        <TextField field="soa_email" label="SOA Email" />
        <DomainTransferField />
        <DefaultTTLField />
        <RefreshRateField />
        <RetryRateField />
        <ExpireField />
      </>
    ),
    AAAA: (
      <>
        <NameOrTargetField label="Hostname" field="name" />
        <NameOrTargetField label="IP Address" field="target" />
        <TTLField />
      </>
    ),
    NS: (
      <>
        <NameOrTargetField label="Name Server" field="target" />
        <NameOrTargetField label="Subdomain" field="name" />
        <TTLField />
      </>
    ),
    MX: (
      <>
        <NameOrTargetField label="Mail Server" field="target" />
        <PriorityField min={0} max={255} label="Preference" />
        <TTLField />
        <NameOrTargetField label="Subdomain" field="name" />
      </>
    ),
    CNAME: (
      <>
        <NameOrTargetField label="Hostname" field="name" />
        <NameOrTargetField label="Alias to" field="target" />
        <TTLField />
      </>
    ),
    TXT: (
      <>
        <NameOrTargetField label="Hostname" field="name" />
        <NameOrTargetField label="Value" field="target" multiline />
        <TTLField />
      </>
    ),
    SRV: (
      <>
        <ServiceField />
        <ProtocolField />
        <PriorityField min={0} max={255} label="Priority" />
        <WeightField />
        <PortField />
        <NameOrTargetField label="Target" field="target" />
        <TTLField />
      </>
    ),
    CAA: (
      <>
        <NameOrTargetField label="Name" field="name" />
        <TagField />
        <NameOrTargetField label="Value" field="target" />
        <TTLField />
      </>
    ),
  };

  const onClose = () => {
    props.onClose();
  };

  const hasARecords = records.find((thisRecord) =>
    ['A', 'AAAA'].includes(thisRecord.type)
  ); // If there are no A/AAAA records and a user tries to add an NS record, they'll see a warning message asking them to add an A/AAAA record.

  const noARecordsNoticeText =
    'Please create an A/AAAA record for this domain to avoid a Zone File invalidation.';

  const buttonProps: ButtonProps = {
    buttonType: 'primary',
    loading: formik.isSubmitting,
    type: 'submit',
    children: 'Save',
  };

  const otherErrors = [
    getAPIErrorsFor({}, errors)('_unknown'),
    getAPIErrorsFor({}, errors)('none'),
  ].filter(Boolean);

  return (
    <Drawer
      title={`${path([mode], modeMap)} ${path([type], typeMap)} Record`}
      open={open}
      onClose={onClose}
    >
      <form onSubmit={formik.handleSubmit}>
        {otherErrors.length > 0 &&
          otherErrors.map((err, index) => {
            return <Notice error key={index} text={err} />;
          })}
        {!hasARecords && type === 'NS' && (
          <Notice warning spacingTop={8} text={noARecordsNoticeText} />
        )}
        {types[type]}
        <ActionsPanel>
          <Button
            buttonType="secondary"
            onClick={onClose}
            data-qa-record-cancel
          >
            Cancel
          </Button>
          <Button {...buttonProps} data-qa-record-save />
        </ActionsPanel>
      </form>
    </Drawer>
  );
};

const modeMap = {
  create: 'Create',
  edit: 'Edit',
};

const typeMap = {
  master: 'SOA',
  slave: 'SOA',
  A: 'A',
  AAAA: 'A/AAAA',
  CAA: 'CAA',
  CNAME: 'CNAME',
  MX: 'MX',
  NS: 'NS',
  PTR: 'PTR',
  SRV: 'SRV',
  TXT: 'TXT',
};

export const shouldResolve = (type: string, field: string) => {
  switch (type) {
    case 'AAAA':
      return field === 'name';
    case 'SRV':
      return field === 'target';
    case 'CNAME':
      return field === 'target';
    default:
      return false;
  }
};

export const resolve = (value: string, domain: string) =>
  value.replace(/\@/, domain);

export const resolveAlias = (
  data: Record<string, any>,
  domain: string,
  type: string
) => {
  // Replace a single @ with a reference to the Domain
  const clone = { ...data };
  for (const [key, value] of Object.entries(clone)) {
    if (shouldResolve(type, key) && typeof value === 'string') {
      clone[key] = resolve(value, domain);
    }
  }
  return clone;
};

const numericFields = ['port', 'weight', 'priority'];
export const castFormValuesToNumeric = (
  data: Record<string, any>,
  fieldNames: string[] = numericFields
) => {
  return produce(data, (draft) => {
    fieldNames.forEach((thisField) => {
      draft[thisField] = maybeCastToNumber(draft[thisField]);
    });
  });
};

export default DomainRecordDrawer;
