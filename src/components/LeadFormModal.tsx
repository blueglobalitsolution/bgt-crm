import React, { useState, useEffect, useRef } from 'react';
import {
  Lead,
  LeadStatus,
  LeadPriority,
  FollowupType,
  ContactPerson,
  ExtractedBusinessInfo,
  DIGITAL_MARKETING_SERVICES,
  LEAD_SOURCES,
  LEAD_STATUS_FLOW,
  LEAD_TERMINAL_STATUSES,
} from '../types';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { getLocalToday, getLocalNowTime } from '../utils/auditFormat';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useBusinessIntel } from '../hooks/useBusinessIntel';
import { BusinessIntelConfirmModal } from './BusinessIntelConfirmModal';
import { ContactsEditor } from './ContactsEditor';
import { externalHref } from '../utils/url';
import { X, Save, Building2, User, Phone, Mail, Globe, Sparkles, Image as ImageIcon, MapPin } from 'lucide-react';

interface LeadFormModalProps {
  isOpen: boolean;
  leadToEdit?: Lead | null;
  onClose: () => void;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  isOpen,
  leadToEdit,
  onClose,
}) => {
  if (!isOpen) return null;

  const { addLead, updateLead } = useCRM();
  const { users, isAdmin } = useAuth();

  useEscapeClose(onClose, isOpen);

  // Business intelligence import (image OCR / Google Maps link)
  const {
    loading: intelLoading,
    error: intelError,
    extractFromImage,
    extractFromGMB,
    clearError: clearIntelError,
  } = useBusinessIntel();
  const [intelOpen, setIntelOpen] = useState(false);
  const [intelSource, setIntelSource] = useState<'image' | 'gmb'>('image');
  const [intelData, setIntelData] = useState<ExtractedBusinessInfo | null>(null);
  const [gmbUrl, setGmbUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openIntel = (source: 'image' | 'gmb') => {
    clearIntelError();
    setIntelSource(source);
    setIntelData(null);
    setIntelOpen(true);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    openIntel('image');
    const data = await extractFromImage(file);
    if (data) setIntelData(data);
  };

  const handleGmbImport = async () => {
    if (!gmbUrl.trim()) {
      alert('Please paste a Google Maps / My Business link first.');
      return;
    }
    openIntel('gmb');
    const data = await extractFromGMB(gmbUrl.trim());
    if (data) setIntelData(data);
  };

  const handleApplyIntel = (data: ExtractedBusinessInfo) => {
    if (data.companyName) setCompanyName(data.companyName);
    if (data.contactPerson) setContactPerson(data.contactPerson);
    if (data.mobile) setMobile(data.mobile);
    if (data.whatsapp) setWhatsapp(data.whatsapp);
    if (data.email) setEmail(data.email);
    if (data.website) setWebsite(data.website);
    if (data.address) setAddress(data.address);
    if (data.city) setCity(data.city);
    if (data.state) setState(data.state);
    if (data.industry) setIndustry(data.industry);
    if (data.rating != null) setRating(String(data.rating));
    if (data.reviewCount != null) setReviewCount(String(data.reviewCount));
    if (data.socialMediaLinks && data.socialMediaLinks.length > 0) {
      data.socialMediaLinks.forEach((link) => {
        const low = link.toLowerCase();
        if (low.includes('facebook')) setFacebookUrl(link);
        else if (low.includes('instagram')) setInstagramUrl(link);
        else if (low.includes('linkedin')) setLinkedinUrl(link);
        else if (low.includes('youtube')) setYoutubeUrl(link);
      });
    }
    if (data.services && data.services.length > 0) {
      setInterestedServices((prev) => {
        const merged = [...prev];
        data.services!.forEach((s) => {
          if (!merged.includes(s)) merged.push(s);
        });
        return merged;
      });
    }
    if (data.source === 'gmb') {
      setLeadSource('Google');
      if (data.placeId) setPlaceId(data.placeId);
    }
    setIntelOpen(false);
    setIntelData(null);
    setGmbUrl('');
  };

  const handleCancelIntel = () => {
    setIntelOpen(false);
    setIntelData(null);
    clearIntelError();
  };

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [industry, setIndustry] = useState('');

  const [interestedServices, setInterestedServices] = useState<string[]>(['Website Development', 'SEO']);
  const [leadSource, setLeadSource] = useState<string>('Website');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [expectedValue, setExpectedValue] = useState<number>(0);
  const [assignedTo, setAssignedTo] = useState<string>('Unassigned');

  const [status, setStatus] = useState<LeadStatus>('New');
  const [priority, setPriority] = useState<LeadPriority>('Warm');

  const todayStr = getLocalToday();
  const [nextFollowupDate, setNextFollowupDate] = useState(todayStr);
  const [nextFollowupTime, setNextFollowupTime] = useState(getLocalNowTime());
  const [nextFollowupType, setNextFollowupType] = useState<FollowupType>('WhatsApp');
  const [nextFollowupNote, setNextFollowupNote] = useState('');

  const [requirementNotes, setRequirementNotes] = useState('');

  // Business profile
  const [jobId, setJobId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [address, setAddress] = useState('');
  const [rating, setRating] = useState('');
  const [reviewCount, setReviewCount] = useState('');
  const [websitePhone, setWebsitePhone] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  // Website tech & tracking status
  const [cms, setCms] = useState('');
  const [ga4, setGa4] = useState('');
  const [gtm, setGtm] = useState('');
  const [metaPixel, setMetaPixel] = useState('');
  const [whatsappWidget, setWhatsappWidget] = useState('');
  const [liveChat, setLiveChat] = useState('');

  useEffect(() => {
    if (leadToEdit) {
      setCompanyName(leadToEdit.companyName || '');
      setContactPerson(leadToEdit.contactPerson || '');
      setContacts((leadToEdit.contacts || []).map((c) => ({ ...c })));
      setMobile(leadToEdit.mobile || '');
      setWhatsapp(leadToEdit.whatsapp || leadToEdit.mobile || '');
      setEmail(leadToEdit.email || '');
      setWebsite(leadToEdit.website || '');
      setCity(leadToEdit.city || '');
      setState(leadToEdit.state || '');
      setIndustry(leadToEdit.industry || '');
      setInterestedServices(leadToEdit.interestedServices || []);
      setLeadSource(leadToEdit.leadSource || 'Website');
      setEstimatedBudget(leadToEdit.estimatedBudget || '');
      setExpectedValue(leadToEdit.expectedValue || 0);
      setAssignedTo(leadToEdit.assignedTo || 'Unassigned');
      setStatus(leadToEdit.status || 'New');
      setPriority(leadToEdit.priority || 'Warm');
      setNextFollowupDate(leadToEdit.nextFollowupDate || getLocalToday());
      setNextFollowupTime(leadToEdit.nextFollowupTime || getLocalNowTime());
      setNextFollowupType(leadToEdit.nextFollowupType || 'WhatsApp');
      setNextFollowupNote(leadToEdit.nextFollowupNote || '');
      setRequirementNotes(leadToEdit.requirementNotes || '');
      setJobId(leadToEdit.jobId || '');
      setPlaceId(leadToEdit.placeId || '');
      setAddress(leadToEdit.address || '');
      setRating(leadToEdit.rating != null ? String(leadToEdit.rating) : '');
      setReviewCount(leadToEdit.reviewCount != null ? String(leadToEdit.reviewCount) : '');
      setWebsitePhone(leadToEdit.websitePhone || '');
      setWhatsappUrl(leadToEdit.whatsappUrl || '');
      setInstagramUrl(leadToEdit.instagramUrl || '');
      setFacebookUrl(leadToEdit.facebookUrl || '');
      setLinkedinUrl(leadToEdit.linkedinUrl || '');
      setYoutubeUrl(leadToEdit.youtubeUrl || '');
      setCms(leadToEdit.cms || '');
      setGa4(leadToEdit.ga4 || '');
      setGtm(leadToEdit.gtm || '');
      setMetaPixel(leadToEdit.metaPixel || '');
      setWhatsappWidget(leadToEdit.whatsappWidget || '');
      setLiveChat(leadToEdit.liveChat || '');
    } else {
      // Reset form
      setCompanyName('');
      setContactPerson('');
      setContacts([]);
      setMobile('');
      setWhatsapp('');
      setEmail('');
      setWebsite('');
      setCity('');
      setState('');
      setIndustry('');
      setInterestedServices(['Website Development', 'SEO']);
      setLeadSource('Website');
      setEstimatedBudget('');
      setExpectedValue(0);
      setAssignedTo('Unassigned');
      setStatus('New');
      setPriority('Warm');
      setNextFollowupDate(getLocalToday());
      setNextFollowupTime(getLocalNowTime());
      setNextFollowupType('WhatsApp');
      setNextFollowupNote('Initial enquiry follow-up');
      setRequirementNotes('');
      setJobId('');
      setPlaceId('');
      setAddress('');
      setRating('');
      setReviewCount('');
      setWebsitePhone('');
      setWhatsappUrl('');
      setInstagramUrl('');
      setFacebookUrl('');
      setLinkedinUrl('');
      setYoutubeUrl('');
      setCms('');
      setGa4('');
      setGtm('');
      setMetaPixel('');
      setWhatsappWidget('');
      setLiveChat('');
    }
  }, [leadToEdit, isOpen]);

  const toggleService = (srv: string) => {
    if (interestedServices.includes(srv)) {
      setInterestedServices(interestedServices.filter((s) => s !== srv));
    } else {
      setInterestedServices([...interestedServices, srv]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim() || !mobile.trim()) {
      alert('Please fill in Company Name, Contact Person, and Mobile Number.');
      return;
    }

    const payload = {
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      contacts: contacts.length > 0 ? contacts : undefined,
      mobile: mobile.trim(),
      whatsapp: whatsapp.trim() || mobile.trim(),
      email: email.trim(),
      website: externalHref(website) || '',
      city: city.trim(),
      state: state.trim(),
      industry: industry.trim(),
      interestedServices,
      leadSource,
      estimatedBudget,
      expectedValue: Number(expectedValue) || 0,
      assignedTo,
      status,
      priority,
      nextFollowupDate,
      nextFollowupTime,
      nextFollowupType,
      nextFollowupNote,
      requirementNotes,
      jobId: jobId.trim(),
      placeId: placeId.trim(),
      address: address.trim(),
      rating: rating ? Number(rating) : undefined,
      reviewCount: reviewCount ? Number(reviewCount) : undefined,
      websitePhone: websitePhone.trim(),
      whatsappUrl: whatsappUrl.trim(),
      instagramUrl: instagramUrl.trim(),
      facebookUrl: facebookUrl.trim(),
      linkedinUrl: linkedinUrl.trim(),
      youtubeUrl: youtubeUrl.trim(),
      cms: cms.trim(),
      ga4: ga4.trim(),
      gtm: gtm.trim(),
      metaPixel: metaPixel.trim(),
      whatsappWidget: whatsappWidget.trim(),
      liveChat: liveChat.trim(),
    };

    if (leadToEdit) {
      await updateLead(leadToEdit.id, payload);
    } else {
      await addLead(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              {leadToEdit ? `Edit Lead: ${leadToEdit.companyName}` : '+ Add New Lead'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter customer information, services required, and next follow-up.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {/* Business Intelligence Import */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Auto-fill Business Info
              </h4>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
                Upload an image or paste a Google Maps link
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={intelLoading}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                Upload Image
              </button>
              <div className="flex flex-1 gap-2 min-w-0">
                <input
                  type="text"
                  value={gmbUrl}
                  onChange={(e) => setGmbUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGmbImport()}
                  placeholder="Paste Google Maps / My Business link…"
                  className="flex-1 min-w-0 w-full text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-indigo-500 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleGmbImport}
                  disabled={intelLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <MapPin className="w-4 h-4" />
                  <span className="hidden sm:inline">Fetch</span>
                </button>
              </div>
            </div>
            {intelLoading && (
              <p className="mt-2 text-[10px] text-indigo-500 animate-pulse">
                {intelSource === 'image' ? 'Analyzing image…' : 'Looking up business on Google Maps…'}
              </p>
            )}
          </div>

          {/* Section 1: Basic Information */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
              1. Basic Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. ABC Engineering Pvt Ltd"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Person <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Raj Patel"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Same as mobile if empty"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. raj@abc.com"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Website URL
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="e.g. abcengineering.com"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ahmedabad"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Gujarat"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="mt-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Persons
                </label>
              </div>
              <ContactsEditor contacts={contacts} onChange={setContacts} />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 2: Interested Digital Marketing Services */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
              2. Interested Services (Select Multiple)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {DIGITAL_MARKETING_SERVICES.map((srv) => {
                const checked = interestedServices.includes(srv);
                return (
                  <label
                    key={srv}
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(srv)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{srv}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 3: Business & Sales Parameters */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
              3. Sales & Pipeline Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                >
                  <option value="New">New</option>
                  {LEAD_STATUS_FLOW.slice(1).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {LEAD_TERMINAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as LeadPriority)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                >
                  <option value="Hot">🔥 Hot</option>
                  <option value="Warm">🟡 Warm</option>
                  <option value="Cold">🔵 Cold</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lead Source
                </label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                >
                  {LEAD_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Budget
                </label>
                <input
                  type="text"
                  value={estimatedBudget}
                  onChange={(e) => setEstimatedBudget(e.target.value)}
                  placeholder="e.g. ₹1.5 Lakhs"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Deal Value (₹)
                </label>
                <input
                  type="number"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(Number(e.target.value))}
                  placeholder="150000"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Salesperson
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {users
                    .filter((u) => u.active === 1)
                    .map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  <option value="Unassigned">Unassigned</option>
                </select>
                {!isAdmin && (
                  <p className="text-[10px] text-slate-400 mt-1">Only admins can reassign leads.</p>
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 4: Next Follow-up Schedule */}
          <div>
            <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3">
              4. Next Follow-up Schedule
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Time
                </label>
                <input
                  type="text"
                  value={nextFollowupTime}
                  onChange={(e) => setNextFollowupTime(e.target.value)}
                  placeholder="e.g. 11:30 AM"
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Action Type
                </label>
                <select
                  value={nextFollowupType}
                  onChange={(e) => setNextFollowupType(e.target.value as FollowupType)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Call">Phone Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">In-person / Zoom Meeting</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Follow-up Note
              </label>
              <input
                type="text"
                value={nextFollowupNote}
                onChange={(e) => setNextFollowupNote(e.target.value)}
                placeholder="e.g. Send revised SEO & Website quotation"
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
              />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 5: Requirement Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer Requirement Notes
            </label>
            <textarea
              rows={3}
              value={requirementNotes}
              onChange={(e) => setRequirementNotes(e.target.value)}
              placeholder="e.g. Needs website redesign and SEO. Currently using another agency. Wants quotation this week."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 focus:ring-2 focus:ring-blue-500 dark:text-slate-100 leading-relaxed"
            />
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 6: Business Profile */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Business Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Job ID">
                <input value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputCls} placeholder="e.g. JOB-001" />
              </Field>
              <Field label="Rating">
                <input value={rating} onChange={(e) => setRating(e.target.value)} className={inputCls} placeholder="e.g. 4.5" />
              </Field>
              <Field label="Review Count">
                <input value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} className={inputCls} placeholder="e.g. 128" />
              </Field>
              <Field label="Website Phone">
                <input value={websitePhone} onChange={(e) => setWebsitePhone(e.target.value)} className={inputCls} placeholder="Phone listed on website" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Full business address" />
                </Field>
              </div>
              <Field label="WhatsApp URL">
                <input value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} className={inputCls} placeholder="https://wa.me/..." />
              </Field>
              <Field label="Instagram URL">
                <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={inputCls} placeholder="https://instagram.com/..." />
              </Field>
              <Field label="Facebook URL">
                <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className={inputCls} placeholder="https://facebook.com/..." />
              </Field>
              <Field label="LinkedIn URL">
                <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className={inputCls} placeholder="https://linkedin.com/..." />
              </Field>
              <div className="sm:col-span-2">
                <Field label="YouTube URL">
                  <input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className={inputCls} placeholder="https://youtube.com/..." />
                </Field>
              </div>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 7: Website Tech Status */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Website Tech & Tracking Status
            </h3>
            <p className="text-[10px] text-slate-400 mb-3">
              Free text (e.g. WordPress, Yes, No). Green badges appear on the lead when a value is set.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="CMS">
                <input value={cms} onChange={(e) => setCms(e.target.value)} className={inputCls} placeholder="e.g. WordPress" />
              </Field>
              <Field label="GA4">
                <input value={ga4} onChange={(e) => setGa4(e.target.value)} className={inputCls} placeholder="Yes / No" />
              </Field>
              <Field label="GTM">
                <input value={gtm} onChange={(e) => setGtm(e.target.value)} className={inputCls} placeholder="Yes / No" />
              </Field>
              <Field label="Meta Pixel">
                <input value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} className={inputCls} placeholder="Yes / No" />
              </Field>
              <Field label="WhatsApp Widget">
                <input value={whatsappWidget} onChange={(e) => setWhatsappWidget(e.target.value)} className={inputCls} placeholder="Yes / No" />
              </Field>
              <Field label="Live Chat">
                <input value={liveChat} onChange={(e) => setLiveChat(e.target.value)} className={inputCls} placeholder="Yes / No" />
              </Field>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-md shadow-blue-600/25 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{leadToEdit ? 'Save Changes' : 'Save Lead'}</span>
            </button>
          </div>
        </form>
      </div>

      <BusinessIntelConfirmModal
        isOpen={intelOpen}
        loading={intelLoading}
        error={intelError}
        data={intelData}
        source={intelSource}
        onCancel={handleCancelIntel}
        onApply={handleApplyIntel}
      />
    </div>
  );
};

const inputCls =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
    {children}
  </div>
);
