import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { ImportPreviewItem, Lead, EXCEL_TEMPLATE_COLUMNS } from '../types';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Download,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';

export const ExcelImportView: React.FC = () => {
  const { leads, importLeads, setActiveTab } = useCRM();
  const { users, user, isAdmin } = useAuth();
  const [importAssignedTo, setImportAssignedTo] = useState<string>(user?.name || 'Unassigned');

  // Shared handler: update the target assignee (used by step 2 + step 3 dropdowns)
  const handleAssignChange = (value: string) => {
    setImportAssignedTo(value);
    setPreviewItems((prev) =>
      prev.map((item) => ({ ...item, converted: { ...item.converted, assignedTo: value || 'Unassigned' } }))
    );
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);

  // Mapping state: CRM Field -> Selected Excel Header
  const [mapping, setMapping] = useState<Record<string, string>>({
    companyName: '',
    contactPerson: '',
    mobile: '',
    whatsapp: '',
    email: '',
    website: '',
    city: '',
    state: '',
    interestedServices: '',
    estimatedBudget: '',
    requirementNotes: '',
    jobId: '',
    address: '',
    rating: '',
    reviewCount: '',
    websitePhone: '',
    whatsappUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    linkedinUrl: '',
    youtubeUrl: '',
    cms: '',
    ga4: '',
    gtm: '',
    metaPixel: '',
    whatsappWidget: '',
    liveChat: '',
  });

  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Auto-detect matching column headers (order matters for overlapping names)
  const autoMapHeaders = (headers: string[]) => {
    const newMapping: Record<string, string> = { ...mapping };

    const clean = (h: string) => h.toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();

    headers.forEach((h) => {
      const lower = h.toLowerCase();
      const c = clean(h);
      if (c.includes('website phone') || lower.includes('website_phone')) {
        newMapping.websitePhone = h;
      } else if (c.includes('whatsapp widget') || lower.includes('whatsapp_widget')) {
        newMapping.whatsappWidget = h;
      } else if (c.includes('whatsapp url') || lower.includes('whatsapp_url')) {
        newMapping.whatsappUrl = h;
      } else if (c.includes('instagram')) {
        newMapping.instagramUrl = h;
      } else if (c.includes('facebook')) {
        newMapping.facebookUrl = h;
      } else if (c.includes('linkedin')) {
        newMapping.linkedinUrl = h;
      } else if (c.includes('youtube')) {
        newMapping.youtubeUrl = h;
      } else if (c.includes('meta pixel') || lower.includes('meta_pixel')) {
        newMapping.metaPixel = h;
      } else if (c === 'cms' || c === 'cms platform') {
        newMapping.cms = h;
      } else if (c === 'ga4' || c === 'ga 4' || c === 'google analytics') {
        newMapping.ga4 = h;
      } else if (c === 'gtm' || c === 'google tag manager') {
        newMapping.gtm = h;
      } else if (c.includes('live chat') || lower.includes('live_chat')) {
        newMapping.liveChat = h;
      } else if (c.includes('job id') || lower.includes('job_id')) {
        newMapping.jobId = h;
      } else if (c.includes('review count') || lower.includes('review_count')) {
        newMapping.reviewCount = h;
      } else if (c === 'rating') {
        newMapping.rating = h;
      } else if (c.includes('address')) {
        newMapping.address = h;
      } else if (c.includes('company') || c.includes('organization') || c.includes('business')) {
        newMapping.companyName = h;
      } else if (c.includes('person') || c.includes('contact') || c.includes('name')) {
        newMapping.contactPerson = h;
      } else if (c.includes('mobile') || c.includes('phone') || c.includes('contact no')) {
        newMapping.mobile = h;
      } else if (c.includes('whatsapp')) {
        newMapping.whatsapp = h;
      } else if (c.includes('email') || c.includes('mail')) {
        newMapping.email = h;
      } else if (c.includes('website') || c.includes('url') || c.includes('domain')) {
        newMapping.website = h;
      } else if (c.includes('city') || c.includes('location')) {
        newMapping.city = h;
      } else if (c.includes('state')) {
        newMapping.state = h;
      } else if (c.includes('service') || c.includes('product') || c.includes('interested')) {
        newMapping.interestedServices = h;
      } else if (c.includes('budget') || c.includes('value')) {
        newMapping.estimatedBudget = h;
      } else if (c.includes('note') || c.includes('requirement') || c.includes('comment')) {
        newMapping.requirementNotes = h;
      }
    });

    setMapping(newMapping);
  };

  // Step 1: Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (jsonRows.length === 0) {
          alert('Excel sheet appears to be empty.');
          return;
        }

        const headers = Object.keys(jsonRows[0] || {});
        setRawHeaders(headers);
        setParsedRows(jsonRows);
        autoMapHeaders(headers);
        setStep(2);
      } catch (err) {
        console.error('Error parsing Excel', err);
        alert('Could not parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Load Sample Excel File for Quick Demo
  const handleLoadSampleExcel = () => {
    const sampleHeaders = [
      'Company Name',
      'Contact Person',
      'Mobile Number',
      'Email ID',
      'City',
      'Website',
      'Interested Services',
      'Budget',
      'Notes',
    ];

    const sampleRows = [
      {
        'Company Name': 'Reliance Retail Partner',
        'Contact Person': 'Vikram Shah',
        'Mobile Number': '9820011223',
        'Email ID': 'vikram@relianceretail.com',
        City: 'Mumbai',
        Website: 'relianceretail.com',
        'Interested Services': 'SEO, Google Ads',
        Budget: '₹2.5L',
        Notes: 'Wants performance marketing quote for retail outlets.',
      },
      {
        'Company Name': 'Zenith Garments',
        'Contact Person': 'Sanjay Jain',
        'Mobile Number': '9898012345',
        'Email ID': 'sanjay@zenithgarments.in',
        City: 'Surat',
        Website: 'zenithgarments.in',
        'Interested Services': 'Website Development, Shopify',
        Budget: '₹1.5L',
        Notes: 'E-commerce website redesign.',
      },
      {
        'Company Name': 'ABC Engineering Pvt Ltd', // Duplicate check!
        'Contact Person': 'Raj Patel',
        'Mobile Number': '9876543210',
        'Email ID': 'raj@abcengineering.com',
        City: 'Ahmedabad',
        Website: 'abcengineering.com',
        'Interested Services': 'Website Development, SEO',
        Budget: '₹1.8L',
        Notes: 'Possible duplicate lead check.',
      },
      {
        'Company Name': 'Greenfield Agro Products',
        'Contact Person': 'Nilesh Patel',
        'Mobile Number': '9723045678',
        'Email ID': 'nilesh@greenfieldagro.org',
        City: 'Rajkot',
        Website: 'greenfieldagro.org',
        'Interested Services': 'Social Media Marketing, Graphic Design',
        Budget: '₹60K',
        Notes: 'Organic farming brand awareness.',
      },
      {
        'Company Name': 'Apex Logistics India',
        'Contact Person': 'Deepak Verma',
        'Mobile Number': '9833098765',
        'Email ID': 'd.verma@apexlogistics.co.in',
        City: 'Navi Mumbai',
        Website: 'apexlogistics.co.in',
        'Interested Services': 'Google Ads, Meta Ads',
        Budget: '₹1.2L',
        Notes: 'B2B freight lead generation.',
      },
    ];

    setFileName('sample_digital_marketing_leads.xlsx');
    setRawHeaders(sampleHeaders);
    setParsedRows(sampleRows);
    autoMapHeaders(sampleHeaders);
    setStep(2);
  };

  // Download a CSV template with the standard 20-column import layout
  const handleDownloadTemplate = () => {
    const sampleRow = [
      'JOB-001',
      'Example Business Pvt Ltd',
      '9876543210',
      'examplebusiness.com',
      '123 Main Road, Ahmedabad, Gujarat',
      '4.5',
      '128',
      'contact@examplebusiness.com',
      '9876543211',
      'https://wa.me/919876543210',
      'https://instagram.com/examplebusiness',
      'https://facebook.com/examplebusiness',
      'https://linkedin.com/company/examplebusiness',
      'https://youtube.com/@examplebusiness',
      'WordPress',
      'Yes',
      'Yes',
      'Yes',
      'Yes',
      'Yes',
    ];
    const lines = [
      EXCEL_TEMPLATE_COLUMNS.join(','),
      sampleRow.map((v) => (String(v).includes(',') ? `"${v}"` : v)).join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bgt_crm_leads_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step 2 -> Step 3: Run Validation & Duplicate Detection
  const handleProceedToPreview = () => {
    if (!mapping.companyName) {
      alert('Please map Company Name field before proceeding.');
      return;
    }

    const items: ImportPreviewItem[] = parsedRows.map((row, idx) => {
      const companyVal = row[mapping.companyName]?.toString().trim() || '';
      const contactVal = row[mapping.contactPerson]?.toString().trim() || 'Key Decision Maker';
      const mobileVal = row[mapping.mobile]?.toString().trim() || '';
      const emailVal = row[mapping.email]?.toString().trim() || '';
      const websiteVal = row[mapping.website]?.toString().trim() || '';
      const cityVal = row[mapping.city]?.toString().trim() || '';
      const stateVal = row[mapping.state]?.toString().trim() || '';
      const serviceRaw = row[mapping.interestedServices]?.toString().trim() || '';
      const budgetVal = row[mapping.estimatedBudget]?.toString().trim() || '';
      const notesVal = row[mapping.requirementNotes]?.toString().trim() || '';

      const serviceList = serviceRaw.split(/[,+]/).map((s) => s.trim()).filter(Boolean);

      const val = (field: string) => (mapping[field] ? row[mapping[field]]?.toString().trim() || '' : '');

      const ratingNum = parseFloat(val('rating'));
      const reviewNum = parseInt(val('reviewCount'), 10);

      const errors: string[] = [];
      if (!companyVal) errors.push('Missing Company Name');

      // Duplicate Check against existing leads
      let duplicateMatch: Lead | undefined;
      if (mobileVal) {
        duplicateMatch = leads.find((l) => l.mobile && l.mobile.includes(mobileVal));
      }
      if (!duplicateMatch && emailVal) {
        duplicateMatch = leads.find((l) => l.email && l.email.toLowerCase() === emailVal.toLowerCase());
      }
      if (!duplicateMatch && companyVal) {
        duplicateMatch = leads.find(
          (l) => l.companyName.toLowerCase().trim() === companyVal.toLowerCase().trim()
        );
      }

      let status: ImportPreviewItem['status'] = 'valid';
      if (errors.length > 0) status = 'invalid';
      else if (duplicateMatch) status = 'duplicate';

      return {
        id: `prev-${idx}`,
        rowIndex: idx + 1,
        raw: row,
        converted: {
          companyName: companyVal,
          contactPerson: contactVal,
          mobile: mobileVal || '9000000000',
          whatsapp: mobileVal,
          email: emailVal,
          website: websiteVal,
          city: cityVal,
          state: stateVal,
          interestedServices: serviceList,
          leadSource: 'Excel Import',
          estimatedBudget: budgetVal,
          expectedValue: 0,
          assignedTo: importAssignedTo || 'Unassigned',
          status: 'New',
          priority: 'Warm',
          requirementNotes: notesVal,
          jobId: val('jobId'),
          address: val('address'),
          rating: Number.isFinite(ratingNum) ? ratingNum : undefined,
          reviewCount: Number.isFinite(reviewNum) ? reviewNum : undefined,
          websitePhone: val('websitePhone'),
          whatsappUrl: val('whatsappUrl'),
          instagramUrl: val('instagramUrl'),
          facebookUrl: val('facebookUrl'),
          linkedinUrl: val('linkedinUrl'),
          youtubeUrl: val('youtubeUrl'),
          cms: val('cms'),
          ga4: val('ga4'),
          gtm: val('gtm'),
          metaPixel: val('metaPixel'),
          whatsappWidget: val('whatsappWidget'),
          liveChat: val('liveChat'),
        },
        status,
        duplicateMatchId: duplicateMatch?.id,
        duplicateMatchName: duplicateMatch?.companyName,
        errors,
        selectedAction: status === 'duplicate' ? 'skip' : 'import',
      };
    });

    setPreviewItems(items);
    setStep(3);
  };

  // Final Action: Perform Batch Import
  const handleFinalImport = async () => {
    const validToImport = previewItems.filter(
      (item) => item.status !== 'invalid' && item.selectedAction !== 'skip'
    );

    const leadsToCreate = validToImport.map((item) => item.converted as any);

    const count = await importLeads(leadsToCreate);
    setImportedCount(count);
  };

  const validCount = previewItems.filter((i) => i.status === 'valid').length;
  const duplicateCount = previewItems.filter((i) => i.status === 'duplicate').length;
  const invalidCount = previewItems.filter((i) => i.status === 'invalid').length;
  const readyToImportCount = previewItems.filter((i) => i.selectedAction !== 'skip' && i.status !== 'invalid').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <span>Excel & CSV Bulk Lead Import</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload customer lists from Excel, map column fields, run duplicate checks, and import cleanly.
        </p>
      </div>

      {/* Import Wizard Steps Navigation Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs font-semibold">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${step === 1 ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
          <span>Upload File</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${step === 2 ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
          <span>Column Mapping</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${step === 3 ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
          <span>Validation & Import</span>
        </div>
      </div>

      {/* STEP 1: FILE UPLOAD */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-xs text-center space-y-6">
          <div className="max-w-md mx-auto border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Drag Excel / CSV file here
            </h3>
            <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, .csv format</p>

            <label className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all">
              <span>Select File from Computer</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Load Sample Data / Template Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
            <span className="text-xs text-slate-500">Don't have an Excel sheet ready?</span>
            <button
              onClick={handleDownloadTemplate}
              className="text-xs font-semibold px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Template</span>
            </button>
            <button
              onClick={handleLoadSampleExcel}
              className="text-xs font-semibold px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Sample Marketing Leads Sheet</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Excel Column Mapping
              </h3>
              <p className="text-xs text-slate-500">File: {fileName} ({parsedRows.length} rows detected)</p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change File</span>
            </button>
          </div>

          {/* Assign imported leads to a team member (admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 text-xs">
              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
              <label className="font-semibold text-indigo-800 dark:text-indigo-300 shrink-0">
                Assign imported leads to
              </label>
              <select
                value={importAssignedTo}
                onChange={(e) => handleAssignChange(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              >
                <option value="Unassigned">Unassigned</option>
                {users
                  .filter((u) => u.active === 1)
                  .map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} {u.name === user?.name ? '(you)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Mapping Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {[
              { group: 'Core Fields', fields: [
                ['companyName', 'Company Name *'],
                ['contactPerson', 'Contact Person'],
                ['mobile', 'Mobile Number'],
                ['whatsapp', 'WhatsApp Number'],
                ['email', 'Email Address'],
                ['website', 'Website'],
                ['city', 'City'],
                ['state', 'State'],
                ['interestedServices', 'Interested Services'],
                ['estimatedBudget', 'Estimated Budget'],
                ['requirementNotes', 'Requirement Notes'],
              ] },
              { group: 'Business Profile', fields: [
                ['jobId', 'Job ID'],
                ['address', 'Address'],
                ['rating', 'Rating'],
                ['reviewCount', 'Review Count'],
                ['websitePhone', 'Website Phone'],
                ['whatsappUrl', 'WhatsApp URL'],
                ['instagramUrl', 'Instagram URL'],
                ['facebookUrl', 'Facebook URL'],
                ['linkedinUrl', 'LinkedIn URL'],
                ['youtubeUrl', 'YouTube URL'],
              ] },
              { group: 'Website Tech Status', fields: [
                ['cms', 'CMS'],
                ['ga4', 'GA4'],
                ['gtm', 'GTM'],
                ['metaPixel', 'Meta Pixel'],
                ['whatsappWidget', 'WhatsApp Widget'],
                ['liveChat', 'Live Chat'],
              ] },
            ].map((section) => (
              <div key={section.group} className="md:col-span-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {section.group}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.fields.map(([fieldKey, fieldLabel]) => (
                    <div
                      key={fieldKey}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {fieldLabel}
                      </span>
                      <span className="text-slate-400">→</span>
                      <select
                        value={mapping[fieldKey] || ''}
                        onChange={(e) => setMapping({ ...mapping, [fieldKey]: e.target.value })}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs focus:ring-2 focus:ring-blue-500 dark:text-slate-100 max-w-[180px]"
                      >
                        <option value="">-- Ignore Field --</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleProceedToPreview}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Preview & Validate Import</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & DUPLICATE CHECK */}
      {step === 3 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
          {importedCount !== null ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Successfully Imported {importedCount} Leads!
              </h3>
              <p className="text-xs text-slate-500">
                All records have been added to your CRM lead database and assigned to sales reps.
              </p>
              <button
                onClick={() => setActiveTab('leads')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Go to Leads Database
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base uppercase tracking-wider">
                    IMPORT PREVIEW & VALIDATION
                  </h3>
                  <p className="text-xs text-slate-500">File: {fileName}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    ← Back to Mapping
                  </button>
                  <button
                    onClick={handleFinalImport}
                    disabled={readyToImportCount === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Import {readyToImportCount} Leads
                  </button>
                </div>
              </div>

              {/* Assign to team member at import time (admin only) */}
              {isAdmin && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 text-xs">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <label className="font-semibold text-indigo-800 dark:text-indigo-300 shrink-0">
                    Assign imported leads to
                  </label>
                  <select
                    value={importAssignedTo}
                    onChange={(e) => handleAssignChange(e.target.value)}
                    className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                  >
                    <option value="Unassigned">Unassigned</option>
                    {users
                      .filter((u) => u.active === 1)
                      .map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} {u.name === user?.name ? '(you)' : ''}
                        </option>
                      ))}
                  </select>
                  <span className="text-[10px] text-indigo-400 shrink-0 hidden sm:inline">
                    {readyToImportCount} will be imported
                  </span>
                </div>
              )}

              {/* Summary Metrics Cards matching user prompt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-medium">Total Rows</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {previewItems.length}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Valid Leads</div>
                  <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                    {validCount}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">Possible Duplicates</div>
                  <div className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                    {duplicateCount}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                  <div className="text-xs text-rose-800 dark:text-rose-300 font-medium">Invalid Rows</div>
                  <div className="text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1">
                    {invalidCount}
                  </div>
                </div>
              </div>

              {/* Duplicate Warnings & Rows Table */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="p-3 pl-4">Row</th>
                      <th className="p-3">Company Name</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Phone / Mobile</th>
                      <th className="p-3">Assigned To</th>
                      <th className="p-3">Validation Status</th>
                      <th className="p-3 pr-4 text-right">Duplicate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 pl-4 font-mono text-slate-400">#{item.rowIndex}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          {item.converted.companyName || 'N/A'}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{item.converted.contactPerson}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{item.converted.mobile}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60">
                            {item.converted.assignedTo || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3">
                          {item.status === 'valid' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✓ Ready
                            </span>
                          )}
                          {item.status === 'duplicate' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              ⚠️ Matches "{item.duplicateMatchName}"
                            </span>
                          )}
                          {item.status === 'invalid' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              ❌ {item.errors.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="p-3 pr-4 text-right">
                          {item.status === 'duplicate' ? (
                            <select
                              value={item.selectedAction}
                              onChange={(e) => {
                                const act = e.target.value as any;
                                setPreviewItems(
                                  previewItems.map((pi) =>
                                    pi.id === item.id ? { ...pi, selectedAction: act } : pi
                                  )
                                );
                              }}
                              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5"
                            >
                              <option value="skip">Skip Import</option>
                              <option value="import">Create as New</option>
                            </select>
                          ) : item.status === 'valid' ? (
                            <span className="text-emerald-600 font-semibold text-[11px]">Will Import</span>
                          ) : (
                            <span className="text-rose-500 font-semibold text-[11px]">Cannot Import</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
