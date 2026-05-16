"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { getBaseUrl } from "@/lib/url";

type PaymentMethod = {
  id: string;
  label: string;
  badge: "API Verified";
};

type FormState = {
  fullName: string;
  email: string;
  startupName: string;
  website: string;
  businessType: string;
  mrr: string;
  arr: string;
  twitter: string;
  linkedin: string;
  cityCountry: string;
  notes: string;
  paymentMethods: string[];
  verificationType: string;
  apiProvider: string;
  apiKey: string;
};

type FormErrors = Partial<Record<keyof FormState | "paymentMethods", string>>;
type Step = 1 | 2 | 3 | 4;

const paymentMethodOptions: PaymentMethod[] = [
  { id: "razorpay", label: "Razorpay", badge: "API Verified" },
  { id: "stripe", label: "Stripe", badge: "API Verified" },
  { id: "cashfree", label: "Cashfree", badge: "API Verified" },
  { id: "paddle", label: "Paddle", badge: "API Verified" },
  { id: "lemon-squeezy", label: "Lemon Squeezy", badge: "API Verified" },
];

const businessTypeOptions = [
  "SaaS/Software",
  "Artificial Intelligence",
  "Mobile App",
  "D2C/E-commerce",
  "Content/Creator",
  "Agency/Services",
  "Developer Tools",
  "Marketing Tools",
];

const initialForm: FormState = {
  fullName: "",
  email: "",
  startupName: "",
  website: "",
  businessType: "",
  mrr: "",
  arr: "",
  twitter: "",
  linkedin: "",
  cityCountry: "",
  notes: "",
  paymentMethods: [],
  verificationType: "",
  apiProvider: "stripe",
  apiKey: "",
};

function badgeClassName(type: PaymentMethod["badge"]) {
  if (type === "API Verified") {
    return "border border-primary/20 bg-primary/20 text-primary";
  }
  return "";
}

