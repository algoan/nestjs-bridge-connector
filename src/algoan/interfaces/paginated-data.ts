/**
 * Paginated Algoan data
 */
export interface PaginatedData<T> {
  resources: T[];
  totalResources: number;
}
