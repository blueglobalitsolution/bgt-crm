import { getDb } from '../database/db';
import { upsertClient, getClientByLeadId, ClientRow } from '../database/repository';
import { generateChecklist } from '../src/utils/onboardingFields';

/**
 * Seeds the demo client "Jay Imaging Centre" with full onboarding data
 * (as shared by the business team) for testing the customer section.
 * Idempotent: re-running updates the record.
 */
function seed() {
  const db = getDb();

  // Existing lead? Look up a matching lead id by company name.
  const leadRow = db
    .prepare("SELECT id FROM leads WHERE company_name LIKE ? ORDER BY created_at DESC LIMIT 1")
    .get('%Jay Imaging%') as { id: string } | undefined;

  const leadId = leadRow ? leadRow.id : undefined;
  if (leadRow) console.log(`Linked to existing lead ${leadRow.id}`);
  else console.log('No existing lead found; creating client without lead link.');

  if (leadId && getClientByLeadId(leadId)) {
    console.log('A client already exists for this lead — updating it instead.');
  }

  const checklist = generateChecklist(['Social Media Marketing', 'Content Marketing', 'SEO']);

  const client: ClientRow = {
    id: 'client-demo-jay-imaging',
    leadId,
    companyName: 'Jay Imaging Centre',
    contactPerson: 'Jaybhai Rajkot / Centre No',
    contacts: [
      { id: 'demo-contact-1', name: 'Jaybhai Rajkot', mobile: '95108 88885', whatsapp: '95108 88885', email: 'jayimagingcentre@gmail.com', role: 'Owner', isPrimary: true },
      { id: 'demo-contact-2', name: 'Centre No', mobile: '70092 92927', role: 'Centre', isPrimary: false },
    ],
    mobile: '95108 88885 / 70092 92927',
    email: 'jayimagingcentre@gmail.com',
    website: 'https://jayimagingcentre.in/',
    contractValue: 0,
    monthlyRetainer: 0,
    startDate: new Date().toISOString().slice(0, 10),
    services: ['Social Media Marketing', 'Content Marketing', 'SEO'],
    accountManager: 'Administrator',
    agreementStatus: 'Active',
    notes: '',
    onboarding: {
      status: 'in_progress',
      businessProfile: {
        businessType: 'Diagnostics centre',
        targetLocation: 'Rajkot, Gujarat, India',
        businessDescription:
          'Best Health care solutions we provide with the team of Radiologists, Pathologists and General Medical practitioners. All kinds of major diagnostic services we provided with upgraded technology of equipment.',
        googleMapLink: 'https://maps.app.goo.gl/61MjsBAzBqkTtBr6A?g_st=ac',
      },
      accessCredentials: {
        emails: [
          { id: 'demo-email-1', label: 'Primary', email: 'jayimagingcentre@gmail.com', password: 'Jayimaging@855' },
        ],
        hosting: [],
        cms: [],
        analytics: [],
        other: [],
      },
      socialMedia: [
        {
          id: 'demo-sm-fb',
          platform: 'Facebook',
          handle: 'Jay Imaging Centre (ID 102514314782384)',
          url: 'https://www.facebook.com/JayImagingCentre',
          isActive: true,
          username: 'Jay Imaging Centre',
          password: 'MP BGT MP Access',
          postsCount: '4',
          reelsCount: '6',
        },
        {
          id: 'demo-sm-ig',
          platform: 'Instagram',
          handle: 'jayimagingcentre',
          url: 'https://www.instagram.com/jayimagingcentre/',
          isActive: true,
          username: 'jayimagingcentre',
          password: 'Drjay@123',
          postsCount: '4',
          reelsCount: '6',
        },
        {
          id: 'demo-sm-gmb',
          platform: 'Google My Business',
          handle: 'Jay Imaging Centre',
          url: 'https://share.google/ER2jtpTEZbfoqb5tn',
          isActive: true,
          postsCount: '4',
          reelsCount: '6',
        },
      ],
      marketing: {
        seoKeywords: [],
        targetKeywords: [],
        adAccounts: [],
        monthlyGoals: [
          { id: 'demo-goal-1', goal: 'Brand Awareness' },
          { id: 'demo-goal-2', goal: 'Lead Generation' },
          { id: 'demo-goal-4', goal: 'Sales' },
          { id: 'demo-goal-5', goal: 'Followers Growth' },
        ],
      },
      competitors: [],
      checklist,
    },
  };

  upsertClient(client);
  console.log('Seeded demo client: Jay Imaging Centre');
  console.log(`Onboarding checklist: ${checklist.length} items`);
}

seed();
