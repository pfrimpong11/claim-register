export type ClaimFinancialStatus =
  'RESERVED_NOT_SETTLED' | 'SETTLED_PAYMENT_OUTSTANDING' | 'SETTLED_AND_PAID';

export type PayableStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export type PaymentStatus =
  'DRAFT' | 'APPROVED' | 'PROCESSING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';

export type ReconciliationStatus = 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED';

export type TransactionImportStatus =
  'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';

export type ReportExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type PartyType = 'PERSON' | 'ORGANIZATION';

export const DOCUMENT_TYPES = [
  'CLAIM_FORM',
  'POLICE_REPORT',
  'ID_DOCUMENT',
  'VEHICLE_DOCUMENT',
  'LOSS_PHOTO',
  'ESTIMATE',
  'INVOICE',
  'ADJUSTER_REPORT',
  'PAYMENT_PROOF',
  'OTHER',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

export type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: ListMeta;
};

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
};

export type Party = {
  id: string;
  partyType?: PartyType;
  displayName: string;
  email?: string | null;
  phone?: string | null;
};

export type Policy = {
  id: string;
  policyNumber: string;
  policyName: string | null;
  currencyCode: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  insuredParty: Party;
};

export type Reserve = {
  id: string;
  reserveType: string;
  status: string;
  amount: string;
  currencyCode: string;
  createdAt?: string;
};

export type ClaimStatusEvent = {
  id: string;
  toStatus: string;
  changedAt: string;
};

export type Claim = {
  id: string;
  claimNumber: string;
  policyNumberSnapshot: string;
  policyNameSnapshot?: string | null;
  insuredNameSnapshot: string;
  lossDate: string;
  notificationDate: string;
  lossNature: string;
  description?: string | null;
  currencyCode: string;
  estimatedLossAmount: string;
  approvedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  balanceAmount?: string;
  overpaidAmount?: string;
  financialStatus: ClaimFinancialStatus;
  reserves?: Reserve[];
  statusHistory?: ClaimStatusEvent[];
  createdAt?: string;
};

export type ClaimSummary = {
  currencyCode: string;
  claimCount: number;
  estimatedLoss: string;
  approvedAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  balanceAmount?: string;
  overpaidAmount?: string;
};

export type ClaimListResponse = ListResponse<Claim> & { summaries: ClaimSummary[] };

export type JournalLine = {
  id: string;
  debitAmount: string;
  creditAmount: string;
  glAccount: { code?: string; name: string };
};

export type Journal = {
  id: string;
  journalNumber: string;
  entryDate: string;
  sourceType: string;
  status?: string;
  description?: string;
  currencyCode?: string;
  claim?: { id: string; claimNumber: string };
  reversalOf?: { id: string; journalNumber: string } | null;
  reversals?: Array<{ id: string; journalNumber: string }>;
  lines?: JournalLine[];
};

export type Payable = {
  id: string;
  amount: string;
  currencyCode: string;
  status: PayableStatus;
  description?: string | null;
  payee: Party;
  journal?: Journal;
};

export type SettlementAccount = {
  id: string;
  code?: string;
  name: string;
  accountType: string;
  providerName?: string | null;
  maskedIdentifier?: string | null;
  currencyCode: string;
  status?: string;
};

export type Payment = {
  id: string;
  paymentNumber: string;
  status: PaymentStatus;
  paymentDate: string;
  paymentAmount: string;
  paymentCurrencyCode: string;
  fxRate: string;
  settlementAmount: string;
  overpaymentAmount?: string;
  overpaymentReason?: string | null;
  settlementCurrencyCode: string;
  reference?: string | null;
  settlementAccount: SettlementAccount;
  reconciliationStatus: ReconciliationStatus;
  reconciliationMatchedAmount: string;
  reconciliationUnmatchedAmount: string;
  journals?: Journal[];
};

/** Shape returned by GET /reconciliation-payments (successful payments only). */
export type ReconciliationPayment = {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  paymentAmount: string;
  paymentCurrencyCode: string;
  matchedAmount: string;
  unmatchedAmount: string;
  reconciliationStatus: ReconciliationStatus;
  reference?: string | null;
  settlementAccount: SettlementAccount;
  payable: { claim: { id: string; claimNumber: string } };
};

export type DocumentRecord = {
  id: string;
  documentType: DocumentType;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: string;
  description?: string | null;
  uploadedAt: string;
  uploader: { firstName: string; lastName: string };
};

export type TransactionImport = {
  id: string;
  sourceFileName: string;
  sourceType?: string;
  status: TransactionImportStatus;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  failedRows: number;
  errorSummary?: Array<{ row: number | null; message: string }>;
  settlementAccount: SettlementAccount;
};

export type ReconciliationMatch = {
  id: string;
  matchedAmount: string;
  status: 'ACTIVE' | 'REVERSED';
  payment: { paymentNumber: string };
};

export type ExternalTransaction = {
  id: string;
  externalReference: string;
  transactionDate: string;
  transactionType: 'DEBIT' | 'CREDIT';
  amount: string;
  currencyCode: string;
  matchedAmount: string;
  unmatchedAmount: string;
  reconciliationStatus: ReconciliationStatus;
  sourceType: string;
  description?: string | null;
  settlementAccount: SettlementAccount;
  matches: ReconciliationMatch[];
};

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  claimId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  occurredAt: string;
  correlationId?: string;
  actor?: { firstName: string; lastName: string };
};
