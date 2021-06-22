export interface APIError {
  field?: string;
  reason: string;
}

export interface APIWarning {
  title: string;
  detail: string;
}

export interface ConfigOverride {
  baseURL?: string;
}

export interface ResourcePage<T> {
  data: T[];
  page: number;
  pages: number;
  results: number;
}

type FilterOperations =
  | '+or'
  | '+and'
  | '+gt'
  | '+gte'
  | '+lt'
  | '+lte'
  | '+contains'
  | '+neq';

type GenericFilter = {
  [key: string]:
    | Exclude<string, FilterOperations>
    | number
    | boolean
    | FilterOperatorKeys;
};

export type FilterOperatorKeys =
  | Record<'+or', Array<FilterOperatorKeys | GenericFilter>>
  | Record<'+and', Array<GenericFilter>>
  | Record<'+gt', number>
  | Record<'+gte', number>
  | Record<'+lt', number>
  | Record<'+lte', number>
  | Record<'+contains', string>
  | Record<'+neq', string>
  | Record<'+order_by', string>
  | Record<'+order', string>;

export type APIFilter = FilterOperatorKeys | GenericFilter;

export interface PaginationParams {
  page: number;
  page_size: number;
}

// @todo solve this case
// const test: APIFilter = {
//   '+lt': true,
// };

// Credit: https://stackoverflow.com/a/47914643
//
// Allows consumer to apply Partial to each key in a nested interface.
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
