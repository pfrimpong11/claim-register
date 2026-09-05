'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiMutate, apiRequest } from '@/lib/api';
import type { Currency, Party, Policy } from '@/lib/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DateInput,
  Field,
  FormGrid,
  Input,
  Select,
  SuffixInput,
  Textarea,
} from '@/components/ui/form';
import { Drawer } from '@/components/ui/overlay';
import { SearchSelect } from '@/components/ui/search-select';
import { useToast } from '@/components/ui/toast';
import styles from './claim-form.module.css';

const FALLBACK_CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP'];

function loadPolicies(query: string) {
  return apiRequest<{ data: Policy[] }>(`/policies?q=${encodeURIComponent(query)}&limit=20`).then(
    (response) => response.data,
  );
}

function loadParties(query: string) {
  return apiRequest<{ data: Party[] }>(`/parties?q=${encodeURIComponent(query)}&limit=20`).then(
    (response) => response.data,
  );
}

export function ClaimForm() {
  const router = useRouter();
  const toast = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [lossDate, setLossDate] = useState('');
  const [notificationDate, setNotificationDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [policyDrawerOpen, setPolicyDrawerOpen] = useState(false);
  const [partyDrawerOpen, setPartyDrawerOpen] = useState(false);
  const [insuredParty, setInsuredParty] = useState<Party | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);

  useEffect(() => {
    apiRequest<{ data: Currency[] }>('/currencies')
      .then((response) => setCurrencies(response.data))
      .catch(() => setCurrencies([]));
  }, []);

  const currencyOptions = currencies.length
    ? currencies.map((currency) => ({ value: currency.code, label: currency.code }))
    : FALLBACK_CURRENCIES.map((code) => ({ value: code, label: code }));

  const needsOverrideReason = Boolean(lossDate && notificationDate) && notificationDate < lossDate;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const created = await apiMutate<{ data: { id: string; claimNumber: string } }>('/claims', {
        body: {
          policyId: policy.id,
          lossDate: form.get('lossDate'),
          notificationDate: form.get('notificationDate'),
          ...(needsOverrideReason
            ? { notificationOverrideReason: form.get('notificationOverrideReason') }
            : {}),
          lossNature: form.get('lossNature'),
          description: form.get('description') || null,
          estimatedLossAmount: form.get('estimatedLossAmount'),
        },
      });
      toast.success(`Claim ${created.data.claimNumber ?? ''} registered.`.replace('  ', ' '));
      router.push(`/claims/${created.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create claim.');
      setBusy(false);
    }
  }

  async function addParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDrawerBusy(true);
    try {
      const created = await apiMutate<{ data: Party }>('/parties', {
        body: {
          partyType: form.get('partyType'),
          displayName: form.get('displayName'),
          email: form.get('email') || null,
          phone: form.get('phone') || null,
        },
      });
      setInsuredParty(created.data);
      setPartyDrawerOpen(false);
      toast.success('Party saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save the party.');
    } finally {
      setDrawerBusy(false);
    }
  }

  async function addPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!insuredParty) return;
    const form = new FormData(event.currentTarget);
    setDrawerBusy(true);
    try {
      const created = await apiMutate<{ data: Policy }>('/policies', {
        body: {
          policyNumber: form.get('policyNumber'),
          policyName: form.get('policyName') || null,
          insuredPartyId: insuredParty.id,
          currencyCode: form.get('currencyCode'),
          effectiveFrom: form.get('effectiveFrom') || null,
          effectiveTo: form.get('effectiveTo') || null,
        },
      });
      setPolicy({ ...created.data, insuredParty: created.data.insuredParty ?? insuredParty });
      setPolicyDrawerOpen(false);
      setInsuredParty(null);
      toast.success('Policy saved and selected.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to save the policy.');
    } finally {
      setDrawerBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Create Claim" subtitle="Register a new claim against a policy." />
      <form onSubmit={submit} className={styles.stack}>
        <Card
          allowOverflow
          title="01 · Policy & Insured"
          subtitle="Select the policy that covers this claim."
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onClick={() => setPolicyDrawerOpen(true)}
            >
              Add Policy
            </Button>
          }
        >
          <div className={styles.stackSmall}>
            <Field label="Policy" required>
              <SearchSelect
                value={policy}
                onChange={setPolicy}
                loadOptions={loadPolicies}
                getLabel={(item) =>
                  `${item.policyNumber}${item.policyName ? ` - ${item.policyName}` : ''}`
                }
                getKey={(item) => item.id}
                renderOption={(item) => (
                  <div>
                    <div>
                      {item.policyNumber}
                      {item.policyName ? ` - ${item.policyName}` : ''}
                    </div>
                    <div className={styles.optionMeta}>
                      {item.insuredParty?.displayName} · {item.currencyCode}
                    </div>
                  </div>
                )}
                placeholder="Search policy number or name…"
                required
              />
            </Field>
            {policy ? (
              <div className={styles.policySummary}>
                <p className={styles.policyTitle}>
                  {policy.policyNumber}
                  {policy.policyName ? ` - ${policy.policyName}` : ''}
                </p>
                <div className={styles.policyMeta}>
                  <div>
                    <span className={styles.metaLabel}>Insured</span>
                    <span>{policy.insuredParty?.displayName ?? '—'}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Currency</span>
                    <span>{policy.currencyCode}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
        <Card
          title="02 · Loss Details"
          subtitle="Record the loss and its initial estimated amount."
        >
          <div className={styles.stackSmall}>
            <FormGrid>
              <Field label="Loss Date" htmlFor="loss-date" required>
                <DateInput
                  id="loss-date"
                  name="lossDate"
                  required
                  value={lossDate}
                  onChange={(event) => setLossDate(event.target.value)}
                />
              </Field>
              <Field label="Date Notified" htmlFor="notification-date" required>
                <DateInput
                  id="notification-date"
                  name="notificationDate"
                  required
                  value={notificationDate}
                  onChange={(event) => setNotificationDate(event.target.value)}
                />
              </Field>
            </FormGrid>
            {needsOverrideReason ? (
              <Field
                label="Override Reason"
                htmlFor="override-reason"
                required
                hint="The notification date is before the loss date — explain why this is correct."
              >
                <Textarea
                  id="override-reason"
                  name="notificationOverrideReason"
                  required
                  minLength={5}
                  maxLength={500}
                />
              </Field>
            ) : null}
            <Field label="Loss Nature" htmlFor="loss-nature" required>
              <Input
                id="loss-nature"
                name="lossNature"
                required
                minLength={2}
                maxLength={150}
                placeholder="e.g. Motor collision"
              />
            </Field>
            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the loss…"
              />
            </Field>
            <Field
              label="Estimated Loss Amount"
              htmlFor="estimated-loss"
              required
              hint="This will create the initial indemnity reserve."
            >
              <SuffixInput
                id="estimated-loss"
                name="estimatedLossAmount"
                inputMode="decimal"
                pattern="\d+(\.\d{1,4})?"
                required
                suffix={policy?.currencyCode ?? ''}
              />
            </Field>
          </div>
        </Card>
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => router.push('/claims')} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!policy}>
            Save Claim
          </Button>
        </div>
      </form>

      <Drawer
        open={policyDrawerOpen}
        title="Add New Policy"
        onClose={() => setPolicyDrawerOpen(false)}
      >
        <form onSubmit={addPolicy} className={styles.stackSmall}>
          <Field label="Policy Number" htmlFor="new-policy-number" required>
            <Input
              id="new-policy-number"
              name="policyNumber"
              required
              placeholder="Enter policy number"
            />
          </Field>
          <Field label="Policy Name" htmlFor="new-policy-name">
            <Input
              id="new-policy-name"
              name="policyName"
              placeholder="Enter policy name (optional)"
            />
          </Field>
          <Field label="Insured Party" required>
            <div className={styles.inlineAction}>
              <div className={styles.inlineGrow}>
                <SearchSelect
                  value={insuredParty}
                  onChange={setInsuredParty}
                  loadOptions={loadParties}
                  getLabel={(party) => party.displayName}
                  getKey={(party) => party.id}
                  placeholder="Search or add party…"
                  required
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                onClick={() => setPartyDrawerOpen(true)}
              >
                Add Party
              </Button>
            </div>
          </Field>
          <Field label="Currency" htmlFor="new-policy-currency" required>
            <Select
              id="new-policy-currency"
              name="currencyCode"
              required
              placeholder="Select currency"
              options={currencyOptions}
            />
          </Field>
          <FormGrid>
            <Field label="Effective From" htmlFor="new-policy-from">
              <DateInput id="new-policy-from" name="effectiveFrom" />
            </Field>
            <Field label="Effective To" htmlFor="new-policy-to">
              <DateInput id="new-policy-to" name="effectiveTo" />
            </Field>
          </FormGrid>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => setPolicyDrawerOpen(false)}
              disabled={drawerBusy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={drawerBusy} disabled={!insuredParty}>
              Save Policy
            </Button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={partyDrawerOpen}
        title="Add New Party"
        onClose={() => setPartyDrawerOpen(false)}
      >
        <form onSubmit={addParty} className={styles.stackSmall}>
          <Field label="Party Type" required>
            <div className={styles.radioRow} role="radiogroup" aria-label="Party type">
              <label className={styles.radio}>
                <input type="radio" name="partyType" value="PERSON" defaultChecked required />
                Person
              </label>
              <label className={styles.radio}>
                <input type="radio" name="partyType" value="ORGANIZATION" />
                Organization
              </label>
            </div>
          </Field>
          <Field label="Full Name" htmlFor="new-party-name" required>
            <Input id="new-party-name" name="displayName" required placeholder="Enter full name" />
          </Field>
          <Field label="Email" htmlFor="new-party-email">
            <Input
              id="new-party-email"
              name="email"
              type="email"
              placeholder="Enter email (optional)"
            />
          </Field>
          <Field label="Phone" htmlFor="new-party-phone">
            <Input
              id="new-party-phone"
              name="phone"
              type="tel"
              placeholder="Enter phone number (optional)"
            />
          </Field>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => setPartyDrawerOpen(false)}
              disabled={drawerBusy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={drawerBusy}>
              Save Party
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