export default function SubmitPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [claimedCount, setClaimedCount] = useState(26);
  const [slotNumber, setSlotNumber] = useState<number | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ mrr: number; currency: string } | null>(null);
  const [verifiedRevenue, setVerifiedRevenue] = useState<number | null>(null);

  const handleVerifyRevenue = async () => {
    if (form.apiProvider === "stripe" && !form.apiKey) {
      alert("Please enter your Stripe Secret Key");
      return;
    }
    if (form.apiProvider === "razorpay" && !form.apiKey.includes(":")) {
      alert("Please enter Razorpay Key ID and Secret separated by a colon (ID:SECRET)");
      return;
    }

    setIsVerifying(true);
    try {
      const payload: any = { provider: form.apiProvider };
      if (form.apiProvider === "stripe") {
        payload.apiKey = form.apiKey;
      } else {
        const [id, secret] = form.apiKey.split(":");
        payload.keyId = id;
        payload.keySecret = secret;
      }

      const res = await fetch("/api/verify/one-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setVerifyStatus({ mrr: data.revenue, currency: data.currency });
      setVerifiedRevenue(data.revenue);
      // Automatically update the MRR field with the verified value
      onInputChange("mrr", Math.round(data.revenue).toString());
      alert(`Verified MRR: ${data.currency} ${Math.round(data.revenue)}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsVerifying(false);
    }
  };


  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getBaseUrl()}/submit`,
      },
    });
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-[#161616] px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 focus:border-border";
  const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.8px] text-muted-foreground";
  const sectionTitleClass =
    "mb-4 border-b border-border pb-2 text-[11px] uppercase tracking-[1.5px] text-muted-foreground";

  const twitterShareUrl = useMemo(() => {
    const text =
      "Just joined Verifi's founding member cohort. Building in public with verified revenue.";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }, []);
  const totalSpots = 50;
  const progressPercentage = Math.max(
    0,
    Math.min(100, (claimedCount / totalSpots) * 100)
  );
  const stepProgressPercentage = (step / 4) * 100;

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/startup-submissions/count");
        if (!response.ok) return;
        const data = (await response.json()) as { count?: number };
        if (typeof data.count === "number") {
          setClaimedCount(data.count);
        }
      } catch {
        // Keep fallback count when request fails.
      }
    };

    fetchCount();
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    if (!form.startupName.trim())
      nextErrors.startupName = "Startup / Business name is required";
    if (!form.businessType.trim())
      nextErrors.businessType = "Business type is required";
    if (!form.mrr.trim()) nextErrors.mrr = "MRR is required";
    if (!form.arr.trim()) nextErrors.arr = "ARR is required";
    if (!form.verificationType) nextErrors.verificationType = "Please select a verification method";
    if (!form.cityCountry.trim())
      nextErrors.cityCountry = "City / Country is required";
    if (!form.paymentMethods.length) {
      nextErrors.paymentMethods = "Select at least one payment method";
    }
    return nextErrors;
  };

  const validateStep = (stepToValidate: Step): FormErrors => {
    const nextErrors: FormErrors = {};

    if (stepToValidate === 1) {
      if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
      if (!form.email.trim()) nextErrors.email = "Email is required";
    }

    if (stepToValidate === 2) {
      if (!form.startupName.trim())
        nextErrors.startupName = "Startup / Business name is required";
      if (!form.businessType.trim())
        nextErrors.businessType = "Business type is required";
    }

    if (stepToValidate === 3) {
      if (!form.mrr.trim()) nextErrors.mrr = "MRR is required";
      if (!form.arr.trim()) nextErrors.arr = "ARR is required";
      if (!form.verificationType) nextErrors.verificationType = "Please select a verification method";
      if (!form.paymentMethods.length) {
        nextErrors.paymentMethods = "Select at least one payment method";
      }
    }

    if (stepToValidate === 4) {
      if (!form.cityCountry.trim())
        nextErrors.cityCountry = "City / Country is required";
    }

    return nextErrors;
  };

  const handleNextStep = () => {
    const stepErrors = validateStep(step);
    setErrors((prev) => ({ ...prev, ...stepErrors }));
    if (Object.keys(stepErrors).length > 0) return;
    setStep((prev) => (prev < 4 ? ((prev + 1) as Step) : prev));
  };

  const handlePrevStep = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const onInputChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const togglePaymentMethod = (id: string) => {
    setForm((prev) => {
      const isSelected = prev.paymentMethods.includes(id);
      const paymentMethods = isSelected
        ? prev.paymentMethods.filter((item) => item !== id)
        : [...prev.paymentMethods, id];
      return { ...prev, paymentMethods };
    });
    setErrors((prev) => ({ ...prev, paymentMethods: undefined }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError("");

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // Re-verify user is still authenticated
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setSubmitError("You must be logged in. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      let proof_url: string | null = null;

      if (proofFile) {
        const fileExt = proofFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(fileName, proofFile);

        if (uploadError) {
          console.error("UPLOAD ERROR:", uploadError);
          alert(uploadError.message);
          return;
        }

        const { data } = supabase.storage
          .from("proofs")
          .getPublicUrl(fileName);

        proof_url = data.publicUrl;


      }

      const confidenceMap: Record<string, number> = {
        manual: 20,
        social: 40,
        proof: 70,
        api: 100,
      };

      const payload = {
        name: form.fullName,
        email: form.email,
        startup_name: form.startupName,
        website: form.website,
        biz_type: form.businessType,
        mrr: Number(form.mrr),
        arr: Number(form.arr),
        verification_type: form.verificationType,
        payment_methods: form.paymentMethods,
        twitter: form.twitter,
        linkedin: form.linkedin,
        city: form.cityCountry,
        notes: form.notes,
        user_id: authData.user.id,
        proof_url: proof_url,
        confidence_score: confidenceMap[form.verificationType] ?? 0,
        verified_revenue: verifiedRevenue || null,
        verification_source: verifiedRevenue ? form.apiProvider : null,
        verified_api_key: verifiedRevenue ? form.apiKey : null,
      };



      const res = await fetch("/api/startup-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();



      if (!res.ok || !result.success) {
        alert(result.error || "Submission failed");
        return;
      }

      setSuccessMessage("Startup submitted successfully!");

      setIsSuccess(true);
      if (typeof result.slot_number === "number") {
        setSlotNumber(result.slot_number);
      }
      setForm(initialForm);
      setStep(1);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError("Submission failed. Please try again in a few moments.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white">
        <h2 className="mb-4 text-xl">Login required</h2>
        <button
          onClick={handleGoogleLogin}
          className="rounded-lg bg-white px-6 py-2 text-black"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 text-foreground">
      <Navbar />

      <header className="mx-auto max-w-[640px] px-6 pt-12 text-center">
        <h1 className="font-syne text-[44px] font-extrabold tracking-[-1.5px] text-foreground">
          List your startup on Verifi — <span className="text-primary">free</span>
        </h1>
        <p className="mt-3 text-[16px] font-light text-muted-foreground">
          Get verified and join the most transparent startup revenue database.
        </p>
      </header>

      <section className="mx-auto mt-8 max-w-[640px] px-6">
        <div className="rounded-xl border border-[rgba(245,166,35,0.2)] bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-muted-foreground">
              🔥 Founding member spots
            </div>
            <div className="font-syne text-[14px] font-bold text-[#f5a623]">
              {claimedCount} / {totalSpots} claimed
            </div>
          </div>
          <div className="mt-2.5 h-[3px] rounded-full bg-accent">
            <div
              className="h-[3px] rounded-full bg-[#f5a623]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[640px] px-6 pb-20">
        <div className="relative mt-0 overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-10">
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-[#b9ff4b] to-transparent" />

          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-[60px] text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(185,255,75,0.3)] bg-primary/20">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-6 font-syne text-[32px] font-extrabold">You&apos;re in!</h2>
              <div className="mt-3 inline-flex rounded-lg border border-[rgba(185,255,75,0.3)] bg-primary/20 px-4 py-2 font-syne text-[16px] font-bold text-primary">
                Founding Member #{slotNumber ?? claimedCount + 1}
              </div>
              <p className="mt-4 max-w-[520px] text-[14px] text-muted-foreground">
                Your startup has been submitted. Our team will review and reach out
                within 24 hours to complete verification.
              </p>
              <Link
                href={twitterShareUrl}
                target="_blank"
                className="mt-6 rounded-xl border border-border bg-[#161616] px-4 py-2 text-sm text-foreground transition-colors hover:border-border"
              >
                Share on Twitter
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>Step {step} of 4</span>
                  <span>{Math.round(stepProgressPercentage)}%</span>
                </div>
                <div className="h-2 rounded-full bg-accent">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${stepProgressPercentage}%` }}
                  />
                </div>
              </div>

              {step === 1 && (
                <section>
                  <h3 className={sectionTitleClass}>Founder info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Full name <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.fullName ? "border-border" : ""}`}
                        value={form.fullName}
                        onChange={(e) => onInputChange("fullName", e.target.value)}
                      />
                      {errors.fullName ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.fullName}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>
                        Email <span className="text-primary">*</span>
                      </label>
                      <input
                        type="email"
                        className={`${inputClass} ${errors.email ? "border-border" : ""}`}
                        value={form.email}
                        onChange={(e) => onInputChange("email", e.target.value)}
                      />
                      {errors.email ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.email}</p>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h3 className={sectionTitleClass}>Startup info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Startup / Business name{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.startupName ? "border-border" : ""}`}
                        value={form.startupName}
                        onChange={(e) => onInputChange("startupName", e.target.value)}
                      />
                      {errors.startupName ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.startupName}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Website URL</label>
                      <input
                        className={inputClass}
                        value={form.website}
                        onChange={(e) => onInputChange("website", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>
                      Business type <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <select
                        className={`${inputClass} appearance-none pr-10 ${errors.businessType ? "border-border" : ""}`}
                        value={form.businessType}
                        onChange={(e) => onInputChange("businessType", e.target.value)}
                      >
                        <option value="">Select business type</option>
                        {businessTypeOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {errors.businessType ? (
                      <p className="mt-1 text-xs text-[#ff4b4b]">{errors.businessType}</p>
                    ) : null}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <h3 className={sectionTitleClass}>Revenue info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        MRR — Monthly Recurring Revenue{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.mrr ? "border-border" : ""}`}
                        value={form.mrr}
                        onChange={(e) => onInputChange("mrr", e.target.value)}
                      />
                      {errors.mrr ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.mrr}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>
                        ARR — Annual Recurring Revenue{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.arr ? "border-border" : ""}`}
                        value={form.arr}
                        onChange={(e) => onInputChange("arr", e.target.value)}
                      />
                      {errors.arr ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.arr}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-8">
                    <label className={labelClass}>
                      How do you want to verify your revenue? <span className="text-primary">*</span>
                    </label>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { id: "manual", label: "Manual", description: "(fastest, lowest trust)" },
                        { id: "social", label: "Social proof", description: "(LinkedIn/Twitter based)" },
                        { id: "proof", label: "Upload proof", description: "(screenshot)" },
                        { id: "api", label: "Connect API", description: "Verify via Stripe or Razorpay" },
                      ].map((option) => {
                        const isSelected = form.verificationType === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-150 relative ${
                              isSelected
                                ? "border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)]"
                                : "border-border bg-[#161616] hover:border-border"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected
                                    ? "border-primary text-primary"
                                    : "border-muted-foreground"
                                }`}
                              >
                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                              <span className="text-[14px] font-medium text-foreground">
                                {option.label}
                              </span>
                            </div>
                            <span className="ml-7 mt-1 text-[12px] text-muted-foreground">
                              {option.description}
                            </span>
                            <input
                              type="radio"
                              name="verificationType"
                              value={option.id}
                              checked={isSelected}
                              onChange={(e) => onInputChange("verificationType", e.target.value)}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                    {errors.verificationType ? (
                      <p className="mt-2 text-xs text-[#ff4b4b]">{errors.verificationType}</p>
                    ) : null}

                    {form.verificationType && (
                      <div className="mt-4">
                        {form.verificationType === "manual" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4 text-[13px] text-muted-foreground">
                            No extra fields required. We will manually verify your revenue.
                          </div>
                        )}

                        {form.verificationType === "social" && (
                          <div className="rounded-lg border border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)] p-4">
                            <p className="mb-4 text-[13px] text-primary">
                              Please review your social links below. (Also shown in Step 4)
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <label className={labelClass}>Twitter / X handle</label>
                                <input
                                  className={`${inputClass} border-[rgba(185,255,75,0.4)] focus:border-primary`}
                                  value={form.twitter}
                                  onChange={(e) => onInputChange("twitter", e.target.value)}
                                />
                              </div>
                              <div>
                                <label className={labelClass}>LinkedIn URL</label>
                                <input
                                  className={`${inputClass} border-[rgba(185,255,75,0.4)] focus:border-primary`}
                                  value={form.linkedin}
                                  onChange={(e) => onInputChange("linkedin", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {form.verificationType === "proof" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4">
                            <p className="mb-3 text-[13px] text-muted-foreground">
                              Please upload a screenshot (image) of your revenue dashboard.
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-primary-foreground hover:file:bg-[#a8e630] cursor-pointer"
                              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        )}

                        {form.verificationType === "api" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4">
                            <p className="mb-4 text-[13px] text-muted-foreground">
                              Connect your payment provider using a read-only API key.
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <label className={labelClass}>Provider</label>
                                <div className="relative">
                                  <select
                                    className={`${inputClass} appearance-none pr-10`}
                                    value={form.apiProvider}
                                    onChange={(e) => onInputChange("apiProvider", e.target.value)}
                                  >
                                    <option value="stripe">Stripe</option>
                                    <option value="razorpay">Razorpay</option>
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                </div>
                              </div>
                              <div>
                                <label className={labelClass}>API Key</label>
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    className={inputClass}
                                    value={form.apiKey}
                                    onChange={(e) => onInputChange("apiKey", e.target.value)}
                                    placeholder={form.apiProvider === "stripe" ? "sk_live_..." : "ID:SECRET"}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleVerifyRevenue}
                                    disabled={isVerifying}
                                    className="h-11 rounded-lg bg-white/10 px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                                  >
                                    {isVerifying ? "Verifying..." : "Verify"}
                                  </button>
                                </div>
                                {verifyStatus && (
                                  <p className="mt-2 text-xs text-primary">
                                    ✓ Verified {verifyStatus.currency} {Math.round(verifyStatus.mrr)} MRR
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <p className="mb-3 text-[12px] text-muted-foreground">
                      Select all payment processors you use
                    </p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {paymentMethodOptions.map((item) => {
                        const isChecked = form.paymentMethods.includes(item.id);
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => togglePaymentMethod(item.id)}
                            aria-pressed={isChecked}
                            role="checkbox"
                            aria-checked={isChecked}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150 ${
                              isChecked
                                ? "border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)]"
                                : "border-border bg-[#161616] hover:border-border"
                            }`}
                          >
                            <input
                              type="checkbox"
                              tabIndex={-1}
                              className="sr-only"
                              checked={isChecked}
                              readOnly
                              aria-hidden="true"
                            />
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] ${
                                isChecked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="flex-1 text-[13px] text-muted-foreground">
                              {item.label}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClassName(item.badge)}`}
                            >
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.paymentMethods ? (
                      <p className="mt-2 text-xs text-[#ff4b4b]">{errors.paymentMethods}</p>
                    ) : null}
                  </div>
                </section>
              )}

              {step === 4 && (
                <section>
                  <h3 className={sectionTitleClass}>Social links</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Twitter / X handle</label>
                      <input
                        className={inputClass}
                        value={form.twitter}
                        onChange={(e) => onInputChange("twitter", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>LinkedIn URL</label>
                      <input
                        className={inputClass}
                        value={form.linkedin}
                        onChange={(e) => onInputChange("linkedin", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>
                      City / Country <span className="text-primary">*</span>
                    </label>
                    <input
                      className={`${inputClass} ${errors.cityCountry ? "border-border" : ""}`}
                      value={form.cityCountry}
                      onChange={(e) => onInputChange("cityCountry", e.target.value)}
                    />
                    {errors.cityCountry ? (
                      <p className="mt-1 text-xs text-[#ff4b4b]">{errors.cityCountry}</p>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <label className={labelClass}>Notes</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border border-border bg-[#161616] px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 focus:border-border"
                      placeholder="Your story, what you're building, questions..."
                      value={form.notes}
                      onChange={(e) => onInputChange("notes", e.target.value)}
                    />
                  </div>
                </section>
              )}

              {successMessage && (
                <div className="mt-6 rounded-lg bg-green-900/40 border border-green-500/30 px-4 py-3 text-green-300">
                  {successMessage}
                </div>
              )}

              {submitError ? (
                <div className="mt-6 rounded-lg border border-border bg-[#1a0000] p-3 text-sm text-[#ff4b4b]">
                  {submitError}
                </div>
              ) : null}

              <div className="mt-8 flex items-center gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="h-[52px] rounded-xl border border-border px-6 text-[14px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    Back
                  </button>
                ) : null}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex h-[52px] flex-1 items-center justify-center rounded-xl bg-primary font-syne text-[16px] font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-syne text-[16px] font-bold text-primary-foreground transition-colors hover:bg-[#a8e630] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      "Claim my founding member spot →"
                    )}
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Free forever to list. No spam. We&apos;ll reach out within 24 hours.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
