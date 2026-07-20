export interface PostgresError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  constraint?: string;
}
