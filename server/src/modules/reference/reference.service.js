export class ReferenceService {
  /** @param {import('./reference.repository.js').ReferenceRepository} repository @param {import('../audit/audit.service.js').AuditService} auditService */
  constructor(repository, auditService) {
    this.repository = repository;
    this.auditService = auditService;
  }
  listCurrencies() {
    return this.repository.listCurrencies();
  }
  /** @param {import('zod').infer<typeof import('./reference.schemas.js').searchSchema>} input */
  searchParties(input) {
    return this.repository.searchParties(input.q, input.limit);
  }
  /** @param {import('zod').infer<typeof import('./reference.schemas.js').searchSchema>} input */
  searchPolicies(input) {
    return this.repository.searchPolicies(input.q, input.limit);
  }
  /** @param {import('zod').infer<typeof import('./reference.schemas.js').partyBodySchema>} input @param {{userId:string,correlationId:string}} context */
  async createParty(input, context) {
    const party = await this.repository.createParty({ ...input, createdBy: context.userId });
    await this.auditService.write(this.repository.prisma, {
      actorUserId: context.userId,
      action: 'PARTY_CREATED',
      entityType: 'PARTY',
      entityId: party.id,
      correlationId: context.correlationId,
      newValues: { partyType: party.partyType, displayName: party.displayName },
    });
    return party;
  }
  /** @param {import('zod').infer<typeof import('./reference.schemas.js').policyBodySchema>} input @param {{userId:string,correlationId:string}} context */
  async createPolicy(input, context) {
    const policy = await this.repository.createPolicy({ ...input, createdBy: context.userId });
    await this.auditService.write(this.repository.prisma, {
      actorUserId: context.userId,
      action: 'POLICY_CREATED',
      entityType: 'POLICY',
      entityId: policy.id,
      correlationId: context.correlationId,
      newValues: { policyNumber: policy.policyNumber },
    });
    return policy;
  }
}
