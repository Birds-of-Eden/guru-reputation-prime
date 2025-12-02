// app/components/onboarding/general-info.tsx

"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Upload, User, Building2, MapPin, Calendar, Mail, Phone, Lock, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StepProps } from "@/types/onboarding";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useUserSession } from "@/lib/hooks/use-user-session";

type AMUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export function GeneralInfo({ formData, updateFormData, onNext }: StepProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ----- AM fetching state -----
  const [ams, setAms] = useState<AMUser[]>([]);
  const [amsLoading, setAmsLoading] = useState<boolean>(false);
  const [amsError, setAmsError] = useState<string | null>(null);

  // ----- Session (Better Auth) -----
  const { user: sessionUser, loading: sessionLoading } = useUserSession();
  const currentUserId = sessionUser?.id ?? undefined;
  const currentUserRole = sessionUser?.role ?? undefined;
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";

  useEffect(() => {
    let mounted = true;
    const loadAMs = async () => {
      try {
        setAmsLoading(true);
        setAmsError(null);

        // If your API supports role & paging, use them to minimize payloads
        const res = await fetch("/api/users?role=am&limit=100", {
          cache: "no-store",
        });
        const json = await res.json();

        // Accept both shapes: {users: [...]} (yours) or {data: [...]}
        const raw = (json?.users ?? json?.data ?? []) as any[];

        const list = raw
          .filter((u) => u?.role?.name === "am") // client-side safety guard
          .map((u) => ({
            id: u.id as string,
            name: u.name as string | null,
            email: u.email as string | null,
          }));

        if (mounted) setAms(list);
      } catch {
        if (mounted) setAmsError("Failed to load AM list");
      } finally {
        if (mounted) setAmsLoading(false);
      }
    };
    loadAMs();
    return () => {
      mounted = false;
    };
  }, []);

  // If the logged-in user is an AM, force-select their ID and keep it locked
  useEffect(() => {
    if (isAM && currentUserId && formData.amId !== currentUserId) {
      updateFormData({ amId: currentUserId });
    }
  }, [isAM, currentUserId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateFormData({ profilePicture: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const amLabel = (u: AMUser) => {
    const n = u.name?.trim();
    const e = u.email?.trim();
    if (n && e) return `${n} (${e})`;
    return n || e || u.id;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg mb-4">
          <User className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
          General Information
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Let's start with some basic information about you or your business.
        </p>
      </div>

      {/* Personal Information Card */}
      <div className="bg-gradient-to-br from-white to-violet-50/30 rounded-2xl shadow-xl border border-violet-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
            <User className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Personal Details</h2>
        </div>

        <div className="space-y-6">
          <div className="group">
            <Label htmlFor="name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4 text-violet-500" />
              Full Name *
            </Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder="Enter your full name"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <div className="group">
            <Label className="text-sm font-semibold text-gray-700 mb-3 block">Profile Picture</Label>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="relative h-28 w-28 rounded-2xl overflow-hidden border-4 border-white shadow-xl ring-2 ring-violet-200 group-hover:ring-violet-400 transition-all duration-300">
                  {previewUrl ? (
                    <Image
                      src={previewUrl || "/placeholder.svg"}
                      alt="Profile preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                      <User className="w-12 h-12 text-violet-400" />
                    </div>
                  )}
                </div>
                {previewUrl && (
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <label className="cursor-pointer flex-1">
                <div className="flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-violet-300 rounded-xl hover:border-violet-500 hover:bg-violet-50 transition-all duration-200 group">
                  <Upload className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <span className="block text-sm font-semibold text-gray-700">Upload Photo</span>
                    <span className="block text-xs text-gray-500">PNG, JPG up to 10MB</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group">
              <Label htmlFor="birthdate" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                Birth Date
              </Label>
              <div className="mt-2">
              <DatePicker
                selected={
                  formData.birthdate ? new Date(formData.birthdate) : null
                }
                onChange={(date: Date | null) =>
                  updateFormData({ birthdate: date ? date.toISOString() : "" })
                }
                dateFormat="MMMM d, yyyy"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                placeholderText="Select birth date"
                className="w-full h-12 border-2 border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all duration-200 rounded-xl px-4 py-2"
              />
              </div>
            </div>

            <div className="group">
              <Label htmlFor="gender" className="text-sm font-semibold text-gray-700">Gender</Label>
              <select
                id="gender"
                value={formData.gender || ""}
                onChange={(e) => {
                  const value = e.target.value as "" | "male" | "female" | "other";
                  updateFormData({ gender: value || undefined });
                }}
                className="mt-2 flex h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all duration-200"
              >
                <option disabled value="">
                  Select gender
                </option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="group">
              <Label htmlFor="location" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-500" />
                Location
              </Label>
              <Input
                id="location"
                value={formData.location || ""}
                onChange={(e) => updateFormData({ location: e.target.value })}
                placeholder="Enter your location"
                className="mt-2 h-12 border-2 border-gray-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 transition-all duration-200 rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Company Information Card */}
      <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-xl border border-blue-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Company Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group">
            <Label htmlFor="company" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Company
            </Label>
            <Input
              id="company"
              value={formData.company || ""}
              onChange={(e) => updateFormData({ company: e.target.value })}
              placeholder="Enter your company"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl"
            />
          </div>

          <div className="group">
            <Label htmlFor="designation" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-500" />
              Designation
            </Label>
            <Input
              id="designation"
              value={formData.designation || ""}
              onChange={(e) => updateFormData({ designation: e.target.value })}
              placeholder="Enter your designation"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl"
            />
          </div>

          <div className="group">
            <Label htmlFor="companyaddress" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Company Address
            </Label>
            <Input
              id="companyaddress"
              value={formData.companyaddress || ""}
              onChange={(e) =>
                updateFormData({ companyaddress: e.target.value })
              }
              placeholder="Enter company address"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl"
            />
          </div>

          <div className="group">
            <Label htmlFor="companywebsite" className="text-sm font-semibold text-gray-700">Company Website</Label>
            <Input
              id="companywebsite"
              value={formData.companywebsite || ""}
              onChange={(e) =>
                updateFormData({ companywebsite: e.target.value })
              }
              placeholder="https://company.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl"
              inputMode="url"
            />
          </div>
        </div>
      </div>

      {/* Account Management Card */}
      <div className="bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl shadow-xl border border-emerald-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Management</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group">
            <Label htmlFor="amId" className="text-sm font-semibold text-gray-700">Account Manager (AM)</Label>
            <Select
              value={
                isAM && currentUserId ? currentUserId : formData.amId || ""
              }
              onValueChange={(value) =>
                updateFormData({ amId: value === "__none__" ? "" : value })
              }
              disabled={isAM}
            >
              <SelectTrigger
                className="mt-2 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all duration-200 rounded-xl"
                id="amId"
                aria-label="Select account manager"
              >
                <SelectValue
                  placeholder={
                    amsLoading
                      ? "Loading AMs..."
                      : ams.length
                      ? "Select account manager"
                      : "No AMs found"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>
                  Select Account Manager
                </SelectItem>
                {isAM && currentUserId
                  ? (() => {
                      const me = ams.find((u) => u.id === currentUserId);
                      return (
                        <SelectItem key={currentUserId} value={currentUserId}>
                          {me ? me.name ?? me.email ?? currentUserId : "You"}
                        </SelectItem>
                      );
                    })()
                  : ams.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
            {amsError && (
              <p className="text-sm text-red-600 mt-1">{amsError}</p>
            )}
            {isAM && (
              <p className="text-xs text-gray-500 mt-1">
                As an Account Manager, this field is locked to your account.
              </p>
            )}
          </div>

          <div className="group">
            <Label htmlFor="status" className="text-sm font-semibold text-gray-700">Status</Label>
            <Select
              value={formData.status || ""}
              onValueChange={(value) => updateFormData({ status: value })}
            >
              <SelectTrigger className="mt-2 h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all duration-200 rounded-xl">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Optional Information Card */}
      <div className="bg-gradient-to-br from-white to-amber-50/30 rounded-2xl shadow-xl border border-amber-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Optional Information</h2>
          </div>
          <span className="px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">Optional</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="group">
            <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" />
              Client Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => updateFormData({ email: e.target.value })}
              placeholder="client@example.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 rounded-xl"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="group">
            <Label htmlFor="phone" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-500" />
              Client Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => updateFormData({ phone: e.target.value })}
              placeholder="+1XXXXXXXXX"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 rounded-xl"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div className="group">
            <Label htmlFor="password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password || ""}
              onChange={(e) => updateFormData({ password: e.target.value })}
              placeholder="Set a password"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 rounded-xl"
              autoComplete="new-password"
            />
          </div>

          <div className="group">
            <Label htmlFor="recoveryEmail" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              Recovery Email
            </Label>
            <Input
              id="recoveryEmail"
              type="email"
              value={formData.recoveryEmail || ""}
              onChange={(e) =>
                updateFormData({ recoveryEmail: e.target.value })
              }
              placeholder="recovery@example.com"
              className="mt-2 h-12 border-2 border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all duration-200 rounded-xl"
              autoComplete="email"
              inputMode="email"
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-8">
        <Button 
          onClick={onNext} 
          disabled={!formData.name || !formData.gender || !formData.status}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
