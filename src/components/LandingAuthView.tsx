import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cloud,
  FileText,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import {
  DEFAULT_STUDIO_INFO,
  STUDIO_SERVICE_PRESETS,
  toE164BDPhone,
  formatBDT,
} from '../constants/studioDefaults';
import {
  createPhoneRecaptcha,
  sendPhoneOtp,
  signInWithGoogleAndDrive,
} from '../services/firebase';

interface LandingAuthViewProps {
  onSignedIn: (driveToken: string | null) => void;
}

export const LandingAuthView: React.FC<LandingAuthViewProps> = ({ onSignedIn }) => {
  const [authTab, setAuthTab] = useState<'google' | 'phone'>('google');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [phoneInput, setPhoneInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // ignore
        }
        recaptchaRef.current = null;
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const { accessToken } = await signInWithGoogleAndDrive();
      onSignedIn(accessToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('লগইন পপআপ বন্ধ করা হয়েছিল। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else if (msg.includes('popup-blocked')) {
        setErrorMsg('ব্রাউজার পপআপ ব্লক করেছে। পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।');
      } else {
        setErrorMsg(`Google সাইন-ইন ব্যর্থ হয়েছে: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const e164 = toE164BDPhone(phoneInput);
    if (e164.length < 13) {
      setErrorMsg('সঠিক বাংলাদেশী মোবাইল নাম্বার দিন (যেমন: 01715938402)।');
      return;
    }

    setLoading(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = createPhoneRecaptcha('studio-phone-recaptcha');
      }
      const result = await sendPhoneOtp(e164, recaptchaRef.current);
      setConfirmationResult(result);
      setInfoMsg(`${e164} নাম্বারে ৬ সংখ্যার OTP পাঠানো হয়েছে।`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed')) {
        setErrorMsg(
          'Firebase Console-এ Phone Authentication চালু করা নেই। অনুগ্রহ করে Google দিয়ে সাইন-ইন করুন অথবা Firebase Console > Authentication > Sign-in method থেকে Phone চালু করুন।'
        );
      } else if (msg.includes('billing-not-enabled')) {
        setErrorMsg(
          'SMS OTP পাঠানোর জন্য Firebase প্রকল্পে Phone Auth / Blaze বিলিং প্রয়োজন। এখনই নিরাপদভাবে শুরু করতে Google দিয়ে সাইন-ইন করুন।'
        );
      } else {
        setErrorMsg(`OTP পাঠাতে সমস্যা হয়েছে: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult || otpCode.trim().length < 6) {
      setErrorMsg('৬ সংখ্যার সঠিক OTP কোড লিখুন।');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await confirmationResult.confirm(otpCode.trim());
      onSignedIn(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`OTP যাচাই ব্যর্থ হয়েছে: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones, gap-8 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {DEFAULT_STUDIO_INFO.studioName}
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              সেবাসমূহ
            </a>
            <a
              href="#services-pricing"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              রেট চার্ট
            </a>
            <a
              href="#backup-security"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              ক্লাউড ব্যাকআপ
            </a>
            <a
              href="#contact"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              ঠিকানা ও যোগাযোগ
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#auth-portal"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 inline-block"
            >
              ড্যাশবোর্ড লগইন
            </a>
          </div>
        </div>
      </header>

      {/* Main Split Hero + Auth Portal */}
      <main id="top" className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Showcase Column */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="relative h-64 sm:h-72 bg-slate-900 overflow-hidden">
                <img
                  src="/src/assets/images/studio_workspace_hero_1795170986131.jpg"
                  alt="অপূর্ব ডিজিটাল ষ্টুডিও কর্মক্ষেত্র"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex items-end p-6">
                  <div className="text-white">
                    <div className="text-xs text-slate-200 mb-1 flex items-center gap-2">
                      <span>ভাদাইল বাজার, চৌরাস্তা, আশুলিয়া</span>
                      <span aria-hidden="true">·</span>
                      <span>সাভার, ঢাকা - ১৩৪৯</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                      {DEFAULT_STUDIO_INFO.studioName} — ডিজিটাল বিলিং ও ক্লাউড হিসাব
                    </h1>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                <div>
                  <p className="text-base text-slate-700 leading-relaxed">
                    প্রোঃ <strong className="text-slate-900">{DEFAULT_STUDIO_INFO.proprietorName}</strong>।
                    পৃথিবীর যেকোনো প্রান্ত থেকে নিরাপদ ক্লাউড অ্যাকাউন্টের মাধ্যমে কাস্টমার বিলিং রিসিট তৈরি, বকেয়া খাতা পরিচালনা, প্রতি মাসের আয়-ব্যয়ের হিসাব, স্বয়ংক্রিয় Google Drive ব্যাকআপ এবং{' '}
                    <span className="font-mono-num font-semibold text-slate-900">
                      {DEFAULT_STUDIO_INFO.whatsappNumber}
                    </span>{' '}
                    থেকে সরাসরি WhatsApp-এ PDF রিসিট পাঠান।
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">অফিসিয়াল মোবাইল</div>
                    <div className="font-mono-num font-bold text-slate-900 mt-0.5">
                      {DEFAULT_STUDIO_INFO.mobile}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">WhatsApp PDF প্রেরক</div>
                    <div className="font-mono-num font-bold text-emerald-700 mt-0.5">
                      {DEFAULT_STUDIO_INFO.whatsappNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">ক্লাউড সিঙ্ক ও ব্যাকআপ</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      Firestore + Google Drive
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Auth Card */}
            <div
              id="auth-portal"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <img
                    src="/src/assets/images/studio_emblem_1795170985416.jpg"
                    alt="অপূর্ব ডিজিটাল ষ্টুডিও লোগো"
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">নিরাপদ অ্যাকাউন্ট লগইন</h2>
                    <p className="text-xs text-slate-500">
                      Google অথবা মোবাইল OTP ভেরিফিকেশন ব্যবহার করুন
                    </p>
                  </div>
                </div>

                {/* Auth Mode Switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('google');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      authTab === 'google'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Google অ্যাকাউন্ট (প্রস্তাবিত)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('phone');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      authTab === 'phone'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    মোবাইল নাম্বার ভেরিফাই
                  </button>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                    {errorMsg}
                  </div>
                )}

                {infoMsg && (
                  <div className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
                    {infoMsg}
                  </div>
                )}

                {authTab === 'google' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Google দিয়ে সাইন-ইন করলে আপনার সকল বিলিং ও মাসিক হিসাব ক্লাউডে নিরাপদ থাকবে এবং সাথে সাথে{' '}
                      <strong className="text-slate-900">Google Drive ব্যাকআপ</strong> চালু হবে।
                    </p>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="gsi-material-button"
                    >
                      <div className="gsi-material-button-content-wrapper">
                        <div className="gsi-material-button-icon">
                          <svg
                            version="1.1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            style={{ display: 'block' }}
                          >
                            <path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            />
                            <path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            />
                            <path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            />
                            <path fill="none" d="M0 0h48v48H0z" />
                          </svg>
                        </div>
                        <span>
                          {loading ? 'প্রবেশ করা হচ্ছে...' : 'Sign in with Google'}
                        </span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!confirmationResult ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div>
                          <label
                            htmlFor="phone-auth-input"
                            className="block text-xs font-semibold text-slate-700 mb-1.5"
                          >
                            মোবাইল নাম্বার (বাংলাদেশ)
                          </label>
                          <div className="relative">
                            <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              id="phone-auth-input"
                              type="tel"
                              value={phoneInput}
                              onChange={(e) => setPhoneInput(e.target.value)}
                              placeholder="01715-938402"
                              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono-num"
                              required
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {loading ? 'OTP পাঠানো হচ্ছে...' : 'ভেরিফিকেশন OTP পাঠান'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                          <label
                            htmlFor="otp-code-input"
                            className="block text-xs font-semibold text-slate-700 mb-1.5"
                          >
                            ৬ সংখ্যার OTP কোড লিখুন
                          </label>
                          <input
                            id="otp-code-input"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="123456"
                            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono-num tracking-widest text-center"
                            required
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmationResult(null);
                              setOtpCode('');
                            }}
                            className="px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            নাম্বার বদলান
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 px-4 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {loading ? 'যাচাই হচ্ছে...' : 'OTP যাচাই করে প্রবেশ করুন'}
                          </button>
                        </div>
                      </form>
                    )}
                    <div id="studio-phone-recaptcha" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      নোট: মোবাইল OTP লগইন সক্রিয় করতে Firebase Console &gt; Authentication &gt; Sign-in method থেকে Phone চালু থাকতে হবে। Google সাইন-ইন তাৎক্ষণিকভাবে কাজ করে।
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2.5 text-xs text-slate-500">
                <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                <span>
                  প্রতিটি অ্যাকাউন্টের ডেটা এনক্রিপ্টেড এবং শুধুমাত্র যাচাইকৃত মালিকের জন্য সংরক্ষিত।
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <FileText className="w-5 h-5 text-slate-900 mb-3" />
              <h3 className="text-base font-bold text-slate-900">কাস্টমার বিলিং ও রিসিট</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                ক্রমিক নং, গ্রাহকের নাম, মোবাইল নাম্বার, কাজের বিবরণ, জমা ও বকেয়াসহ তাৎক্ষণিক PDF ইনভয়েস।
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <MessageCircle className="w-5 h-5 text-emerald-700 mb-3" />
              <h3 className="text-base font-bold text-slate-900">WhatsApp PDF ডিসপ্যাচ</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                প্রতিষ্ঠানের <span className="font-mono-num font-semibold">01674-977245</span> নাম্বার উল্লেখ করে সরাসরি গ্রাহকের WhatsApp-এ PDF রিসিট ও বকেয়া মেসেজ।
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <Cloud className="w-5 h-5 text-blue-700 mb-3" />
              <h3 className="text-base font-bold text-slate-900">Google Drive ব্যাকআপ</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                সকল ইনভয়েস PDF ও সম্পূর্ণ হিসাবখাতা স্বয়ংক্রিয়ভাবে Google Drive ফোল্ডারে ব্যাকআপ থাকে।
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <ShieldCheck className="w-5 h-5 text-slate-900 mb-3" />
              <h3 className="text-base font-bold text-slate-900">মাসিক আয়-ব্যয় ও বকেয়া খাতা</h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                প্রতি মাসের মোট বিক্রি, বকেয়া আদায়, স্টুডিও খরচ ও নিট লাভের পূর্ণাঙ্গ হিসাব যেকোনো জায়গা থেকে।
              </p>
            </div>
          </div>
        </section>

        {/* Public Studio Rate Chart for Web Search Discoverability */}
        <section id="services-pricing" className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">স্টুডিও সেবাসমূহ ও প্রচলিত রেট</h2>
                <p className="text-sm text-slate-600 mt-1">
                  অপূর্ব ডিজিটাল ষ্টুডিও — ভাদাইল বাজার, চৌরাস্তা, আশুলিয়া, সাভার, ঢাকা - ১৩৪৯
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Camera className="w-4 h-4 text-slate-700" />
                <span>অর্ডার ও বুকিং: {DEFAULT_STUDIO_INFO.mobile}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {STUDIO_SERVICE_PRESETS.map((service) => (
                <div
                  key={service.name}
                  className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col justify-between gap-2"
                >
                  <div className="text-sm font-semibold text-slate-900">{service.name}</div>
                  <div className="text-base font-bold font-mono-num text-slate-900">
                    {formatBDT(service.rate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Contact & Footer */}
      <footer id="contact" className="bg-white border-t border-slate-200 mt-8">
        <div
          id="backup-security"
          className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-slate-600"
        >
          <div className="space-y-1">
            <div className="font-bold text-slate-900 text-base">
              {DEFAULT_STUDIO_INFO.studioName}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{DEFAULT_STUDIO_INFO.address}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>প্রোঃ {DEFAULT_STUDIO_INFO.proprietorName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num font-semibold text-slate-900">
                {DEFAULT_STUDIO_INFO.mobile}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp:</span>
              <span className="font-mono-num font-semibold text-emerald-700">
                {DEFAULT_STUDIO_INFO.whatsappNumber}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
