export interface PermissionItem {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  items: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Leads',
    items: [
      { key: 'leads.view', label: 'View Leads' },
      { key: 'leads.add', label: 'Add Lead' },
      { key: 'leads.edit', label: 'Edit Lead' },
      { key: 'leads.archive', label: 'Archive to Datacenter' },
    ],
  },
  {
    group: 'Datacenter',
    items: [
      { key: 'datacenter.view', label: 'View Datacenter' },
      { key: 'datacenter.restore', label: 'Restore Leads' },
      { key: 'datacenter.purge', label: 'Permanently Delete' },
    ],
  },
  {
    group: 'Communication',
    items: [
      { key: 'comm.call', label: 'Call Leads' },
      { key: 'comm.whatsapp', label: 'WhatsApp Leads' },
    ],
  },
  {
    group: 'Pipeline & Follow-ups',
    items: [
      { key: 'pipeline.view', label: 'View Pipeline' },
      { key: 'pipeline.move', label: 'Move Pipeline Stages' },
      { key: 'followups.view', label: 'View Follow-ups' },
      { key: 'followups.manage', label: 'Manage Follow-ups' },
    ],
  },
  {
    group: 'Customers & Reports',
    items: [
      { key: 'customers.view', label: 'View Customers' },
      { key: 'customers.manage', label: 'Convert / Manage Clients' },
      { key: 'reports.view', label: 'View Reports' },
    ],
  },
  {
    group: 'Website Audit',
    items: [{ key: 'audit.run', label: 'Run Website Audits' }],
  },
  {
    group: 'Import',
    items: [{ key: 'import.excel', label: 'Import Excel / CSV' }],
  },
  {
    group: 'Administration',
    items: [
      { key: 'users.manage', label: 'Manage Users & Roles' },
      { key: 'settings.manage', label: 'Settings & Data Management' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const ALL = ALL_PERMISSION_KEYS;

/** Default permission sets per designation. Admin always gets everything. */
export const DEFAULT_DESIGNATIONS: Record<string, string[]> = {
  Admin: ALL,
  'Sales Manager': [
    'leads.view',
    'leads.add',
    'leads.edit',
    'leads.archive',
    'datacenter.view',
    'datacenter.restore',
    'comm.call',
    'comm.whatsapp',
    'pipeline.view',
    'pipeline.move',
    'followups.view',
    'followups.manage',
    'customers.view',
    'customers.manage',
    'reports.view',
    'audit.run',
    'import.excel',
  ],
  'Sales Executive': [
    'leads.view',
    'leads.add',
    'leads.edit',
    'comm.call',
    'comm.whatsapp',
    'pipeline.view',
    'pipeline.move',
    'followups.view',
    'followups.manage',
    'audit.run',
    'import.excel',
  ],
  'View-Only': ['leads.view', 'customers.view', 'pipeline.view', 'followups.view', 'reports.view', 'datacenter.view'],
};
